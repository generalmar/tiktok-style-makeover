// Edge function that bridges TikTok LIVE chat into the app's `answers` table.
//
// Actions (POST JSON):
//   { action: "connect", session_id, tiktok_username }
//   { action: "disconnect", session_id }
//   { action: "status", session_id }
//
// Strategy: the function spawns a long-running background task (EdgeRuntime
// .waitUntil) that opens a WebSocket to the TikTokLive signing server
// (eulerstream.com — the same signer the open-source `TikTokLive` libs use)
// and forwards every chat message into `submit-answer` parsing.
//
// The connection state is tracked in `tiktok_connections.status`. A
// disconnect request sets status='disconnected' and the background task
// observes that and exits.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SIGNER_API_KEY = Deno.env.get("EULERSTREAM_API_KEY") || ""; // optional
const SIGNER_BASE = "https://tiktok.eulerstream.com";

const CHOICE_REGEX = /\b([abcdABCD])\b/;
function parseChoice(raw: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const first = trimmed[0]?.toUpperCase();
  if (["A", "B", "C", "D"].includes(first)) return first;
  const m = trimmed.match(CHOICE_REGEX);
  if (m) return m[1].toUpperCase();
  return null;
}

// Track running tasks per session so we don't spawn duplicates within one isolate.
const RUNNING = new Map<string, AbortController>();

interface SignerWebcastResponse {
  status: "ok" | "error";
  data?: {
    wsUrl: string;
    wsParams?: Record<string, string>;
  };
  message?: string;
}

async function fetchWebcastUrl(username: string): Promise<{ wsUrl: string; wsParams: Record<string, string> } | { error: string }> {
  if (!SIGNER_API_KEY) {
    return { error: "Missing EULERSTREAM_API_KEY secret. Get a free key at eulerstream.com and add it in project secrets." };
  }
  const sanitizedUsername = username.trim().replace(/^@/, "");
  if (!sanitizedUsername) {
    return { error: "TikTok username is required." };
  }
  const url = new URL("/webcast/fetch", SIGNER_BASE);
  url.searchParams.set("unique_id", sanitizedUsername);
  url.searchParams.set("uniqueId", sanitizedUsername);
  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { "X-Api-Key": SIGNER_API_KEY },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { error: `Signer ${res.status}: ${text.slice(0, 240) || res.statusText}` };
  }
  const json = (await res.json()) as SignerWebcastResponse;
  if (json.status !== "ok" || !json.data?.wsUrl) {
    return { error: json.message || "Signer returned no wsUrl (is the user live?)" };
  }
  return { wsUrl: json.data.wsUrl, wsParams: json.data.wsParams || {} };
}

function buildWsUrl(wsUrl: string, wsParams: Record<string, string>): string {
  const u = new URL(wsUrl);
  for (const [k, v] of Object.entries(wsParams)) {
    u.searchParams.set(k, v);
  }
  return u.toString();
}

// Best-effort JSON extraction from incoming WS frames. The Webcast feed
// alternates between binary protobuf and JSON envelopes depending on the
// signer; we look for chat-shaped payloads either way.
function extractChatEvents(raw: unknown): Array<{ user: string; display: string; message: string }> {
  const events: Array<{ user: string; display: string; message: string }> = [];
  let parsed: any = null;
  if (typeof raw === "string") {
    try { parsed = JSON.parse(raw); } catch { return []; }
  } else if (raw && typeof raw === "object") {
    parsed = raw;
  } else {
    return [];
  }

  // The signer wraps decoded events in `{ event: 'chat', data: {...} }` or arrays.
  const items: any[] = Array.isArray(parsed) ? parsed : [parsed];
  for (const item of items) {
    const ev = item?.event ?? item?.type ?? item?.eventName;
    if (ev && String(ev).toLowerCase() !== "chat") continue;
    const data = item?.data ?? item;
    const message = data?.comment ?? data?.message ?? data?.text;
    const user = data?.user?.uniqueId ?? data?.uniqueId ?? data?.user?.userName ?? data?.user?.nickname;
    const display = data?.user?.nickname ?? data?.nickname ?? user;
    if (typeof message === "string" && typeof user === "string") {
      events.push({ user, display: display ?? user, message });
    }
  }
  return events;
}

async function runBridge(opts: {
  sessionId: string;
  username: string;
  abort: AbortController;
}) {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { sessionId, username, abort } = opts;

  const setStatus = async (patch: Record<string, unknown>) => {
    await admin.from("tiktok_connections").update({
      ...patch,
      updated_at: new Date().toISOString(),
    }).eq("session_id", sessionId);
  };

  // 1. Resolve a webcast WS URL via the signer.
  const fetched = await fetchWebcastUrl(username);
  if ("error" in fetched) {
    console.warn("[tiktok-chat] signer error:", fetched.error);
    await setStatus({ status: "error", last_error: fetched.error });
    RUNNING.delete(sessionId);
    return;
  }

  const wsUrl = buildWsUrl(fetched.wsUrl, fetched.wsParams);
  let ws: WebSocket;
  try {
    ws = new WebSocket(wsUrl);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ws_open_failed";
    await setStatus({ status: "error", last_error: msg });
    RUNNING.delete(sessionId);
    return;
  }

  ws.binaryType = "arraybuffer";

  const closeAll = () => {
    try { ws.close(); } catch { /* noop */ }
    RUNNING.delete(sessionId);
  };

  abort.signal.addEventListener("abort", closeAll);

  ws.addEventListener("open", async () => {
    await setStatus({ status: "connected", last_error: null, last_event_at: new Date().toISOString() });
  });

  ws.addEventListener("error", async (e) => {
    console.warn("[tiktok-chat] ws error", e);
    await setStatus({ status: "error", last_error: "websocket_error" });
  });

  ws.addEventListener("close", async () => {
    // Only mark disconnected if the user didn't explicitly disconnect already.
    const { data: row } = await admin.from("tiktok_connections")
      .select("status").eq("session_id", sessionId).maybeSingle();
    if (row && row.status === "connected") {
      await setStatus({ status: "disconnected", last_error: "stream_ended" });
    }
    closeAll();
  });

  ws.addEventListener("message", async (event) => {
    if (abort.signal.aborted) return;

    let payload: unknown = event.data;
    if (payload instanceof ArrayBuffer) {
      try { payload = new TextDecoder().decode(payload); } catch { return; }
    }

    const chats = extractChatEvents(payload);
    if (chats.length === 0) return;

    // Only accept chats while a round is live, and only the first answer per viewer.
    const { data: round } = await admin.from("rounds")
      .select("id, status, closes_at, session_id")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    await setStatus({ last_event_at: new Date().toISOString() });

    if (!round || round.status !== "live") return;
    if (round.closes_at && new Date(round.closes_at) < new Date()) return;

    for (const c of chats) {
      const choice = parseChoice(c.message);
      if (!choice) continue;
      const handle = c.user.slice(0, 80);
      const display = (c.display || c.user).slice(0, 120);
      const { error } = await admin.from("answers").insert({
        round_id: round.id,
        session_id: round.session_id,
        viewer_handle: handle,
        viewer_display_name: display,
        choice,
      });
      if (error && (error as any).code !== "23505") {
        console.warn("[tiktok-chat] insert failed:", error.message);
      }
    }
  });

  // Periodically poll our own DB row — if status flipped to 'disconnected'
  // (operator clicked Disconnect) we close the socket.
  const watcher = setInterval(async () => {
    if (abort.signal.aborted) { clearInterval(watcher); return; }
    const { data: row } = await admin.from("tiktok_connections")
      .select("status").eq("session_id", sessionId).maybeSingle();
    if (!row || row.status === "disconnected") {
      clearInterval(watcher);
      abort.abort();
    }
  }, 4000);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");
    const sessionId = String(body?.session_id || "");
    if (!sessionId) {
      return new Response(JSON.stringify({ ok: false, error: "session_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "connect") {
      const username = String(body?.tiktok_username || "").trim().replace(/^@/, "");
      if (!username) {
        return new Response(JSON.stringify({ ok: false, error: "tiktok_username required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Cancel any existing in-isolate task before starting a new one.
      RUNNING.get(sessionId)?.abort();

      await admin.from("tiktok_connections").upsert({
        session_id: sessionId,
        tiktok_username: username,
        status: "connecting",
        last_error: null,
        last_event_at: null,
        viewer_count: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "session_id" });

      const abort = new AbortController();
      RUNNING.set(sessionId, abort);
      // @ts-ignore EdgeRuntime is provided by Supabase functions runtime
      EdgeRuntime.waitUntil(runBridge({ sessionId, username, abort }));

      return new Response(JSON.stringify({ ok: true, status: "connecting" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "disconnect") {
      RUNNING.get(sessionId)?.abort();
      RUNNING.delete(sessionId);
      await admin.from("tiktok_connections").update({
        status: "disconnected",
        last_error: null,
        updated_at: new Date().toISOString(),
      }).eq("session_id", sessionId);
      return new Response(JSON.stringify({ ok: true, status: "disconnected" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "status") {
      const { data } = await admin.from("tiktok_connections")
        .select("*").eq("session_id", sessionId).maybeSingle();
      return new Response(JSON.stringify({ ok: true, connection: data || null }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: false, error: "unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("tiktok-chat error:", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
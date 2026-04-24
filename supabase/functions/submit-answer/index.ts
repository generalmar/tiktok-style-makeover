// PUBLIC endpoint — accepts answers from chat (simulator or future TikTok webhook).
// Validates round is still live, enforces first-answer-locking via UNIQUE constraint.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Body {
  round_id: string;
  viewer_handle: string;
  viewer_display_name?: string;
  raw_text: string; // raw chat message — we parse A/B/C/D from it
}

const CHOICE_REGEX = /\b([abcdABCD])\b/;

function parseChoice(raw: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  // Try first char match
  const first = trimmed[0]?.toUpperCase();
  if (["A", "B", "C", "D"].includes(first)) return first;
  const m = trimmed.match(CHOICE_REGEX);
  if (m) return m[1].toUpperCase();
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const body = (await req.json()) as Body;
    const handle = String(body.viewer_handle || "").trim().slice(0, 80);
    const round_id = String(body.round_id || "");
    const choice = parseChoice(String(body.raw_text || ""));

    if (!handle || !round_id || !choice) {
      return new Response(JSON.stringify({ ok: false, reason: "invalid_input" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify round is live and not past closes_at
    const { data: round } = await admin.from("rounds").select("*").eq("id", round_id).maybeSingle();
    if (!round || round.status !== "live") {
      return new Response(JSON.stringify({ ok: false, reason: "round_not_live" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (round.closes_at && new Date(round.closes_at) < new Date()) {
      return new Response(JSON.stringify({ ok: false, reason: "round_expired" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error } = await admin.from("answers").insert({
      round_id,
      session_id: round.session_id,
      viewer_handle: handle,
      viewer_display_name: body.viewer_display_name || handle,
      choice,
    });

    if (error) {
      // unique_violation = first-answer-locked already
      if ((error as any).code === "23505") {
        return new Response(JSON.stringify({ ok: false, reason: "already_answered" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw error;
    }

    return new Response(JSON.stringify({ ok: true, choice }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("submit-answer error:", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

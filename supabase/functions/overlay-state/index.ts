import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    if (!token) throw new Error("token required");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: session, error: sErr } = await admin
      .from("sessions").select("*").eq("overlay_token", token).maybeSingle();
    if (sErr) throw sErr;
    if (!session) {
      return new Response(JSON.stringify({ error: "Session not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [{ data: round }, { data: scores }, { data: seated }] = await Promise.all([
      admin.from("rounds").select("*, questions(*)")
        .eq("session_id", session.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      admin.from("session_scores").select("*")
        .eq("session_id", session.id).order("score", { ascending: false }).limit(10),
      admin.from("session_questions").select("id, played")
        .eq("session_id", session.id),
    ]);

    const total = seated?.length ?? 0;
    const played = seated?.filter((s) => s.played).length ?? 0;

    return new Response(JSON.stringify({
      session: {
        id: session.id,
        name: session.name,
        status: session.status,
        question_duration_seconds: session.question_duration_seconds,
        tts_voice_id: (session as any).tts_voice_id ?? null,
      },
      round: round ? {
        id: round.id,
        status: round.status,
        duration_seconds: round.duration_seconds,
        started_at: round.started_at,
        closes_at: round.closes_at,
        reading_until: (round as any).reading_until ?? null,
        resolved_at: round.resolved_at,
        question: (round as any).questions ? {
          text: (round as any).questions.text,
          choices: (round as any).questions.choices,
          correct_choice: round.status === "resolved" ? (round as any).questions.correct_choice : null,
          category: (round as any).questions.category,
        } : null,
      } : null,
      scores: scores || [],
      progress: { played, total },
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("overlay-state error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

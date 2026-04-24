import { corsHeaders } from "@supabase/supabase-js/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

type Action = "start" | "close" | "resolve";

interface Body {
  action: Action;
  session_id: string;
  question_id?: string; // required for "start"
  round_id?: string; // required for close/resolve
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: u } = await userClient.auth.getUser();
    const user = u?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const body = (await req.json()) as Body;

    // Verify session ownership
    const { data: session, error: sErr } = await admin
      .from("sessions").select("*").eq("id", body.session_id).single();
    if (sErr || !session) throw new Error("Session not found");
    if (session.owner_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.action === "start") {
      if (!body.question_id) throw new Error("question_id required");
      // Close any currently-live round in this session
      await admin.from("rounds").update({ status: "closed" })
        .eq("session_id", body.session_id).eq("status", "live");

      const duration = session.question_duration_seconds || 25;
      const now = new Date();
      const closes = new Date(now.getTime() + duration * 1000);

      const { data: round, error } = await admin.from("rounds").insert({
        session_id: body.session_id,
        question_id: body.question_id,
        status: "live",
        duration_seconds: duration,
        started_at: now.toISOString(),
        closes_at: closes.toISOString(),
      }).select().single();
      if (error) throw error;

      // Mark session active
      await admin.from("sessions").update({ status: "active" }).eq("id", body.session_id);
      // Mark session_question played
      await admin.from("session_questions").update({ played: true })
        .eq("session_id", body.session_id).eq("question_id", body.question_id);

      return new Response(JSON.stringify({ round }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.action === "close") {
      if (!body.round_id) throw new Error("round_id required");
      const { data: round, error } = await admin.from("rounds")
        .update({ status: "closed" }).eq("id", body.round_id).select().single();
      if (error) throw error;
      return new Response(JSON.stringify({ round }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.action === "resolve") {
      if (!body.round_id) throw new Error("round_id required");

      // Load round + question
      const { data: round, error: rErr } = await admin.from("rounds")
        .select("*, questions(*)").eq("id", body.round_id).single();
      if (rErr || !round) throw new Error("Round not found");

      const correct = (round as any).questions?.correct_choice as string;

      // Mark answers correct/incorrect
      const { data: allAnswers } = await admin.from("answers")
        .select("*").eq("round_id", body.round_id);

      if (allAnswers && allAnswers.length > 0) {
        // Update is_correct (batch via individual updates is ok for reasonable sizes;
        // for large rooms, prefer SQL RPC. Keeping simple here.)
        const correctIds = allAnswers.filter(a => a.choice === correct).map(a => a.id);
        const wrongIds = allAnswers.filter(a => a.choice !== correct).map(a => a.id);
        if (correctIds.length > 0) {
          await admin.from("answers").update({ is_correct: true }).in("id", correctIds);
        }
        if (wrongIds.length > 0) {
          await admin.from("answers").update({ is_correct: false }).in("id", wrongIds);
        }

        // Upsert leaderboard rows
        // Aggregate per viewer
        const agg = new Map<string, { display: string | null; correct: number; total: number }>();
        for (const a of allAnswers) {
          const cur = agg.get(a.viewer_handle) || { display: a.viewer_display_name, correct: 0, total: 0 };
          cur.total += 1;
          if (a.choice === correct) cur.correct += 1;
          agg.set(a.viewer_handle, cur);
        }

        for (const [handle, v] of agg.entries()) {
          // Read current
          const { data: existing } = await admin.from("session_scores")
            .select("*").eq("session_id", round.session_id).eq("viewer_handle", handle).maybeSingle();
          if (existing) {
            await admin.from("session_scores").update({
              score: existing.score + v.correct,
              correct_count: existing.correct_count + v.correct,
              answer_count: existing.answer_count + v.total,
              viewer_display_name: v.display ?? existing.viewer_display_name,
              updated_at: new Date().toISOString(),
            }).eq("id", existing.id);
          } else {
            await admin.from("session_scores").insert({
              session_id: round.session_id,
              viewer_handle: handle,
              viewer_display_name: v.display,
              score: v.correct,
              correct_count: v.correct,
              answer_count: v.total,
            });
          }
        }
      }

      const { data: resolved, error: resErr } = await admin.from("rounds")
        .update({ status: "resolved", resolved_at: new Date().toISOString() })
        .eq("id", body.round_id).select().single();
      if (resErr) throw resErr;

      return new Response(JSON.stringify({ round: resolved, correct_choice: correct }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Unknown action");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("round-control error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

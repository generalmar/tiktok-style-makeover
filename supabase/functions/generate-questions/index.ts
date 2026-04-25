import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GenerateBody {
  topic: string;
  count: number;
  difficulty: "easy" | "medium" | "hard";
  category?: string;
  account_id?: string | null;
}

const SYSTEM_PROMPT = `You generate multiple-choice trivia questions for a TikTok Live game.
Always return exactly the requested count. Each question must have 4 choices labeled A, B, C, D and exactly ONE correct answer.
Keep questions concise (max 140 chars) and choices short (max 60 chars). Avoid offensive or unsafe content.`;

const TOOL = {
  type: "function",
  function: {
    name: "emit_questions",
    description: "Emit the generated trivia questions",
    parameters: {
      type: "object",
      properties: {
        questions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              text: { type: "string" },
              choices: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    key: { type: "string", enum: ["A", "B", "C", "D"] },
                    text: { type: "string" },
                  },
                  required: ["key", "text"],
                  additionalProperties: false,
                },
              },
              correct_choice: { type: "string", enum: ["A", "B", "C", "D"] },
              category: { type: "string" },
              difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
            },
            required: ["text", "choices", "correct_choice", "category", "difficulty"],
            additionalProperties: false,
          },
        },
      },
      required: ["questions"],
      additionalProperties: false,
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const body = (await req.json()) as GenerateBody;
    const count = Math.max(1, Math.min(10, Number(body.count) || 5));
    const difficulty = ["easy", "medium", "hard"].includes(body.difficulty) ? body.difficulty : "medium";
    const topic = String(body.topic || "general knowledge").slice(0, 200);
    const category = String(body.category || topic).slice(0, 60);

    const userPrompt = `Generate ${count} ${difficulty} trivia questions about: ${topic}. Use category "${category}".`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "emit_questions" } },
      }),
    });

    if (aiRes.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit hit. Please try again shortly." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiRes.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in Lovable workspace settings." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiRes.ok) {
      const text = await aiRes.text();
      throw new Error(`AI gateway error ${aiRes.status}: ${text}`);
    }

    const ai = await aiRes.json();
    const toolCall = ai?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("AI did not return a tool call");
    const args = JSON.parse(toolCall.function.arguments);
    const generated: any[] = args.questions || [];

    // Insert into DB
    const accountId = body.account_id || null;
    const rows = generated.map((q) => ({
      text: q.text,
      choices: q.choices,
      correct_choice: q.correct_choice,
      difficulty: q.difficulty || difficulty,
      category: q.category || category,
      source: "ai",
      account_id: accountId,
    }));

    const { data: inserted, error } = await supabase.from("questions").insert(rows).select();
    if (error) throw error;

    return new Response(JSON.stringify({ questions: inserted }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("generate-questions error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

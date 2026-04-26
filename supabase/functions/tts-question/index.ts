// Reads a question aloud using ElevenLabs TTS.
// Returns base64-encoded MP3 in JSON for easy client playback via data URI.
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_VOICES = new Set([
  "EXAVITQu4vr4xnSDxMaL", // Sarah
  "JBFqnCBsd6RMkjVDRZzb", // George
  "TX3LPaxmHKxFdv7VOQHJ", // Liam
  "Xb7hH8MSUJpSbSDYk0k2", // Alice
  "cgSgspJ2msm6clMCkdW9", // Jessica
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
    if (!apiKey) throw new Error("ELEVENLABS_API_KEY is not configured");

    const body = await req.json().catch(() => ({}));
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    let voiceId = typeof body?.voice_id === "string" ? body.voice_id : "EXAVITQu4vr4xnSDxMaL";
    if (!ALLOWED_VOICES.has(voiceId)) voiceId = "EXAVITQu4vr4xnSDxMaL";
    if (!text || text.length > 600) {
      return new Response(JSON.stringify({ error: "text required (≤600 chars)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const r = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_turbo_v2_5",
          voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true },
        }),
      },
    );

    if (!r.ok) {
      const errText = await r.text();
      throw new Error(`ElevenLabs ${r.status}: ${errText}`);
    }

    const buf = await r.arrayBuffer();
    const audio = base64Encode(new Uint8Array(buf));

    return new Response(JSON.stringify({ audio, mime: "audio/mpeg" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("tts-question error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

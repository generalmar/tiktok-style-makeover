export interface VoiceOption {
  id: string;
  name: string;
  description: string;
}

// Curated 5 ElevenLabs voices (pre-made library voices)
export const VOICES: VoiceOption[] = [
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", description: "Warm · Female · US" },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George", description: "Deep · Male · UK" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam", description: "Energetic · Male · US" },
  { id: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice", description: "Clear · Female · UK" },
  { id: "cgSgspJ2msm6clMCkdW9", name: "Jessica", description: "Expressive · Female · US" },
];

export const DEFAULT_VOICE_ID = VOICES[0].id;

export const getVoiceName = (id: string | null | undefined): string => {
  if (!id) return "Default";
  return VOICES.find((v) => v.id === id)?.name ?? "Default";
};

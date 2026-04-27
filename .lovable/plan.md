## Root cause

`useQuestionTTS` only plays audio for the **first** round successfully. On subsequent rounds (auto-advance or manual "Next"), the UI shows "Reading…" but no sound is heard.

The cause is **browser autoplay blocking**, not a fetch/state bug:

1. Round 1 plays because the user just clicked "Create session" / "Start round" — that gesture grants autoplay permission for that single playback context.
2. The hook creates a brand-new `new Audio(url)` element for every round (lines 47–49 of `src/hooks/use-question-tts.ts`). Each new element has **no prior gesture association**.
3. For round 2+, audio is fetched asynchronously and `audio.play()` is called long after the gesture — Chrome/Safari reject it silently (the hook even has a `.catch(() => {})` swallowing the error).
4. The "Reading question…" indicator still shows because it's driven by `reading_until` in the DB, independent of whether audio actually played.

The Overlay page has the same bug (it never has a user gesture at all on a typical OBS browser source — but that's a separate, accepted limitation).

## Fix

Unlock audio on the first user gesture, then reuse a single primed `HTMLAudioElement` for every subsequent round.

### 1. `src/hooks/use-question-tts.ts` — rewrite playback layer

- Create a **module-level singleton** `HTMLAudioElement` (one per tab) instead of `new Audio(...)` per round.
- Add an `unlockAudio()` helper that, on the first user gesture, calls `audio.play()` on a tiny silent MP3 / sets `audio.muted=true; audio.play(); audio.pause(); audio.muted=false`. This "primes" the element so all future `.play()` calls (even from async code) are allowed.
- Auto-attach a one-time `pointerdown`/`keydown`/`click` listener on `window` from the hook so unlock happens transparently the first time the operator interacts with the page.
- For each round, set `audio.src = dataUri; audio.play()` on the same primed element.
- Keep the per-round dedupe (`playedRef` + `sessionStorage`) so a round isn't read twice on remount.
- If `play()` still rejects (e.g. Overlay loaded with no gesture), surface a small toast on the GameStage telling the operator to "Click anywhere to enable voice" — handled via a callback prop or a shared event.

### 2. `src/components/GameStage.tsx` — guarantee a gesture before round 1

- In `createSession` and the manual "Start / Next" button handlers, call the new `primeAudio()` helper exported from the hook **synchronously inside the click handler** (before any `await`). This guarantees the audio element is unlocked even if the operator never clicks anywhere else.
- No other logic changes; auto-advance will then work because the singleton element stays primed for the whole tab session.

### 3. `src/pages/Overlay.tsx` — best-effort prime

- Add a one-time invisible "Click to enable sound" overlay that disappears on first click (only rendered until audio is primed). OBS users typically interact once when setting up the source; after that it stays primed.
- Skip if the operator is OK with overlay being silent (the operator dashboard is the primary audio source); confirm during implementation.

### 4. Light hardening

- Log (not swallow) `play()` rejections to console with a clear prefix so future debugging is easier.
- Wait for `audio.canplay` (or use `await audio.play()` with try/catch) before allowing the round timer to assume reading has begun. The `reading_until` server estimate already covers timing, so no DB change needed.

## Files touched

- `src/hooks/use-question-tts.ts` — singleton audio element + unlock logic + exported `primeAudio()`
- `src/components/GameStage.tsx` — call `primeAudio()` inside the create/start/next click handlers
- `src/pages/Overlay.tsx` — one-time "click to enable sound" prompt that calls `primeAudio()`

## Out of scope

- No DB migrations.
- No edge-function changes (`tts-question` and `round-control` already work — round 1 proves it).
- No changes to voice selection, distribution, or leaderboard logic.

## Verification

After the change:
1. Create a session with 3+ questions and auto-advance ON.
2. Confirm round 1, 2, 3 all play audio with the selected voice.
3. Toggle auto-advance OFF, click "Next" — voice still plays.
4. Switch voice mid-session — next round uses the new voice.

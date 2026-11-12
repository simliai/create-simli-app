# Create Simli App

A starter for a talking AI avatar you can speak with, built with Next.js and [Simli](https://simli.com).
You talk, and a Simli avatar answers with a lip-synced face and voice in real time.

```
browser mic ──► server ──► Deepgram (speech-to-text, nova-3)
                        ──► OpenAI (reply, streamed)
                        ──► ElevenLabs (text-to-speech, PCM 16 kHz)
            ◄── audio ──┘
browser ──► Simli (sendAudioData) ──► avatar video + voice
```

- `server.ts` is a custom Next.js server. It serves the app, mints Simli session tokens
  (`POST /api/session`) and runs the voice pipeline over a WebSocket (`/ws`) on the same origin.
  All API keys stay on the server.
- `app/AvatarInteraction.tsx` starts the Simli session, streams the microphone to the server and
  passes the reply audio to Simli. Only Simli's in-sync audio is played.
- `server/conversation.ts` holds the pipeline: turn detection, barge-in, LLM and TTS streaming.
- `server/config.ts` holds the avatar's persona (system prompt and greeting) and reads the environment.

Simli docs: https://docs.simli.com

## Setup

Requirements: Node.js 20.9 or newer, and accounts with [Simli](https://app.simli.com),
[Deepgram](https://console.deepgram.com), [OpenAI](https://platform.openai.com) and
[ElevenLabs](https://elevenlabs.io) (streaming text-to-speech needs a paid ElevenLabs plan).

```bash
npm install
cp .env.example .env   # then fill in the four API keys
npm run dev            # http://localhost:3000
```

Open http://localhost:3000, click **Test Interaction**, allow the microphone, and wait for the avatar
to greet you. Use headphones if the avatar keeps interrupting itself (its voice reaching your mic).

If a key is missing, the server refuses to start and lists which variables to set. Log lines and errors
are sanitized: provider errors are reduced to a message, and the configured keys are scrubbed from logs.

In development the server listens on 127.0.0.1 only (set `HOST` to change that).

If you want to try Simli but don't have API access to these third parties, ask in
[Discord](https://discord.gg/yQx49zNF4d) and we can help.

### Environment variables

| Variable | Required | Default | What it is |
|---|---|---|---|
| `SIMLI_API_KEY` | yes | | From https://app.simli.com |
| `DEEPGRAM_API_KEY` | yes | | From https://console.deepgram.com |
| `OPENAI_API_KEY` | yes | | From https://platform.openai.com/api-keys |
| `ELEVENLABS_API_KEY` | yes | | From https://elevenlabs.io/app/settings/api-keys |
| `SIMLI_FACE_ID` | | `14c60d62-…` (Simli's default Trinity-2 face) | Avatar face: a [preset](https://docs.simli.com/api-reference/preset-faces) or your own from the dashboard |
| `ELEVENLABS_VOICE_ID` | | `cgSgspJ2msm6clMCkdW9` (Jessica, female) | ElevenLabs voice. Match it to the face |
| `ELEVENLABS_MODEL_ID` | | `eleven_flash_v2_5` | ElevenLabs model (low latency) |
| `OPENAI_MODEL` | | `gpt-6-luna` | OpenAI model |
| `OPENAI_REASONING_EFFORT` | | `none` | `none` for fastest replies; `off` for models without reasoning |
| `DEEPGRAM_MODEL` / `DEEPGRAM_LANGUAGE` | | `nova-3` / `en` | Speech-to-text model and language |
| `PORT` | | `3000` | Server port |
| `HOST` | | `127.0.0.1` in dev, all interfaces in production | Interface to listen on |
| `ALLOWED_ORIGINS` | in production | `http://localhost:$PORT` | Comma-separated origins allowed to call the API and WebSocket |
| `ALLOW_UNAUTHENTICATED_SESSIONS` | | `false` | Production refuses to start sessions until you add auth; `true` overrides that for a private test |
| `MAX_CONCURRENT_SESSIONS` | | `5` | Sessions the server allows at once |
| `MAX_SESSIONS_PER_IP` | | `2` | Sessions one client (IPv4 address or IPv6 /64) may hold at once |
| `LOG_TRANSCRIPTS` | | on in dev, off in production | Log what the user and the avatar say |
| `SIMLI_MAX_SESSION_LENGTH` / `SIMLI_MAX_IDLE_TIME` | | `600` / `180` | Simli session bounds in seconds |

Never put a key in a `NEXT_PUBLIC_` variable: those are bundled into the browser. The server refuses to
start if it finds one. Earlier versions of this repo used `NEXT_PUBLIC_SIMLI_API_KEY`: rename it to `SIMLI_API_KEY`,
and **rotate that key** in the Simli dashboard, because it was readable by anyone who loaded the page.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server with hot reload (`tsx server.ts`) |
| `npm run build` | Production build of the Next.js app |
| `npm start` | Production server (`NODE_ENV=production tsx server.ts`), after `npm run build` |
| `npm run lint` | ESLint |
| `npm run typecheck` | Generates Next.js types, then runs `tsc --noEmit` |

## Make it yours

- **Face:** set `SIMLI_FACE_ID`. Pick a [preset](https://docs.simli.com/api-reference/preset-faces) or create
  your own avatar from a photo at https://app.simli.com.
- **Voice:** set `ELEVENLABS_VOICE_ID`, and pick a voice that matches the face. The default face
  (`14c60d62-6ebf-424d-b626-1f4f91c33b04`, Simli's default Trinity-2 face) is a woman, so the default voice is
  the female premade voice Jessica. If you change the face, check the voice still fits.
- **Persona and greeting:** edit `SYSTEM_PROMPT` and `GREETING` in `server/config.ts`.
- **Video shape:** the avatar streams 16:9 at 1366x768 (Trinity-2's full frame) to fit the player. For a
  square layout, set `streaming_width: 768, streaming_height: 768` in `server.ts` and change `aspect-video` to
  `aspect-square` in `app/components/VideoBox.tsx` and `app/components/DottedFace.tsx` (they must match). See
  [Trinity-2 framing](https://docs.simli.com/api-reference/trinity-2).

### Other STT, LLM and TTS providers

You can swap any of the three services. Simli only needs the reply audio as raw PCM16, 16 kHz, mono
(little-endian, no header), sent with `sendAudioData` in chunks. If your TTS outputs another format or
sample rate, convert it first. See https://docs.simli.com for details, or ask in Discord.

## How a conversation works

1. The browser asks for the microphone, then gets a Simli session token from `POST /api/session` and starts
   the avatar (`SimliClient.start()`).
2. Only once the avatar is on screen does the browser open the `/ws` WebSocket, so the greeting isn't lost.
   The server speaks the greeting right away.
3. The microphone is streamed as PCM16 16 kHz to Deepgram. When Deepgram detects the end of an utterance
   (`endpointing` / `UtteranceEnd`), the text goes to OpenAI, and the streamed reply goes sentence by sentence
   to ElevenLabs. Its audio is forwarded to the browser and into Simli.
4. **Barge-in:** when you start talking while the avatar speaks, the server cancels the LLM and TTS requests
   and tells the browser to call `ClearBuffer()`, so the avatar stops mid-sentence.
5. Ending any part ends everything: the Stop button, Simli's `maxSessionLength` / `maxIdleTime`, a server
   error, closing the tab.

## Security and production checklist

This starter is safe to run locally, but **`/api/session` and `/ws` are not authenticated**. In production
the server therefore refuses to start sessions (403) until you add authentication, or set
`ALLOW_UNAUTHENTICATED_SESSIONS=true` for a private test.

A Simli session token from `/api/session` can start a Simli session on its own, without this server, and
the voice pipeline spends Deepgram, OpenAI and ElevenLabs credits. **Per-user authentication is the only
real bound on spending.** What is built in:

- All keys are server-only; the browser gets a short-lived Simli session token. Logs never contain raw
  provider error objects (which can include request headers), and known key values are scrubbed.
- `/api/session` and `/ws` accept only requests whose `Origin` is in `ALLOWED_ORIGINS`.
- `/ws` needs a one-time ticket from `/api/session` (valid 60 s, single use).
- Concurrency is counted from the moment a token is issued, not when `/ws` opens: at most
  `MAX_CONCURRENT_SESSIONS` overall and `MAX_SESSIONS_PER_IP` per client (IPv4 address or IPv6 /64). A slot
  is released when the conversation ends, or 60 s after issue if `/ws` is never opened (the Simli token itself
  may still be used until `SIMLI_MAX_SESSION_LENGTH`).
- Session requests are rate limited per client (token bucket: 5, refilled at 5 per minute).
- Per conversation: 64 KB max WebSocket message, binary frames only, mic audio capped at 64 KB/s (2x real
  time), closed after 15 s without audio frames or 60 s without speech (silence doesn't keep a slot), closed if
  the browser stops reading, and ended at `SIMLI_MAX_SESSION_LENGTH`.
- Simli sessions are bounded by `maxSessionLength` and `maxIdleTime`.
- Security headers on every response: `Content-Security-Policy: frame-ancestors 'self'`,
  `Permissions-Policy: microphone=(self), camera=()`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`; no `X-Powered-By`.
- Production returns generic error messages; details go to the server log only.

All limits are in memory: they reset on restart and don't work across several instances.

### Before you deploy

- [ ] **Add authentication.** Check the signed-in user in `handleSessionRequest()` in `server.ts` (marked
      `TODO`), then remove `ALLOW_UNAUTHENTICATED_SESSIONS`. Origin checks stop other websites, not scripts.
- [ ] **Add real rate limiting** per user, at your platform or with a shared store. Behind a proxy,
      `clientKey()` in `server/security.ts` sees the proxy's address: use your platform's client-IP header.
- [ ] Set `ALLOWED_ORIGINS` to your site's `https://` origin, and serve over HTTPS (the microphone needs a
      secure context).
- [ ] Set spending limits and usage alerts with Simli, Deepgram, OpenAI and ElevenLabs.
- [ ] If a key was ever in a `NEXT_PUBLIC_` variable (or committed anywhere), rotate it.
- [ ] Keep `.env` out of git (it's in `.gitignore`); use your host's secret settings.
- [ ] Leave `LOG_TRANSCRIPTS` off unless you have a reason (and consent) to keep conversation text in logs.
- [ ] Hosting: this app needs a long-running Node.js server with WebSocket support (for example a VM,
      container, Fly.io, Render or Railway). Serverless platforms such as Vercel can't host the custom server.

## Using a coding agent?

This repo includes the Simli agent skill in `.agents/skills/simli` (linked at `.claude/skills/simli` for
Claude Code), so coding agents know how to use Simli correctly: tokens, audio format, interruptions,
framing and troubleshooting. To install it in another project, run `npx skills add simliai/skills`.

## Links

[Simli](https://simli.com) · [Simli docs](https://docs.simli.com) · [Deepgram](https://deepgram.com) ·
[OpenAI](https://platform.openai.com) · [ElevenLabs](https://elevenlabs.io) · [Discord](https://discord.gg/yQx49zNF4d)

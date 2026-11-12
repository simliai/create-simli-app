# Create Simli App

A real-time voice agent with a face. [Deepgram](https://deepgram.com) hears you, [OpenAI](https://platform.openai.com) answers, [ElevenLabs](https://elevenlabs.io) speaks, and [Simli](https://www.simli.com) gives it a lip-synced Trinity-2 avatar. [LiveKit Agents](https://docs.livekit.io/agents/) runs the pipeline: it moves the audio, decides when you've finished speaking, and stops the avatar when you interrupt it.

It's one Python file, plus a small web page to talk to it. You need keys for Simli, LiveKit, Deepgram, OpenAI and ElevenLabs.

Want a single speech-to-speech model instead of three providers? See [create-simli-app-livekit-agents](https://github.com/simliai/create-simli-app-livekit-agents) (OpenAI Realtime). Prefer Pipecat? See [create-simli-app-pipecat](https://github.com/simliai/create-simli-app-pipecat).

## What's in here

- **[`agent.py`](agent.py)**: the agent. Deepgram (`nova-3`) turns your speech into text, OpenAI (`gpt-6-luna`) writes the reply, and ElevenLabs (`eleven_flash_v2_5`) speaks it. The agent sends that voice to a Simli avatar in the same LiveKit room, and the avatar publishes lip-synced video and voice for the agent.
- **[`frontend/`](frontend)**: a Next.js page to talk to the avatar in your browser. [`app/api/token/route.ts`](frontend/app/api/token/route.ts) mints a LiveKit token that dispatches the agent, and [`app/components/AvatarCall.tsx`](frontend/app/components/AvatarCall.tsx) joins the room, publishes your mic and shows the avatar.

## Setup

You need [uv](https://docs.astral.sh/uv/) for Python, [Node.js](https://nodejs.org) 20.9 or later for the page, and these keys:

- [Simli](https://app.simli.com) (free plan included)
- [LiveKit Cloud](https://cloud.livekit.io): a project's URL, API key and API secret, from its settings.
- [Deepgram](https://console.deepgram.com) for speech-to-text
- [OpenAI](https://platform.openai.com/api-keys) for the replies
- [ElevenLabs](https://elevenlabs.io/app/settings/api-keys) for the voice

`LIVEKIT_URL` must be a LiveKit server reachable from the internet: LiveKit Cloud, or a self-hosted server with a public address. Simli's servers join the room, so a LiveKit server running locally on your machine won't work.

```bash
git clone https://github.com/simliai/create-simli-app
cd create-simli-app
uv sync
cp .env.example .env                          # then paste in your keys
cp frontend/.env.example frontend/.env.local  # then copy in the same three LIVEKIT_ values
```

All the provider keys live in `.env`, which only the agent reads. The page's API route reads the LiveKit key and secret on the server; no key reaches the browser.

Prefer pip? With Python 3.10 to 3.14:

```bash
python -m venv .venv && source .venv/bin/activate
pip install livekit-agents==1.8.11 livekit-plugins-deepgram==1.8.11 livekit-plugins-elevenlabs==1.8.11 livekit-plugins-openai==1.8.11 livekit-plugins-simli==1.8.11 python-dotenv==1.2.4
```

Then use `python agent.py ...` wherever this README says `uv run agent.py ...`.

## Run it

1. Start the agent: `uv run agent.py dev` (or `python agent.py dev` with pip).
2. In a second terminal, start the page: `cd frontend && npm install && npm run dev`
3. Open http://localhost:3000, click **Start** and allow the microphone. The avatar greets you once it's ready. **End** leaves the room.

`npm run dev` listens on 127.0.0.1 only, so other machines on your network can't open the page and start sessions on your keys. To try it from another device, expose it deliberately (for example `npx next dev -H 0.0.0.0`), and only on a network you trust.

The agent registers as `simli-pipeline-agent` and only joins rooms whose token dispatches it by that name, as the page's token does. That explicit dispatch matters because a LiveKit project can have other agents deployed (for example the OpenAI Realtime starter, as `simli-agent`) that would otherwise join every room. To rename it, set `LIVEKIT_AGENT_NAME` in both `.env` and `frontend/.env.local`.

Alternatively, talk to it from LiveKit's [Agents Playground](https://agents-playground.livekit.io): connect it to your project and set **Agent name** to `simli-pipeline-agent`.

`uv run agent.py console` talks to the agent in your terminal instead. It is voice only: console mode has no LiveKit room, so there is no avatar. It needs a microphone (and PortAudio on Linux).

`uv run agent.py dev` shows debug logs; restart it after code changes. livekit-agents 1.8 marks the `dev` and `console` subcommands as deprecated, and `dev` no longer reloads on changes. The [LiveKit CLI](https://docs.livekit.io/agents/server/startup-modes/) (2.18.8 or later) runs the same `agent.py` with `lk agent dev` and `lk agent console`.

## Make it yours

Everything for the agent is near the top of [`agent.py`](agent.py), and the common changes are environment variables in `.env`:

- **Face:** any Trinity-2 face ID in `SIMLI_FACE_ID`. The default is Simli's default Trinity-2 face (`14c60d62-6ebf-424d-b626-1f4f91c33b04`). Pick a [preset](https://docs.simli.com/api-reference/preset-faces) or [make your own from a photo](https://app.simli.com).
- **Voice:** any voice from your ElevenLabs voice library in `ELEVENLABS_VOICE_ID`. The default is the premade voice "Jessica" (`cgSgspJ2msm6clMCkdW9`). Match the voice to the face: the default face is a woman, and Jessica is a female voice. The TTS model, `eleven_flash_v2_5`, is ElevenLabs' lowest-latency one.
- **Model:** `OPENAI_MODEL`, default `gpt-6-luna`, OpenAI's most efficient chat model. Reasoning is off (`reasoning_effort="none"`), because it adds seconds before the first word; `OPENAI_REASONING_EFFORT` changes that. For a model without reasoning support (for example `gpt-4.1-mini`), set `OPENAI_REASONING_EFFORT=off`.
- **Speech-to-text:** `deepgram.STT(model="nova-3", language="en")` in `build_session()`. For other languages, change `language` (or use `"multi"`) and the prompt.
- **Framing:** the video is 16:9 at 1366x768, Trinity-2's full frame, with the avatar at the bottom centre. In the `SimliConfig` in `agent.py` you can change the size (1:1 and 9:16 work too), move the avatar, start the [camera](https://docs.simli.com/api-reference/trinity-2/camera) elsewhere, or add your own [background or foreground](https://docs.simli.com/api-reference/trinity-2/backgrounds). See [Framing the video](https://docs.simli.com/api-reference/trinity-2#framing-the-video).
- **Prompt and greeting:** `INSTRUCTIONS` and the `generate_reply` call.
- **Session limits:** the avatar leaves after 10 minutes (`max_session_length`) or 5 minutes without speaking (`max_idle_time`), and the session ends with it.
- **Other providers and tools:** it's a regular LiveKit agent, so any [STT, LLM or TTS plugin](https://docs.livekit.io/agents/models/) can replace these three, and everything in the [LiveKit Agents docs](https://docs.livekit.io/agents/) applies.

The page is [`frontend/app/page.tsx`](frontend/app/page.tsx) (layout and text) and [`frontend/app/components/AvatarCall.tsx`](frontend/app/components/AvatarCall.tsx) (the call). It uses [livekit-client](https://docs.livekit.io/reference/client-sdk-js/) directly; for transcripts, agent state and more, see LiveKit's [agent-starter-react](https://github.com/livekit-examples/agent-starter-react).

## How it works

1. You click **Start**. The page's API route makes up a room name and signs a token that lets you join that room and dispatches `simli-pipeline-agent` to it. Joining creates the room, and LiveKit sends the agent there.
2. The agent connects and starts the avatar. The [Simli plugin](https://docs.livekit.io/agents/models/avatar/plugins/simli/) sends the face and framing to Simli, and Simli's avatar joins the room.
3. The agent waits until the avatar is publishing video. Only then does it start listening and greet you, so its first words aren't lost.
4. LiveKit Agents runs the conversation. Your mic goes to Deepgram as a stream; Silero voice activity detection and LiveKit's [turn detector](https://docs.livekit.io/agents/logic/turns/turn-detector/) decide when you've finished your turn; the transcript goes to OpenAI, and its reply streams into ElevenLabs as it is written. If you talk over the avatar, the agent stops its reply.
5. The agent streams ElevenLabs' voice to the avatar over LiveKit. The avatar publishes lip-synced video and voice on the agent's behalf, under its own identity; the page plays whichever remote video and audio tracks arrive.
6. The avatar's session ends with the agent's. When you leave, or the avatar reaches its time limits, the agent deletes the room to tidy up, so everyone leaves at once. If the agent itself stops mid-call, its avatar leaves with it. Either way the page returns to its start screen.

Silero VAD and the turn detector are built into livekit-agents 1.8, so there are no extra plugins or model downloads. The turn detector runs a small model on the agent's CPU under `start`. Under `dev` it uses the full model on [LiveKit Inference](https://docs.livekit.io/agents/models/inference/), which authenticates with your LiveKit project's keys (usage past the monthly development allowance is billed on paid LiveKit plans), and falls back to the local model if that's unavailable.

## Before you go to production

Anyone who can join a room in your LiveKit project starts a conversation, which uses your Simli minutes and your Deepgram, OpenAI and ElevenLabs credit. The page's `/api/token` route has no login, so anyone who can reach the page could mint a token. That's why a production build (`npm run build` + `npm start`, or any deployed host) refuses with `403` until you change it. Add your own login and rate limiting where the `TODO` in [`app/api/token/route.ts`](frontend/app/api/token/route.ts) says.

For a demo or an internal network only, `ALLOW_UNAUTHENTICATED_SESSIONS=true` in `frontend/.env.local` (or your host's environment) turns the check off: anyone who can reach the page can then start sessions on your keys. Don't set it on a public deployment.

Each token is valid for 2 minutes, for one new room of at most 3 participants (you, the agent and its avatar), and only lets the user publish their microphone. To deploy the agent, run `uv run agent.py start` on any server, or see [LiveKit's deployment guide](https://docs.livekit.io/deploy/agents/). The page builds with `npm run build` and runs with `npm start`, or deploys to any Next.js host.

## Using a coding agent?

This repo includes the [Simli agent skill](https://github.com/simliai/skills) in `.agents/skills/simli` (linked from `.claude/skills/simli`), so Claude Code, Codex, Cursor and other agents that support skills know how to change the face, framing, camera and prompt, and how to fix common errors. To add it to another project: `npx skills add simliai/skills`.

## Troubleshooting

- **`the Simli avatar didn't start`:** the Simli error logged just before it says why. `401` means `SIMLI_API_KEY` is wrong. `400` means the face ID wasn't found. `429` means your Simli account is already running as many sessions as it can.
- **`the Simli avatar didn't join the room`:** usually Simli couldn't reach your LiveKit server. `LIVEKIT_URL` must be reachable from the internet (see [Setup](#setup)).
- **The page says the avatar didn't join:** check that `uv run agent.py dev` is running, that both `.env` files hold the same `LIVEKIT_*` values, and that `LIVEKIT_AGENT_NAME` matches if you set it.
- **The avatar appears but never speaks:** look for a Deepgram, OpenAI or ElevenLabs error in the agent's logs. A `KeyError: 'ELEVENLABS_API_KEY'` means it's missing from `.env`. An OpenAI error about `reasoning_effort` means your `OPENAI_MODEL` doesn't support reasoning: set `OPENAI_REASONING_EFFORT=off`. An ElevenLabs `401` or quota error means the key is wrong or the plan doesn't cover API streaming.
- **The avatar keeps interrupting itself:** its voice is reaching your mic. Use headphones.

## More

- [Simli docs](https://docs.simli.com) and [all starters](https://docs.simli.com/api-reference/samples/all-samples)
- Source: https://github.com/simliai/create-simli-app
- Sibling starters: https://github.com/simliai/create-simli-app-livekit-agents and https://github.com/simliai/create-simli-app-pipecat
- Questions? Ask on [Discord](https://discord.gg/yQx49zNF4d).

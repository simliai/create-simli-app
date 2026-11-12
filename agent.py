"""A LiveKit Agents voice pipeline with a Simli Trinity-2 avatar.

Deepgram hears you, OpenAI answers, ElevenLabs speaks and Simli shows it. LiveKit Agents runs the
pipeline: turn detection, interruptions and audio transport.

Run `uv run agent.py dev`, then talk to it from the web page in frontend/. See README.md.
"""

import asyncio
import logging
import os

from dotenv import load_dotenv
from livekit import rtc
from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    CloseEvent,
    CloseReason,
    JobContext,
    cli,
    inference,
)
from livekit.plugins import deepgram, elevenlabs, openai, simli

load_dotenv()

logger = logging.getLogger("simli-pipeline-agent")

# Simli's default Trinity-2 face (a woman, so the default voice below is a female one). Set
# SIMLI_FACE_ID in .env to use another face, and match the voice to it.
DEFAULT_FACE_ID = "14c60d62-6ebf-424d-b626-1f4f91c33b04"

# ElevenLabs' premade voice "Jessica" (female), to match the default face. Any voice ID from your
# ElevenLabs voice library works; set ELEVENLABS_VOICE_ID.
DEFAULT_VOICE_ID = "cgSgspJ2msm6clMCkdW9"

# OpenAI's most efficient chat model. It can reason, but reasoning adds seconds before the first
# word, so it's off ("none"). For a model without reasoning support (e.g. gpt-4.1-mini), set
# OPENAI_REASONING_EFFORT=off.
DEFAULT_OPENAI_MODEL = "gpt-6-luna"

# The agent only joins rooms that dispatch it by this name, as the frontend's token does.
# Without a name, LiveKit would send it to every new room in the project.
AGENT_NAME = os.getenv("LIVEKIT_AGENT_NAME") or "simli-pipeline-agent"

INSTRUCTIONS = (
    "You are a friendly voice assistant, seen by the user as a video avatar. "
    "Speak English. Keep your replies short and conversational. "
    "Don't use emojis, lists or markdown: everything you write is spoken aloud."
)


def build_session() -> AgentSession:
    """The voice pipeline: speech-to-text, the LLM and text-to-speech, plus turn taking."""
    reasoning_effort = os.getenv("OPENAI_REASONING_EFFORT") or "none"
    return AgentSession(
        # Speech-to-text. Reads DEEPGRAM_API_KEY.
        stt=deepgram.STT(model="nova-3", language="en"),
        # The LLM. Reads OPENAI_API_KEY.
        llm=openai.LLM(
            model=os.getenv("OPENAI_MODEL") or DEFAULT_OPENAI_MODEL,
            **({} if reasoning_effort == "off" else {"reasoning_effort": reasoning_effort}),
        ),
        # Text-to-speech. eleven_flash_v2_5 is ElevenLabs' lowest-latency model.
        tts=elevenlabs.TTS(
            api_key=os.environ["ELEVENLABS_API_KEY"],
            voice_id=os.getenv("ELEVENLABS_VOICE_ID") or DEFAULT_VOICE_ID,
            model="eleven_flash_v2_5",
        ),
        # Voice activity detection: Silero, bundled with livekit-agents. It runs locally.
        vad=inference.VAD(model="silero"),
        turn_handling={
            # LiveKit's turn detector listens to how you speak to tell a pause from the end of
            # your turn. It runs locally under `start`; under `dev` it uses LiveKit Inference
            # (see README.md) and falls back to the local model if that's unavailable.
            "turn_detection": inference.TurnDetector(),
            # The avatar can't pause its speech, so there is nothing to resume after a false
            # interruption.
            "interruption": {"resume_false_interruption": False},
        },
    )


server = AgentServer()


@server.rtc_session(agent_name=AGENT_NAME)
async def entrypoint(ctx: JobContext) -> None:
    session = build_session()

    # `console` runs the agent in your terminal with no LiveKit room, so there is
    # nowhere to show the avatar: it is voice only there.
    if not ctx.is_fake_job():
        # Connect first: wait_for_join() below only waits once the room is connected.
        await ctx.connect()

        avatar = simli.AvatarSession(
            simli_config=simli.SimliConfig(
                api_key=os.environ["SIMLI_API_KEY"],
                face_id=os.getenv("SIMLI_FACE_ID") or DEFAULT_FACE_ID,
                max_session_length=600,  # seconds; the avatar leaves after this
                max_idle_time=300,  # seconds without speaking before the avatar leaves
                # Trinity-2 framing (https://docs.simli.com/api-reference/trinity-2).
                # Video size: 1:1, 16:9 or 9:16, each side at least 512 px. 1366x768 is
                # Trinity-2's full 16:9 frame; Simli's default is 768x768.
                streaming_width=1366,
                streaming_height=768,
                # Where the avatar sits on the canvas, each 0 to 1 (0.5, 1.0 is bottom centre).
                avatar_position_x=0.5,
                avatar_position_y=1.0,
                # Optional: a starting camera, e.g. {"zoom": 1.2, "orbit_y_off": 15}, and ids
                # of your own uploads (POST /assets/backgrounds, /assets/foregrounds).
                # camera={"zoom": 1.2},
                # background_id="...",
                # foreground_id="...",
            ),
        )
        await avatar.start(session, room=ctx.room)
        # On success the plugin sends the agent's voice to the avatar. On a Simli API error
        # (a bad key or face id, or no free session) it logs the error and returns instead.
        if session.output.audio is None:
            logger.error("the Simli avatar didn't start; see the Simli error above")
            ctx.delete_room()
            return

        # Don't start talking until the avatar is in the room and publishing video, so its
        # first words aren't lost.
        try:
            await avatar.wait_for_join(timeout=30)
        except asyncio.TimeoutError:
            logger.error("the Simli avatar didn't join the room")
            ctx.delete_room()
            return

        # The room holds one user, this agent and its avatar, whose session ends with this
        # agent's. When the conversation is over, delete the room to tidy up: everyone leaves
        # at once.
        @session.on("close")
        def _on_session_close(event: CloseEvent) -> None:
            # The session closes when the user leaves, or on an error. A job shutdown is this
            # agent leaving instead: its avatar leaves with it, and the page then leaves too.
            if event.reason != CloseReason.JOB_SHUTDOWN:
                ctx.delete_room()

        # The avatar leaves after max_session_length or max_idle_time, and the conversation
        # ends with it.
        @ctx.room.on("participant_disconnected")
        def _on_participant_disconnected(participant: rtc.RemoteParticipant) -> None:
            if participant.identity == avatar.avatar_identity:
                ctx.delete_room()

    await session.start(agent=Agent(instructions=INSTRUCTIONS), room=ctx.room)
    session.generate_reply(instructions="Greet the user in one short sentence.")


if __name__ == "__main__":
    cli.run_app(server)

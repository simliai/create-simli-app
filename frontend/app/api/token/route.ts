import {
  AccessToken,
  RoomAgentDispatch,
  RoomConfiguration,
  TrackSource,
} from "livekit-server-sdk";

// The name agent.py registers under. Change both together (LIVEKIT_AGENT_NAME).
const AGENT_NAME = process.env.LIVEKIT_AGENT_NAME || "simli-pipeline-agent";

const isProduction = process.env.NODE_ENV === "production";

// Mints a token for a new room. The API secret signs it here, on the server, and never
// reaches the browser.
//
// Every token starts a conversation that uses your Simli minutes and Deepgram, OpenAI and
// ElevenLabs credit, and this route has no login: anyone who can reach it can start one. So in
// production (`next build` + `next start`, or a deployed host) it refuses unless you opt in with
// ALLOW_UNAUTHENTICATED_SESSIONS=true, which is only for demos and internal networks.
export async function POST() {
  // TODO: before you deploy, check the user here (your session cookie, auth provider, ...)
  // and rate-limit per user. Return 401/403 when the check fails. Then remove the
  // ALLOW_UNAUTHENTICATED_SESSIONS escape hatch below, or keep it off.
  if (isProduction && process.env.ALLOW_UNAUTHENTICATED_SESSIONS !== "true") {
    return Response.json(
      {
        error:
          "This page has no login, so it doesn't start sessions in production. Add your own " +
          "auth to app/api/token/route.ts first (or set ALLOW_UNAUTHENTICATED_SESSIONS=true " +
          "for a demo).",
      },
      { status: 403 },
    );
  }

  const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = process.env;
  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    console.error("api/token: set LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET");
    return Response.json(
      {
        error: isProduction
          ? "The server isn't configured to start sessions."
          : "Set LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET in frontend/.env.local",
      },
      { status: 500 },
    );
  }

  try {
    const roomName = `simli-${crypto.randomUUID()}`;
    const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: `user-${crypto.randomUUID().slice(0, 8)}`,
      // Only needs to last until the user joins. Keep it short: until it expires, the token
      // can recreate the room (and dispatch the agent again) after the agent deletes it.
      ttl: "2m",
    });
    // The user only publishes their mic. No camera, screen share or data messages.
    token.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canPublishSources: [TrackSource.MICROPHONE],
      canPublishData: false,
      canSubscribe: true,
    });
    // The room is created when this user joins it, and LiveKit then dispatches the agent named
    // here. A room that names its agents gets only those, not every agent in the project.
    token.roomConfig = new RoomConfiguration({
      agents: [new RoomAgentDispatch({ agentName: AGENT_NAME })],
      // The user, the agent and its avatar.
      maxParticipants: 3,
      // Seconds before LiveKit closes the room once it's empty (or was never joined).
      emptyTimeout: 60,
      departureTimeout: 20,
    });

    return Response.json({ serverUrl: LIVEKIT_URL, participantToken: await token.toJwt() });
  } catch (e) {
    console.error("api/token: couldn't mint a token", e);
    return Response.json({ error: "Couldn't start a session." }, { status: 500 });
  }
}

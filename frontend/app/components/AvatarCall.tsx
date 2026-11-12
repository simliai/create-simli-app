"use client";

import { Room, RoomEvent, Track } from "livekit-client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import sparkle from "@/media/sparkle.svg";
import DottedFace from "./DottedFace";

type Status = "idle" | "connecting" | "connected";

// Give up if the avatar's video hasn't arrived by then (is the agent running?).
const AVATAR_TIMEOUT_MS = 45_000;

export default function AvatarCall() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const roomRef = useRef<Room | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Leave the room if the page goes away mid-call.
  useEffect(() => () => void roomRef.current?.disconnect(), []);

  function end(message = "") {
    const room = roomRef.current;
    roomRef.current = null;
    room?.removeAllListeners();
    // Leaving ends the agent's session, and the agent then deletes the room.
    void room?.disconnect();
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus("idle");
    setError(message);
  }

  async function start() {
    setError("");
    setStatus("connecting");
    const room = new Room();
    roomRef.current = room;
    let avatarShown = false;

    // Simli's avatar joins as its own participant and publishes the video and voice on the
    // agent's behalf. The only remote tracks in this room are the avatar's, so take whichever
    // video and audio track arrives instead of looking for a particular identity.
    room.on(RoomEvent.TrackSubscribed, (track) => {
      if (track.kind === Track.Kind.Video && videoRef.current) {
        track.attach(videoRef.current);
        avatarShown = true;
        setStatus("connected");
      } else if (track.kind === Track.Kind.Audio && audioRef.current) {
        track.attach(audioRef.current);
      }
    });
    // The avatar leaves with the agent (or at its time limits): the call is over.
    room.on(RoomEvent.TrackUnsubscribed, (track) => {
      if (track.kind === Track.Kind.Video) end();
    });

    setTimeout(() => {
      if (roomRef.current === room && !avatarShown) {
        end("The avatar didn't join. Is the agent running?");
      }
    }, AVATAR_TIMEOUT_MS);

    try {
      const res = await fetch("/api/token", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `The token request failed (${res.status})`);

      // Joining creates the room, and LiveKit dispatches the agent the token names.
      await room.connect(body.serverUrl, body.participantToken);
      // The agent deletes the room when the conversation ends or the avatar fails to start.
      room.on(RoomEvent.Disconnected, () => {
        end(avatarShown ? "" : "The avatar didn't start. Check the agent's logs.");
      });
      // Publish the mic. The browser asks for permission here.
      await room.localParticipant.setMicrophoneEnabled(true);
    } catch (e) {
      if (roomRef.current !== room) return; // the user already ended this session
      const message = e instanceof Error ? e.message : String(e);
      const micBlocked = e instanceof Error && e.name === "NotAllowedError";
      end(micBlocked ? "Allow the microphone to talk to the avatar." : message);
    }
  }

  return (
    <>
      {status === "idle" && <DottedFace />}

      {/* VideoBox: 16:9, like the 1366x768 video agent.py asks Simli for. */}
      <div
        className={
          status === "idle"
            ? "hidden"
            : "relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-sm bg-simligray"
        }
      >
        {/* Muted because the voice plays through the <audio> below. */}
        <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-contain" />
        <audio ref={audioRef} autoPlay />
        {status === "connecting" && (
          <Image src={sparkle} alt="Connecting" className="absolute h-[40px] w-auto animate-loader" />
        )}
      </div>

      <div className="mx-auto flex w-full max-w-[350px] flex-col items-center">
        {status === "idle" ? (
          <button
            onClick={start}
            className="mt-4 flex h-[52px] w-full items-center justify-center rounded-[100px] bg-simliblue px-6 py-3 text-white transition-all duration-300 hover:rounded-sm hover:bg-white hover:text-black"
          >
            <span className="font-abc-repro-mono font-bold">Start</span>
          </button>
        ) : (
          <div className="flex w-full flex-col items-center gap-2">
            <button
              onClick={() => end()}
              className="mt-4 flex h-[52px] w-full items-center justify-center gap-2 rounded-[100px] bg-red px-6 text-white transition-all duration-300 hover:rounded-sm hover:bg-white hover:text-black"
            >
              <IconExit />
              <span className="font-abc-repro-mono font-bold">End</span>
            </button>
            <span className="font-abc-repro-mono text-xs text-gray-400" aria-live="polite">
              {status === "connecting" ? "Connecting…" : "Connected. Say hello."}
            </span>
          </div>
        )}
        {error && (
          <p role="alert" className="mt-4 text-center font-abc-repro-mono text-red">
            {error}
          </p>
        )}
      </div>
    </>
  );
}

// From create-simli-app-openai's media/IconExit.tsx, drawn in the text colour.
function IconExit() {
  return (
    <svg width="20" height="21" viewBox="0 0 20 21" fill="none" aria-hidden>
      <path
        d="M5 5.5L15 15.5M15 5.5L5 15.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

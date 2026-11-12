"use client";

import VideoBox from "@/app/components/VideoBox";
import { openMicStream, startPcmCapture, type Mic } from "@/app/utils/mic";
import { explainSimliError } from "@/app/utils/simliErrors";
import cn from "@/app/utils/TailwindMergeAndClsx";
import IconSparkleLoader from "@/media/IconSparkleLoader";
import { useCallback, useEffect, useRef, useState } from "react";
import { LogLevel, SimliClient } from "simli-client";

type Status = "idle" | "starting" | "live" | "error";

interface AvatarInteractionProps {
  /** Called when a session starts (true) or ends (false). */
  onActiveChange: (active: boolean) => void;
  showDottedFace: boolean;
}

async function errorText(res: Response): Promise<string> {
  try {
    const j = await res.json();
    return j.error ?? JSON.stringify(j);
  } catch {
    return res.statusText;
  }
}

/**
 * Order matters:
 *   1. microphone permission (fail fast, before any billed session starts)
 *   2. Simli session token from our server, then SimliClient.start()
 *   3. only once the avatar is on screen: the conversation WebSocket. The server
 *      greets as soon as it opens, so the first words aren't lost.
 * Ending any part (button, Simli stop, server close, error, unmount, tab close)
 * ends all of them.
 */
export default function AvatarInteraction({ onActiveChange, showDottedFace }: AvatarInteractionProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const simliRef = useRef<SimliClient | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micRef = useRef<Mic | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const attemptRef = useRef(0);

  // Idempotent: the Simli "error" event and a rejected start() can both fire for one failure.
  const cleanup = useCallback(() => {
    micRef.current?.stop();
    micRef.current = null;
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    const ws = wsRef.current;
    wsRef.current = null;
    if (ws && ws.readyState <= WebSocket.OPEN) ws.close(1000, "Client ended the session");
    const simli = simliRef.current;
    simliRef.current = null;
    if (simli) void simli.stop();
    setSpeaking(false);
  }, []);

  const fail = useCallback(
    (message: string) => {
      attemptRef.current += 1;
      setError(message);
      setStatus("error");
      cleanup();
      onActiveChange(false);
    },
    [cleanup, onActiveChange],
  );

  const stop = useCallback(() => {
    attemptRef.current += 1; // cancels a start() that is still in progress
    cleanup();
    setStatus("idle");
    onActiveChange(false);
  }, [cleanup, onActiveChange]);

  async function start() {
    // Runs from a click, so the browser allows audio playback.
    const attempt = ++attemptRef.current;
    const cancelled = () => attempt !== attemptRef.current;
    setError("");
    setStatus("starting");
    onActiveChange(true);

    // Resources of this attempt, released here if the user pressed Stop meanwhile.
    let micStream: MediaStream | null = null;
    let simli: SimliClient | null = null;
    let ws: WebSocket | null = null;
    const releaseIfCancelled = () => {
      if (!cancelled()) return false;
      micStream?.getTracks().forEach((t) => t.stop());
      if (simli && simliRef.current !== simli) void simli.stop();
      if (ws && wsRef.current !== ws) ws.close();
      return true;
    };

    try {
      // 1. Microphone first, so a denied permission doesn't cost a Simli session.
      try {
        micStream = await openMicStream();
      } catch {
        throw new Error("Microphone access was denied. Allow it in the browser and try again.");
      }
      if (releaseIfCancelled()) return;
      micStreamRef.current = micStream;

      // 2. Simli. The API key stays on the server; the browser only gets a short-lived token.
      const res = await fetch("/api/session", { method: "POST" });
      if (!res.ok) throw new Error(explainSimliError(`Could not start a session (${res.status}): ${await errorText(res)}`));
      const { sessionToken, wsTicket } = (await res.json()) as { sessionToken: string; wsTicket: string };
      if (releaseIfCancelled()) return;

      // LogLevel.DEBUG logs every audio chunk: use INFO while debugging.
      const client = new SimliClient(sessionToken, videoRef.current!, audioRef.current!, null, LogLevel.ERROR);
      simli = client;
      client.on("error", (detail) => {
        if (simliRef.current === client) fail(explainSimliError(`Simli error: ${detail}`));
      });
      client.on("stop", () => {
        // Ended by maxSessionLength / maxIdleTime (or by us, then the ref is already cleared).
        if (simliRef.current === client) {
          simliRef.current = null;
          stop();
        }
      });
      client.on("speaking", () => setSpeaking(true));
      client.on("silent", () => setSpeaking(false));
      client.on("destination", (info) => console.info("Simli session:", info)); // include when reporting issues
      simliRef.current = client;
      await client.start(); // resolves when the first video frame is on screen
      if (cancelled()) return; // stop() already stopped the client

      // 3. The conversation: mic audio up, avatar audio down. The server greets on connect.
      const scheme = window.location.protocol === "https:" ? "wss" : "ws";
      const socket = new WebSocket(`${scheme}://${window.location.host}/ws?ticket=${encodeURIComponent(wsTicket)}`);
      ws = socket;
      socket.binaryType = "arraybuffer";
      wsRef.current = socket;
      socket.onmessage = (ev) => {
        if (ev.data instanceof ArrayBuffer) {
          // PCM16 16 kHz from ElevenLabs. Only Simli plays it, in sync with the video.
          simliRef.current?.sendAudioData(new Uint8Array(ev.data));
          return;
        }
        try {
          const msg = JSON.parse(ev.data as string) as { type: string; message?: string };
          if (msg.type === "interrupt") simliRef.current?.ClearBuffer(); // the user barged in
          else if (msg.type === "error") setError(msg.message ?? "Server error");
        } catch {
          // ignore malformed messages
        }
      };
      socket.onclose = (ev) => {
        if (wsRef.current !== socket) return; // we closed it ourselves
        wsRef.current = null;
        cleanup();
        onActiveChange(false);
        if (ev.code === 1000 || ev.code === 1001) {
          setStatus("idle");
        } else {
          setStatus("error");
          setError((prev) => prev || `Conversation ended: ${ev.reason || `connection closed (${ev.code})`}`);
        }
      };
      await new Promise<void>((resolve, reject) => {
        socket.addEventListener("open", () => resolve(), { once: true });
        socket.addEventListener("error", () => reject(new Error("Could not connect to the conversation server.")), {
          once: true,
        });
      });
      if (cancelled()) return;

      const mic = await startPcmCapture(micStream, (pcm) => {
        if (socket.readyState === WebSocket.OPEN) socket.send(pcm.buffer);
      });
      if (cancelled()) {
        mic.stop();
        return;
      }
      micRef.current = mic;
      setStatus("live");
    } catch (e) {
      if (releaseIfCancelled()) return;
      fail(explainSimliError(e instanceof Error ? e.message : String(e)));
    }
  }

  // Stop everything on unmount and when the tab closes, so sessions don't keep billing.
  useEffect(() => {
    window.addEventListener("pagehide", cleanup);
    return () => {
      window.removeEventListener("pagehide", cleanup);
      cleanup();
    };
  }, [cleanup]);

  const active = status === "starting" || status === "live";

  return (
    <>
      <div className={`transition-all duration-300 ${showDottedFace ? "h-0 overflow-hidden" : "h-auto"}`}>
        <VideoBox video={videoRef} audio={audioRef} />
      </div>
      <div className="flex flex-col items-center">
        {!active ? (
          <button
            onClick={start}
            className={cn(
              "w-full h-[52px] mt-4 bg-simliblue text-white py-3 px-6 rounded-[100px] transition-all duration-300 hover:text-black hover:bg-white hover:rounded-sm",
              "flex justify-center items-center",
            )}
          >
            <span className="font-abc-repro-mono font-bold w-[164px]">Test Interaction</span>
          </button>
        ) : (
          <div className="flex items-center gap-4 w-full">
            <button
              onClick={stop}
              className="mt-4 group text-white flex-grow bg-red hover:rounded-sm hover:bg-white h-[52px] px-6 rounded-[100px] transition-all duration-300 flex justify-center items-center"
            >
              {status === "starting" ? (
                <IconSparkleLoader className="h-[20px] animate-loader" />
              ) : (
                <span className="font-abc-repro-mono group-hover:text-black font-bold w-[164px] transition-all duration-300">
                  Stop Interaction
                </span>
              )}
            </button>
          </div>
        )}
        {status === "live" && (
          <p className="mt-3 font-abc-repro-mono text-xs text-gray-400">{speaking ? "Speaking…" : "Listening…"}</p>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-4 max-w-[350px] text-red text-center">
          {error}
        </p>
      )}
    </>
  );
}

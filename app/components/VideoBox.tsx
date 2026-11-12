import type { RefObject } from "react";

interface VideoBoxProps {
  video: RefObject<HTMLVideoElement | null>;
  audio: RefObject<HTMLAudioElement | null>;
}

/**
 * 16:9 player for the Simli stream (server.ts requests 1366x768).
 * For a square layout, request 768x768 in server.ts and use aspect-square here.
 */
export default function VideoBox({ video, audio }: VideoBoxProps) {
  return (
    <div className="aspect-video w-full flex rounded-sm overflow-hidden items-center justify-center bg-simligray">
      {/* muted: the voice plays through the <audio> element, which is Simli's in-sync audio */}
      <video ref={video} autoPlay playsInline muted className="h-full w-full object-cover" />
      <audio ref={audio} autoPlay />
    </div>
  );
}

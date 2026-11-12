import type { RefObject } from "react";

interface VideoBoxProps {
  video: RefObject<HTMLVideoElement | null>;
  audio: RefObject<HTMLAudioElement | null>;
}

// The Simli stream is requested at 768x768 (see server.ts), so the box is square.
// For 16:9 (1366x768) change aspect-square to aspect-video and widen the box.
export default function VideoBox({ video, audio }: VideoBoxProps) {
  return (
    <div className="aspect-square w-[350px] max-w-full overflow-hidden bg-simligray">
      {/* muted: the voice plays through the <audio> element, which is Simli's in-sync audio */}
      <video ref={video} autoPlay playsInline muted className="h-full w-full object-cover" />
      <audio ref={audio} autoPlay />
    </div>
  );
}

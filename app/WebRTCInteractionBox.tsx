import { useEffect } from "react";

interface WebRTCInteractionBoxProps {
    interactionHasStarted: boolean;
    webRTCStarted: boolean;
    video: React.RefObject<HTMLVideoElement>;
    audio: React.RefObject<HTMLAudioElement>;
  }

export default function WebRTCInteractionBox({ interactionHasStarted, webRTCStarted, video, audio }: WebRTCInteractionBoxProps) {
    useEffect(() => {
        if (interactionHasStarted && webRTCStarted) {
          console.log("Conditions met for rendering video and audio");
          console.log("Video ref:", video.current);
          console.log("Audio ref:", audio.current);
        }
      }, [interactionHasStarted, webRTCStarted]);

    if (interactionHasStarted && webRTCStarted) {
        console.log("Interaction is started... Returning video interaction");
        return (
        <div className="relative w-full aspect-video rounded-full">
            <video ref={video} id="simli_video" autoPlay playsInline className="w-full h-full rounded-full"></video>
            <audio ref={audio} id="simli_audio" autoPlay ></audio>
        </div>
        )
    }
}
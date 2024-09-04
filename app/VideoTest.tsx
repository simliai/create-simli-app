import { useEffect, useRef } from 'react';

export default function VideoTest({isReady}: {isReady: boolean}) {
  const videoRef = useRef<HTMLVideoElement>(null);


  useEffect(() => {
    const startVideo = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Error accessing media devices:", err);
      }
    };

    startVideo();
  }, []);

  return (
    <div className="relative w-full aspect-video rounded-full">
      <video ref={videoRef} autoPlay playsInline className="w-full h-full rounded-full" />
    </div>
  );
}
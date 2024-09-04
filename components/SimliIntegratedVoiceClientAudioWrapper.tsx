import React, { useEffect, useRef, useState } from "react";
import { useVoiceClientMediaTrack } from "realtime-ai-react";
import { SimliClient } from "simli-client";
import { config } from "./config"; // Import the config

const SimliIntegratedVoiceClientAudioWrapper: React.FC = () => {
  const botAudioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const simliAudioRef = useRef<HTMLAudioElement>(null);
  const botAudioTrack = useVoiceClientMediaTrack("audio", "bot");
  const [simliClient, setSimliClient] = useState<SimliClient | null>(null);

  useEffect(() => {
    if (videoRef.current && simliAudioRef.current) {
      const apiKey = process.env.NEXT_PUBLIC_SIMLI_API_KEY;
      if (!apiKey) {
        console.error("NEXT_PUBLIC_SIMLI_API_KEY is not defined");
        return;
      }

      const SimliConfig = {
        apiKey,
        faceID: config.faceId, // Use the faceId from config
        handleSilence: false,
        videoRef: videoRef,
        audioRef: simliAudioRef,
      };

      const client = new SimliClient();
      client.Initialize(SimliConfig);
      setSimliClient(client);

      client.start();
    }

    return () => {
      if (simliClient) {
        simliClient.close();
      }
    };
  }, []);

  useEffect(() => {
    if (!botAudioRef.current || !botAudioTrack || !simliClient) return;

    const audioContext = new (window.AudioContext ||
      (window as any).webkitAudioContext)({
      sampleRate: 16000,
    });
    const sourceNode = audioContext.createMediaStreamSource(
      new MediaStream([botAudioTrack])
    );

    const scriptNode = audioContext.createScriptProcessor(4096, 1, 1);
    sourceNode.connect(scriptNode);
    scriptNode.connect(audioContext.destination);

    const isSilent = (data: Float32Array, threshold = 0.01) => {
      return !data.some((sample) => Math.abs(sample) > threshold);
    };
    let previousTime = performance.now();
    scriptNode.onaudioprocess = (audioProcessingEvent) => {
      const inputBuffer = audioProcessingEvent.inputBuffer;
      const inputData = inputBuffer.getChannelData(0);

      // if (isSilent(inputData)) {
      //   console.log("Silence detected, skipping this buffer");
      //   return;
      // }

      // Convert Float32Array to Int16Array
      const int16Data = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        int16Data[i] = Math.max(
          -32768,
          Math.min(32767, Math.round(inputData[i] * 32767))
        );
      }

      // Send the audio data to Simli
      console.log("Sending", int16Data.length, "bytes to Simli");
      console.log("Sending data at time:", performance.now() - previousTime);
      previousTime = performance.now();
      simliClient.sendAudioData(new Uint8Array(int16Data.buffer));
    };

    return () => {
      scriptNode.disconnect();
      sourceNode.disconnect();
      audioContext.close();
    };
  }, [botAudioTrack, simliClient]);

  return (
    <div className="relative w-full aspect-video">
      <video
        ref={videoRef}
        id="simli_video"
        autoPlay
        playsInline
        className="w-full h-full"
      ></video>
      <audio ref={simliAudioRef} id="simli_audio" autoPlay></audio>
      <audio ref={botAudioRef} style={{ display: "none" }} />
    </div>
  );
};

export default SimliIntegratedVoiceClientAudioWrapper;

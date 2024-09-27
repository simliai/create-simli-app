import React, { useCallback, useEffect, useRef, useState } from 'react';
import { SimliClient } from 'simli-client';
import VideoBox from './VideoBox';

interface AvatarInteractionProps {
  simli_faceid: string;
  onStart: () => void;
  showDottedFace: boolean;
}

const AvatarInteraction: React.FC<AvatarInteractionProps> = ({
  simli_faceid,
  onStart,
  showDottedFace,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isAvatarVisible, setIsAvatarVisible] = useState(false);
  const [error, setError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const simliClientRef = useRef<SimliClient | null>(null);

  const initializeSimliClient = useCallback(() => {
    if (videoRef.current && audioRef.current) {
      const SimliConfig = {
        apiKey: process.env.NEXT_PUBLIC_SIMLI_API_KEY,
        faceID: simli_faceid,
        handleSilence: true,
        videoRef: videoRef,
        audioRef: audioRef,
      };

      simliClientRef.current = new SimliClient();
      simliClientRef.current.Initialize(SimliConfig);
      console.log('Simli Client initialized');
    }
  }, [simli_faceid]);

  const initializeWebSocket = useCallback(() => {
    socketRef.current = new WebSocket('ws://localhost:8080'); // Connect to Moshi Python server

    socketRef.current.onopen = () => {
      console.log('Connected to Moshi server');
    };

    socketRef.current.onmessage = (event) => {
      if (typeof event.data === 'string') {
        // Handle text message
        console.log('Received text message:', event.data);
        // If Simli doesn't require text input for lip-syncing, you can remove this
        // Alternatively, if Simli expects text input via a different method, adjust accordingly
      } else if (event.data instanceof Blob) {
        // Handle binary message (audio data)
        event.data.arrayBuffer().then(async (arrayBuffer) => {
          // The audio data is PCM16 at 24kHz
          const pcm16Data = new Int16Array(arrayBuffer);

          // Resample audio from 24kHz to 16kHz
          const resampledData = await resampleAudio(pcm16Data, 24000, 16000);

          // Send the resampled audio data to Simli
          // Assuming Simli accepts PCM16 data at 16kHz
          simliClientRef.current?.sendAudioData(resampledData);
        });
      }
    };

    socketRef.current.onerror = (error) => {
      console.error('WebSocket error:', error);
      setError('WebSocket connection error. Please check if the Moshi server is running.');
    };

    socketRef.current.onclose = () => {
      console.log('Disconnected from Moshi server');
    };
  }, []);

  const resampleAudio = async (pcm16Data: Int16Array, fromSampleRate: number, toSampleRate: number): Promise<Int16Array> => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: fromSampleRate,
    });

    // Convert PCM16 to Float32
    const float32Data = new Float32Array(pcm16Data.length);
    for (let i = 0; i < pcm16Data.length; i++) {
      float32Data[i] = pcm16Data[i] / 32767;
    }

    // Create an AudioBuffer
    const audioBuffer = audioContext.createBuffer(1, float32Data.length, fromSampleRate);
    audioBuffer.getChannelData(0).set(float32Data);

    // Use OfflineAudioContext to resample
    const offlineContext = new OfflineAudioContext(1, (float32Data.length * toSampleRate) / fromSampleRate, toSampleRate);
    const bufferSource = offlineContext.createBufferSource();
    bufferSource.buffer = audioBuffer;
    bufferSource.connect(offlineContext.destination);
    bufferSource.start(0);

    const renderedBuffer = await offlineContext.startRendering();

    // Convert back to PCM16
    const resampledFloat32Data = renderedBuffer.getChannelData(0);
    const resampledPCM16Data = new Int16Array(resampledFloat32Data.length);
    for (let i = 0; i < resampledFloat32Data.length; i++) {
      resampledPCM16Data[i] = Math.max(-32768, Math.min(32767, resampledFloat32Data[i] * 32767));
    }

    return resampledPCM16Data;
  };

  const isWebRTCConnected = useCallback(() => {
    if (!simliClientRef.current) return false;

    const pc = (simliClientRef.current as any).pc as RTCPeerConnection | null;
    const dc = (simliClientRef.current as any).dc as RTCDataChannel | null;

    return pc !== null &&
      pc.iceConnectionState === 'connected' &&
      dc !== null &&
      dc.readyState === 'open';
  }, []);

  const handleStart = useCallback(async () => {
    onStart();
    setIsLoading(true);
    setError('');

    console.log('Initializing WebSocket connection to Moshi server');
    initializeWebSocket();

    console.log('Starting WebRTC connection to Simli');
    simliClientRef.current?.start();

    // Wait for the WebRTC connection to be established
    const checkConnection = async () => {
      if (isWebRTCConnected()) {
        setIsAvatarVisible(true);
        console.log('WebRTC connection established');
      } else {
        console.log('Waiting for WebRTC connection...');
        setTimeout(checkConnection, 1000); // Check again after 1 second
      }
    };

    setTimeout(checkConnection, 4000); // Start checking after 4 seconds
  }, [initializeWebSocket, isWebRTCConnected, onStart]);

  const handleCancel = useCallback(async () => {
    setIsLoading(false);
    setError('');
    setIsAvatarVisible(false);
    simliClientRef.current?.close();
    socketRef.current?.close();
    // Navigate back to home page or reset state
    window.location.href = '/';
  }, []);

  useEffect(() => {
    initializeSimliClient();

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
      if (simliClientRef.current) {
        simliClientRef.current.close();
      }
    };
  }, [initializeSimliClient]);

  return (
    <>
      <div className={`transition-all duration-300 ${showDottedFace ? 'h-0 overflow-hidden' : 'h-auto'}`}>
        <VideoBox video={videoRef} audio={audioRef} />
      </div>
      <div className="flex justify-center">
        {!isLoading ? (
          <button
            onClick={handleStart}
            disabled={isLoading}
            className="w-full mt-4 bg-simliblue text-white py-3 px-6 rounded-[100px] transition-all duration-300 hover:text-black hover:bg-white hover:rounded-sm"
          >
            <span className="font-abc-repro-mono font-bold w-[164px]">
              Test Interaction
            </span>
          </button>
        ) : isAvatarVisible ? (
          <button
            onClick={handleCancel}
            className="w-full mt-4 bg-red-600 text-white py-3 justify-center rounded-[100px] backdrop-blur transition-all duration-300 hover:rounded hover:bg-white hover:text-black hover:rounded-sm px-6"
          >
            <span className="font-abc-repro-mono font-bold w-[164px]">
              Stop
            </span>
          </button>
        ) : (
          <button
            onClick={handleCancel}
            className="w-full mt-4 bg-zinc-700 text-white py-3 justify-center rounded-[100px] backdrop-blur transition-all duration-300 hover:rounded hover:bg-white hover:text-black hover:rounded-sm px-6"
          >
            <span className="font-abc-repro-mono font-bold w-[164px]">
              Loading...
            </span>
          </button>
        )}
      </div>
      {error && <p className="mt-4 text-red-500">{error}</p>}
    </>
  );
};

export default AvatarInteraction;

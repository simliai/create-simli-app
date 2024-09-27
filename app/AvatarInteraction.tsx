import React, { useCallback, useEffect, useRef, useState } from 'react';
import { SimliClient } from 'simli-client';
import VideoBox from './VideoBox';
import DottedFace from './DottedFace';
import Recorder from 'opus-recorder';

interface AvatarInteractionProps {
  simli_faceid: string;
  elevenlabs_voiceid: string;
  initialPrompt: string;
  onStart: () => void;
  showDottedFace: boolean;
}

const AvatarInteraction: React.FC<AvatarInteractionProps> = ({
  simli_faceid,
  elevenlabs_voiceid,
  initialPrompt,
  onStart,
  showDottedFace,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isAvatarVisible, setIsAvatarVisible] = useState(false);
  const [error, setError] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const [handshakeReceived, setHandshakeReceived] = useState(false);
  const simliClientRef = useRef<SimliClient | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const recorderRef = useRef<any>(null);

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

  const handleServerMessage = useCallback((event: MessageEvent) => {
    const data = event.data;
    if (data instanceof ArrayBuffer) {
      const dataView = new DataView(data);
      const messageType = dataView.getUint8(0);

      if (messageType === 0x00) {
        console.log('Received handshake from server');
        setHandshakeReceived(true);
        startRecording();
      } else if (messageType === 0x01) {
        const audioData = new Uint8Array(data.slice(1));
        console.log("Received audio data from server, length:", audioData.length);
        simliClientRef.current?.sendAudioData(audioData);
      } else if (messageType === 0x02) {
        const textDecoder = new TextDecoder('utf-8');
        const text = textDecoder.decode(data.slice(1));
        console.log("Received text from server:", text);
        // Handle the received text (e.g., display it to the user)
      } else {
        console.log('Unknown message type:', messageType);
      }
    } else {
      console.log('Received non-binary message:', event.data);
    }
  }, []);

  const startRecording = useCallback(() => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      console.log('WebSocket not open, cannot start recording');
      return;
    }

    const recorder = new Recorder({
      encoderPath: '/Users/larsvagnes/work/create-simli-app/app/encoderWorker.min.js',
      encoderApplication: 2048,
      encoderFrameSize: 20,
      encoderSampleRate: 24000,
      numberOfChannels: 1,
      streamPages: true,
      maxBuffersPerPage: 1,
    });

    recorder.ondataavailable = (typedArray) => {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        const message = new Uint8Array(1 + typedArray.length);
        message[0] = 0x01; // Audio message type
        message.set(new Uint8Array(typedArray), 1);
        socketRef.current.send(message);
        console.log("Sent Opus-encoded audio data to server, length:", message.length);
      }
    };

    recorder.onstart = () => {
      console.log('Recorder started');
      setIsRecording(true);
    };

    recorder.onstop = () => {
      console.log('Recorder stopped');
      setIsRecording(false);
    };

    recorder.start()
      .then(() => console.log('Recorder is ready'))
      .catch((error) => {
        console.error('Error starting recorder:', error);
        setError('Error starting audio recording. Please check your microphone permissions.');
      });

    recorderRef.current = recorder;
  }, []);

  const stopRecording = useCallback(() => {
    if (recorderRef.current) {
      recorderRef.current.stop();
      recorderRef.current = null;
    }
    setIsRecording(false);
    console.log('Stopped recording');
  }, []);

  const connectWebSocket = useCallback(() => {
    const ws = new WebSocket('ws://localhost:8998/api/chat');
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
      console.log('WebSocket connected');
      setIsLoading(false);
      setIsAvatarVisible(true);
    };

    ws.onmessage = handleServerMessage;

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setError('WebSocket connection error. Please try again.');
    };

    ws.onclose = (event) => {
      console.log('WebSocket disconnected:', event);
      stopRecording();
      setIsAvatarVisible(false);
      setHandshakeReceived(false);
      setIsLoading(false);
      if (event.code !== 1000) {
        setError(`WebSocket closed unexpectedly. Code: ${event.code}, Reason: ${event.reason}`);
      } else {
        setError('Session ended. Please start a new interaction.');
      }
    };

    socketRef.current = ws;
  }, [handleServerMessage, stopRecording]);

  const handleStart = useCallback(() => {
    onStart();
    setIsLoading(true);
    setError('');
    setHandshakeReceived(false);
    console.log('Starting interaction...');
    connectWebSocket();
  }, [onStart, connectWebSocket]);

  const handleCancel = useCallback(() => {
    console.log('handleCancel called');
    setIsLoading(false);
    setError('');
    stopRecording();
    setIsAvatarVisible(false);

    if (socketRef.current) {
      socketRef.current.close();
      console.log('WebSocket closed');
    }
    if (simliClientRef.current) {
      simliClientRef.current.close();
      simliClientRef.current = null;
      console.log('Simli Client closed');
    }
  }, [stopRecording]);

  useEffect(() => {
    initializeSimliClient();

    return () => {
      handleCancel();
    };
  }, [initializeSimliClient, handleCancel]);

  return (
    <>
      <div
        className={`transition-all duration-300 ${
          showDottedFace ? 'h-0 overflow-hidden' : 'h-auto'
        }`}
      >
        {!showDottedFace && <VideoBox videoRef={videoRef} />}
      </div>
      {showDottedFace && <DottedFace />}
      <div className="flex justify-center">
        {!isLoading && !isAvatarVisible ? (
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
            <span className="font-abc-repro-mono font-bold w-[164px]">Stop</span>
          </button>
        ) : (
          <button
            onClick={handleCancel}
            className="w-full mt-4 bg-zinc-700 text-white py-3 justify-center rounded-[100px] backdrop-blur transition-all duration-300 hover:rounded hover:bg-white hover:text-black hover:rounded-sm px-6"
          >
            <span className="font-abc-repro-mono font-bold w-[164px]">Loading...</span>
          </button>
        )}
      </div>
      {error && <p className="mt-4 text-red-500">{error}</p>}
      <audio ref={audioRef} autoPlay />
    </>
  );
};

export default AvatarInteraction;
import VideoBox from '@/app/components/VideoBox';
import cn from '@/app/utils/TailwindMergeAndClsx';
import IconSparkleLoader from "@/media/IconSparkleLoader";
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { SimliClient } from 'simli-client';

interface AvatarInteractionProps {
  simli_faceid: string;
  elevenlabs_voiceid: string;
  initialPrompt: string;
  onStart: () => void;
  showDottedFace: boolean;
}

const simliClient = new SimliClient();

const AvatarInteraction: React.FC<AvatarInteractionProps> = ({
  simli_faceid,
  elevenlabs_voiceid,
  initialPrompt,
  onStart,
  showDottedFace
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isAvatarVisible, setIsAvatarVisible] = useState(false);
  const [error, setError] = useState('');
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const socketRef = useRef<WebSocket | null>(null);

  const initializeSimliClient = useCallback(() => {
    if (videoRef.current && audioRef.current) {
      simliClient.Initialize({
        apiKey: process.env.NEXT_PUBLIC_SIMLI_API_KEY || '',
        faceID: simli_faceid,
        handleSilence: true,
        maxSessionLength: 200,
        maxIdleTime: 100,
        videoRef: videoRef,
        audioRef: audioRef,
      });
      console.log('Simli Client initialized');
    }
  }, [simli_faceid]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setAudioStream(stream);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      setError('Error accessing microphone. Please check your permissions.');
    }
  };

  const initializeWebSocket = useCallback((connectionId: string) => {
    socketRef.current = new WebSocket(`ws://localhost:8080/ws?connectionId=${connectionId}`);

    socketRef.current.onopen = () => {
      console.log('Connected to server');
    };

    socketRef.current.onmessage = (event) => {
      if (event.data instanceof Blob) {
        event.data.arrayBuffer().then((arrayBuffer) => {
          const uint8Array = new Uint8Array(arrayBuffer);
          simliClient.sendAudioData(uint8Array);
        });
      } else {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'interrupt') {
            console.log('Interrupting current response');
            simliClient.ClearBuffer();
          } else if (message.type === 'text') {
            // const uint8Array = new Uint8Array(6000).fill(0);
            // simliClient.sendAudioData(uint8Array);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      }
    };

    socketRef.current.onerror = (error) => {
      console.error('WebSocket error:', error);
      setError('WebSocket connection error. Please check if the server is running.');
    };
  }, []);

  const startConversation = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:8080/start-conversation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: initialPrompt,
          voiceId: elevenlabs_voiceid
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error);
      }

      const data = await response.json();
      initializeWebSocket(data.connectionId);
    } catch (error) {
      console.error('Error starting conversation:', error);
      window.alert(`Whoopsie! Encountered the following error(s):\n\n[${error}].\n\nTry fixing those and restarting the application (npm run start).`)
      handleStop();
      setError('Failed to start conversation. Please try again.');
    }
  }, [elevenlabs_voiceid, initialPrompt, initializeWebSocket]);

  const handleStart = useCallback(async () => {
    setIsLoading(true);
    setError('');
    onStart();

    await startConversation();
    simliClient.start();
    startRecording();
  }, [onStart, startConversation]);

  const handleStop = useCallback(() => {
    setIsLoading(false);
    setError('');
    setIsAvatarVisible(false);
    setAudioStream(null);
    
    if (audioStream) {
      audioStream.getTracks().forEach(track => track.stop());
    }

    simliClient.close();
    socketRef.current?.close();
    window.location.href = '/';
  }, [audioStream]);

  useEffect(() => {
    if (simliClient) {
      simliClient.on('connected', () => {
        console.log('SimliClient connected');
        setIsAvatarVisible(true);
        const audioData = new Uint8Array(6000).fill(0);
        simliClient.sendAudioData(audioData);
      });
    }
  }, []);

  useEffect(() => {
    initializeSimliClient();

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
      simliClient.close();
    };
  }, [initializeSimliClient]);

  useEffect(() => {
    if (audioStream && socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      const mediaRecorder = new MediaRecorder(audioStream);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          socketRef.current?.send(event.data);
        }
      };

      mediaRecorder.start(100);

      return () => {
        mediaRecorder.stop();
      };
    }
  }, [audioStream]);

  return (
    <>
      <div
        className={`transition-all duration-300 ${showDottedFace ? "h-0 overflow-hidden" : "h-auto"
          }`}
      >
        <VideoBox video={videoRef} audio={audioRef} />
      </div>
      <div className="flex flex-col items-center">
        {!isAvatarVisible ? (
          <button
            onClick={handleStart}
            disabled={isLoading}
            className={cn(
              "w-full h-[52px] mt-4 disabled:bg-[#343434] disabled:text-white disabled:hover:rounded-[100px] bg-simliblue text-white py-3 px-6 rounded-[100px] transition-all duration-300 hover:text-black hover:bg-white hover:rounded-sm",
              "flex justify-center items-center"
            )}
          >
            {isLoading ? (
              <IconSparkleLoader className="h-[20px] animate-loader" />
            ) : (
              <span className="font-abc-repro-mono font-bold w-[164px]">
                Test Interaction
              </span>
            )}
          </button>
        ) : (
          <div className="flex items-center gap-4 w-full">
            <button
              onClick={handleStop}
              className={cn(
                "mt-4 group text-white flex-grow bg-red hover:rounded-sm hover:bg-white h-[52px] px-6 rounded-[100px] transition-all duration-300"
              )}
            >
              <span className="font-abc-repro-mono group-hover:text-black font-bold w-[164px] transition-all duration-300">
                Stop Interaction
              </span>
            </button>
          </div>
        )}
      </div>
      {error && (
        <p className="mt-4 text-red-500 text-center">{error}</p>
      )}
    </>
  );
};

export default AvatarInteraction;
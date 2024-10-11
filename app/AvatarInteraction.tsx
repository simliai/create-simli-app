import React, { useCallback, useEffect, useRef, useState } from 'react';
import { SimliClient } from 'simli-client';
import VideoBox from './VideoBox';
interface AvatarInteractionProps {
  simli_faceid: string;
  elevenlabs_voiceid: string;
  initialPrompt: string;
  onStart: () => void;
  showDottedFace: boolean;
}

interface SimliClientConfig {
  apiKey: string;
  faceID: string;
  handleSilence: boolean;
  videoRef: React.RefObject<HTMLVideoElement>;
  audioRef: React.RefObject<HTMLAudioElement>;
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
  const [startWebRTC, setStartWebRTC] = useState(false);
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const textAreaRef = useRef<HTMLDivElement>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setAudioStream(stream);
      setIsRecording(true);
      const audioData = new Uint8Array(6000).fill(0);
      simliClient.sendAudioData(audioData);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      setError('Error accessing microphone. Please check your permissions.');
    }
  }


  /* initializeSimliClient() initializes a new client if videoRef and audioRef are set */
  const initializeSimliClient = useCallback(() => {
    if (videoRef.current && audioRef.current) {
      const SimliConfig: SimliClientConfig = {
        apiKey: process.env.NEXT_PUBLIC_SIMLI_API_KEY || '',
        faceID: simli_faceid,
        handleSilence: true,
        videoRef: videoRef,
        audioRef: audioRef,
      };

      simliClient.Initialize(SimliConfig);
      console.log('Simli Client initialized');
    }
  }, []);

  /* startConversation() queries our local backend to start an elevenLabs conversation over Websockets */
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
        throw new Error('Failed to start conversation');
      }

      const data = await response.json();
      console.log(data.message);
      setConnectionId(data.connectionId);

      // After successful response, connect to WebSocket
      initializeWebSocket(data.connectionId);
    } catch (error) {
      console.error('Error starting conversation:', error);
      setError('Failed to start conversation. Please try again.');
    }
  }, []);

  /* initializeWebSocket() sets up a websocket that we can use to talk to our local backend */
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
        const message = JSON.parse(event.data);
      }
    };

    socketRef.current.onerror = (error) => {
      console.error('WebSocket error:', error);
      setError('WebSocket connection error. Please check if the server is running.');
    };
  }, []);

  /* isWebRTCConnected() checks if SimliClient has an open data channel and peer-connection  */
  const isWebRTCConnected = useCallback(() => {
    if (!simliClient) return false;

    // Access the private properties of SimliClient
    // Note: This is not ideal and breaks encapsulation, but it avoids modifying SimliClient
    const pc = (simliClient as any).pc as RTCPeerConnection | null;
    const dc = (simliClient as any).dc as RTCDataChannel | null;

    return pc !== null &&
      pc.iceConnectionState === 'connected' &&
      dc !== null &&
      dc.readyState === 'open';
  }, []);
  const handleCancel = useCallback(async () => {
    setIsLoading(false);
    setError('');
    setStartWebRTC(false);
    setIsRecording(false);
    setAudioStream(null);
    simliClient.close();
    socketRef.current?.close();
    window.location.href = '/'; /* TODO: Is it bad practice to do this? Just sending user back to '/' */
  }, []);
  /* handleStart() is called when the Start button is called. It starts the websocket conversation and then checks if webRTC is connected   */
  const handleStart = useCallback(async () => {
    startRecording();
    onStart();
    setIsLoading(true);
    setError('');

    console.log('Starting ElevenLabs conversation');
    await startConversation();
    console.log('Starting WebRTC');
    simliClient.start();
    setStartWebRTC(true);
    /*
    // Wait for the WebRTC connection to be established
    const checkConnection = async () => {
      if (isWebRTCConnected()) {
        setIsAvatarVisible(true);
        console.log('WebRTC connection established');
        const audioData = new Uint8Array(6000).fill(0);
        simliClient.sendAudioData(audioData);
        console.log('Sent initial audio data');
      } else {
        console.log('Waiting for WebRTC connection...');
        setTimeout(checkConnection, 1000);  // Check again after 1 second
      }
    };

    setTimeout(checkConnection, 4000);  // Start checking after 4 seconds
    */
  }, []);

  useEffect(() => {
    if(simliClient) {
      simliClient.on('connected', () => {
        console.log('SimliClient connected');
        setIsAvatarVisible(true);
        const audioData = new Uint8Array(6000).fill(0);
        simliClient.sendAudioData(audioData);
        console.log('Sent initial audio data');
      });
    }
  }, [simliClient]);

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
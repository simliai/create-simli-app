import React, { useCallback, useEffect, useRef, useState } from 'react';
import { SimliClient } from 'simli-client';
import VideoBox from './VideoBox';
interface AvatarInteractionProps {
  simli_faceid: string;
  elevenlabs_voiceid: string;
  initialPrompt: string;
  audioStream: MediaStream | null;
}

const AvatarInteraction: React.FC<AvatarInteractionProps> = ({ 
  simli_faceid, 
  elevenlabs_voiceid,
  initialPrompt,
  audioStream
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [startWebRTC, setStartWebRTC] = useState(false);
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const simliClientRef = useRef<SimliClient | null>(null);
  const textAreaRef = useRef<HTMLDivElement>(null);

  /* initializeSimliClient() initializes a new client if videoRef and audioRef are set */
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
          simliClientRef.current?.sendAudioData(uint8Array);
        });
      } else {
          const message = JSON.parse(event.data);
          if (message.type === 'text') {
            console.log('Received text message:', message.content);
          }
      }
    };
  
    socketRef.current.onerror = (error) => {
      console.error('WebSocket error:', error);
      setError('WebSocket connection error. Please check if the server is running.');
    };
  }, []);

  /* isWebRTCConnected() checks if SimliClient has an open data channel and peer-connection  */
  const isWebRTCConnected = useCallback(() => {
    if (!simliClientRef.current) return false;
    
    // Access the private properties of SimliClient
    // Note: This is not ideal and breaks encapsulation, but it avoids modifying SimliClient
    const pc = (simliClientRef.current as any).pc as RTCPeerConnection | null;
    const dc = (simliClientRef.current as any).dc as RTCDataChannel | null;
    
    return pc !== null && 
           pc.iceConnectionState === 'connected' && 
           dc !== null && 
           dc.readyState === 'open';
  }, []);

    /* handleStart() is called when the Start button is called. It starts the websocket conversation and then checks if webRTC is connected   */
  const handleStart = useCallback(async () => {
    setIsLoading(true);
    setError('');

      console.log('Starting ElevenLabs conversation');
      await startConversation();
      console.log('Starting WebRTC');
      simliClientRef.current?.start();
      setStartWebRTC(true);

      // Wait for the WebRTC connection to be established
      const checkConnection = async () => {
        if (isWebRTCConnected()) {
          console.log('WebRTC connection established');
          const audioData = new Uint8Array(6000).fill(0);
          simliClientRef.current?.sendAudioData(audioData);
          console.log('Sent initial audio data');
        } else {
          console.log('Waiting for WebRTC connection...');
          setTimeout(checkConnection, 1000);  // Check again after 1 second
        }
      };

      setTimeout(checkConnection, 4000);  // Start checking after 4 seconds
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
    <VideoBox video={videoRef} audio={audioRef} />
      {startWebRTC ? (
        <div ref={textAreaRef} className="w-full h-32 bg-black-800 text-white p-2 overflow-y-auto">
        </div>
      ) : (
        <button
          onClick={handleStart}
          disabled={isLoading}
          className="w-full bg-white text-black py-2 px-4 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Starting...' : 'Start Interaction'}
        </button>
      )}
      {error && <p className="mt-4 text-red-500">{error}</p>}
    </>
  );
};

export default AvatarInteraction;
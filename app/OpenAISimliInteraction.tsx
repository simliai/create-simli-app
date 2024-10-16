import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RealtimeClient } from '@openai/realtime-api-beta';
import { SimliClient } from 'simli-client';
import VideoBox from './VideoBox';

interface OpenAISimliInteractionProps {
  simli_faceid: string;
  initialPrompt: string;
  onStart: () => void;
  showDottedFace: boolean;
}

const OpenAISimliInteraction: React.FC<OpenAISimliInteractionProps> = ({
  simli_faceid,
  initialPrompt,
  onStart,
  showDottedFace
}) => {
  // State management
  const [isLoading, setIsLoading] = useState(false);
  const [isAvatarVisible, setIsAvatarVisible] = useState(false);
  const [error, setError] = useState('');

  // Refs for various components and states
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const simliClientRef = useRef<SimliClient | null>(null);
  const openAIClientRef = useRef<RealtimeClient | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentResponseIdRef = useRef<string | null>(null);
  const lastPlayedSampleRef = useRef(0);
  const isAssistantSpeakingRef = useRef(false);
  const audioBufferRef = useRef<Int16Array[]>([]);
  const audioTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isFirstChunkRef = useRef(true);

  // New state for audio threshold
  const [audioThreshold, setAudioThreshold] = useState(0.1);
  
  // New ref for tracking continuous frames above threshold
  const framesAboveThresholdRef = useRef(0);
  const FRAMES_TO_TRIGGER_INTERRUPT = 5; // Number of consecutive frames above threshold to trigger interruption

  /**
   * Initializes the Simli client with the provided configuration.
   */
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
      simliClientRef.current.Initialize(SimliConfig as any);
      console.log('Simli Client initialized');
    }
  }, [simli_faceid]);

  /**
   * Initializes the OpenAI client, sets up event listeners, and connects to the API.
   */
  const initializeOpenAIClient = useCallback(async () => {
    try {
      console.log('Initializing OpenAI client...');
      openAIClientRef.current = new RealtimeClient({
        apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
        dangerouslyAllowAPIKeyInBrowser: true,
      });

      await openAIClientRef.current.updateSession({
        instructions: initialPrompt,
        voice: 'echo',
        turn_detection: { type: 'server_vad' },
        input_audio_transcription: { model: 'whisper-1' },
      });

      // Set up event listeners
      openAIClientRef.current.on('conversation.updated', handleConversationUpdate);
      openAIClientRef.current.on('response.created', handleResponseCreated);
      openAIClientRef.current.on('response.audio.delta', handleAudioDelta);
      openAIClientRef.current.on('response.done', handleResponseDone);
      openAIClientRef.current.on('input_audio_buffer.speech_started', handleSpeechStarted);
      openAIClientRef.current.on('input_audio_buffer.speech_stopped', handleSpeechStopped);
      openAIClientRef.current.on('response.canceled', handleResponseCanceled);

      await openAIClientRef.current.connect();
      console.log('OpenAI Client connected successfully');

      // Dispatch a test event
      openAIClientRef.current.dispatch('conversation.item.create', {
        item: {
          type: 'message',
          role: 'user',
          content: [{ type: 'text', text: 'Hello, OpenAI!' }]
        }
      });

    } catch (error: any) {
      console.error('Error initializing OpenAI client:', error);
      setError(`Failed to initialize OpenAI client: ${error.message}`);
    }
  }, [initialPrompt]);

  /**
   * Handles conversation updates, including user and assistant messages.
   */
  const handleConversationUpdate = useCallback((event: any) => {
    console.log('Conversation updated:', event);
    const { item, delta } = event;
  
    if (item.type === 'message' && item.role === 'user') {
      console.log('User speech detected');
      if (isAssistantSpeakingRef.current) {
        console.log('Attempting to interrupt assistant');
        handleSpeechStarted();
      }
    } else if (item.type === 'message' && item.role === 'assistant') {
      console.log('Assistant message detected');
      isAssistantSpeakingRef.current = true;
      if (delta && delta.audio) {
        const downsampledAudio = downsampleAudio(delta.audio, 24000, 16000);
        if (isFirstChunkRef.current) {
          simliClientRef.current?.sendAudioData(downsampledAudio as any);
          console.log('Sent first audio chunk to Simli immediately:', downsampledAudio.length);
          isFirstChunkRef.current = false;
          scheduleNextAudioChunk();
        } else {
          audioBufferRef.current.push(downsampledAudio);
        }
      }
    }
  }, []);

  /**
   * Schedules the next audio chunk to be sent to Simli.
   */
  const scheduleNextAudioChunk = useCallback(() => {
    if (audioTimeoutRef.current) {
      clearTimeout(audioTimeoutRef.current);
    }
  
    if (audioBufferRef.current.length > 0) {
      const audioChunk = audioBufferRef.current.shift();
      if (audioChunk) {
        simliClientRef.current?.sendAudioData(audioChunk as any);
        console.log('Sent audio chunk to Simli:', audioChunk.length);
  
        const chunkDurationMs = (audioChunk.length / 16000) * 1000;
        const adjustedDelay = Math.min(chunkDurationMs, 250);
  
        audioTimeoutRef.current = setTimeout(() => {
          scheduleNextAudioChunk();
        }, adjustedDelay);
      }
    } else {
      isFirstChunkRef.current = true;
    }
  }, []);

  /**
   * Handles the creation of a new response from the assistant.
   */
  const handleResponseCreated = useCallback((event: any) => {
    console.log('Response created:', event);
    currentResponseIdRef.current = event.response.id;
    lastPlayedSampleRef.current = 0;
    isAssistantSpeakingRef.current = true;
    isFirstChunkRef.current = true;
  }, []);

  /**
   * Handles audio delta events from the OpenAI API.
   */
  const handleAudioDelta = useCallback((event: any) => {
    console.log('Audio delta received:', event);
    lastPlayedSampleRef.current += event.delta.audio.length;
  }, []);

  /**
   * Handles the completion of an assistant's response.
   */
  const handleResponseDone = useCallback(() => {
    console.log('Response done');
    isAssistantSpeakingRef.current = false;
    currentResponseIdRef.current = null;
    lastPlayedSampleRef.current = 0;
    isFirstChunkRef.current = true;
    if (audioTimeoutRef.current) {
      clearTimeout(audioTimeoutRef.current);
    }
  }, []);

  /**
   * Handles the start of user speech, potentially interrupting the assistant.
   */
  const handleSpeechStarted = useCallback(() => {
    console.log('Speech started event received');
    console.log('isAssistantSpeaking:', isAssistantSpeakingRef.current);
    console.log('currentResponseId:', currentResponseIdRef.current);
  
    console.log('Interrupting assistant');
    
    audioBufferRef.current = [];
    console.log('Cleared audio buffer.');

    openAIClientRef.current?.dispatch('response.cancel', {
      response_id: currentResponseIdRef.current
    });
    console.log('Cancelling AI speech from the server.');

    openAIClientRef.current?.dispatch('output_audio_buffer.clear', {});
    console.log('Cleared OpenAI output audio buffer.');

    isAssistantSpeakingRef.current = false;
    currentResponseIdRef.current = null;
    lastPlayedSampleRef.current = 0;
    isFirstChunkRef.current = true;
    if (audioTimeoutRef.current) {
      clearTimeout(audioTimeoutRef.current);
    }
    console.log('Reset all states after interruption');
  }, []);

  /**
   * Handles the end of user speech.
   */
  const handleSpeechStopped = useCallback((event: any) => {
    console.log('Speech stopped event received', event);
  }, []);

  /**
   * Handles the cancellation of an assistant's response.
   */
  const handleResponseCanceled = useCallback((event: any) => {
    console.log('Response canceled:', event);
    isAssistantSpeakingRef.current = false;
    currentResponseIdRef.current = null;
    lastPlayedSampleRef.current = 0;
    audioBufferRef.current = [];
    isFirstChunkRef.current = true;
    if (audioTimeoutRef.current) {
      clearTimeout(audioTimeoutRef.current);
    }
    console.log('Reset all states after response cancellation');
  }, []);

  /**
   * Downsamples audio data from one sample rate to another.
   */
  const downsampleAudio = (audioData: Int16Array, inputSampleRate: number, outputSampleRate: number): Int16Array => {
    if (inputSampleRate === outputSampleRate) {
      return audioData;
    }

    const ratio = inputSampleRate / outputSampleRate;
    const newLength = Math.round(audioData.length / ratio);
    const result = new Int16Array(newLength);

    for (let i = 0; i < newLength; i++) {
      const index = Math.round(i * ratio);
      result[i] = audioData[index];
    }

    return result;
  };

  /**
   * Starts audio recording from the user's microphone.
   */
  const startRecording = useCallback(async () => {
    try {
      console.log('Starting audio recording...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContextRef.current = new AudioContext({ sampleRate: 24000 });
      const source = audioContextRef.current.createMediaStreamSource(stream);
      const processor = audioContextRef.current.createScriptProcessor(2048, 1, 1);

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const audioData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          audioData[i] = Math.max(-32768, Math.min(32767, Math.floor(inputData[i] * 32768)));
        }
        openAIClientRef.current?.appendInputAudio(audioData);
        
        const audioLevel = Math.sqrt(inputData.reduce((sum, val) => sum + val * val, 0) / inputData.length);
        console.log('Audio level:', audioLevel);

        // Check if audio level is above threshold
        if (audioLevel > audioThreshold) {
          framesAboveThresholdRef.current++;
          if (framesAboveThresholdRef.current >= FRAMES_TO_TRIGGER_INTERRUPT) {
            if (isAssistantSpeakingRef.current) {
              console.log('Audio threshold reached. Interrupting assistant.');
              handleSpeechStarted();
            }
          }
        } else {
          framesAboveThresholdRef.current = 0;
        }
      };

      source.connect(processor);
      processor.connect(audioContextRef.current.destination);
      console.log('Audio recording started');
    } catch (err) {
      console.error('Error accessing microphone:', err);
      setError('Error accessing microphone. Please check your permissions.');
    }
  }, [audioThreshold]);

  /**
   * Handles the start of the interaction, initializing clients and starting recording.
   */
  const handleStart = useCallback(async () => {
    setIsLoading(true);
    setError('');
    onStart();

    try {
      await initializeOpenAIClient();
      await simliClientRef.current?.start();
      await startRecording();

    } catch (error: any) {
      console.error('Error starting interaction:', error);
      setError(`Error starting interaction: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [initializeOpenAIClient, onStart, startRecording]);

  /**
   * Handles stopping the interaction, cleaning up resources and resetting states.
   */
  const handleStop = useCallback(() => {
    console.log('Stopping interaction...');
    setIsLoading(false);
    setError('');
    setIsAvatarVisible(false);
    simliClientRef.current?.close();
    openAIClientRef.current?.disconnect();
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    if (audioTimeoutRef.current) {
      clearTimeout(audioTimeoutRef.current);
    }
    currentResponseIdRef.current = null;
    lastPlayedSampleRef.current = 0;
    isAssistantSpeakingRef.current = false;
    audioBufferRef.current = [];
    isFirstChunkRef.current = true;
    console.log('Interaction stopped');
  }, []);

  // Effect to initialize Simli client and clean up resources on unmount
  useEffect(() => {
    initializeSimliClient();

    if(simliClientRef.current) {
      simliClientRef.current?.on('connected', () => {
        console.log('SimliClient connected');
        setIsAvatarVisible(true);
        const audioData = new Uint8Array(6000).fill(0);
        simliClientRef.current?.sendAudioData(audioData);
        console.log('Sent initial audio data');
      });
    }

    return () => {
      simliClientRef.current?.close();
      openAIClientRef.current?.disconnect();
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (audioTimeoutRef.current) {
        clearTimeout(audioTimeoutRef.current);
      }
    };
  }, [initializeSimliClient]);



  return (
    <>
      <div className={`transition-all duration-300 ${showDottedFace ? 'h-0 overflow-hidden' : 'h-auto'}`}>
        <VideoBox video={videoRef} audio={audioRef} />
      </div>
      <div className="flex justify-center">
        {!isAvatarVisible ? (
          <button
            onClick={handleStart}
            disabled={isLoading}
            className="w-full mt-4 bg-simliblue text-white py-3 px-6 rounded-[100px] transition-all duration-300 hover:text-black hover:bg-white hover:rounded-sm"
          >
            <span className="font-abc-repro-mono font-bold w-[164px]">
              {isLoading ? 'Loading...' : 'Start Interaction'}
            </span>
          </button>
        ) : (
          <button
            onClick={handleStop}
            className="w-full mt-4 bg-red-600 text-white py-3 justify-center rounded-[100px] backdrop-blur transition-all duration-300 hover:bg-white hover:text-black hover:rounded-sm px-6"
          >
            <span className="font-abc-repro-mono font-bold w-[164px]">
              Stop Interaction
            </span>
          </button>
        )}
      </div>
      <div>
        <p>OpenAI Client Status: {openAIClientRef.current ? 'Initialized' : 'Not Initialized'}</p>
        <p>Assistant speaking: {isAssistantSpeakingRef.current ? 'Yes' : 'No'}</p>
        <p>Current response ID: {currentResponseIdRef.current}</p>
        <p>Last played sample: {lastPlayedSampleRef.current}</p>
        <p>Error: {error}</p>
        <div>
          <label htmlFor="audioThreshold">Audio Threshold:</label>
          <input
            type="range"
            id="audioThreshold"
            min="0"
            max="1"
            step="0.01"
            value={audioThreshold}
            onChange={(e) => setAudioThreshold(parseFloat(e.target.value))}
          />
          <span>{audioThreshold}</span>
        </div>
      </div>
    </>
  );
};

export default OpenAISimliInteraction;
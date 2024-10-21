import React, { useCallback, useEffect, useRef, useState } from "react";
import { RealtimeClient } from "@openai/realtime-api-beta";
import { SimliClient } from "simli-client";
import VideoBox from "./VideoBox";
import cn from "./utils/TailwindMergeAndClsx";
import IconExit from "@/media/IconExit";
import IconSparkleLoader from "@/media/IconSparkleLoader";

interface OpenAISimliInteractionProps {
  simli_faceid: string;
  initialPrompt: string;
  onStart: () => void;
  showDottedFace: boolean;
}

const simliClient = new SimliClient();

const OpenAISimliInteraction: React.FC<OpenAISimliInteractionProps> = ({
  simli_faceid,
  initialPrompt,
  onStart,
  showDottedFace,
}) => {
  // State management
  const [isLoading, setIsLoading] = useState(false);
  const [isAvatarVisible, setIsAvatarVisible] = useState(false);
  const [error, setError] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [userMessage, setUserMessage] = useState("...");
  const [isButtonDisabled, setIsButtonDisabled] = useState(false);

  // Refs for various components and states
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const openAIClientRef = useRef<RealtimeClient | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  // New refs for managing audio chunk delay
  const audioChunkQueueRef = useRef<Int16Array[]>([]);
  const isProcessingChunkRef = useRef(false);

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

      simliClient.Initialize(SimliConfig as any);
      console.log("Simli Client initialized");
    }
  }, [simli_faceid]);

  /**
   * Initializes the OpenAI client, sets up event listeners, and connects to the API.
   */
  const initializeOpenAIClient = useCallback(async () => {
    try {
      console.log("Initializing OpenAI client...");
      openAIClientRef.current = new RealtimeClient({
        apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
        dangerouslyAllowAPIKeyInBrowser: true,
      });

      await openAIClientRef.current.updateSession({
        instructions: initialPrompt,
        voice: "echo",
        turn_detection: { type: "server_vad" },
        input_audio_transcription: { model: "whisper-1" },
      });

      // Set up event listeners
      openAIClientRef.current.on(
        "conversation.updated",
        handleConversationUpdate
      );
      openAIClientRef.current.on(
        "input_audio_buffer.speech_stopped",
        handleSpeechStopped
      );
      // openAIClientRef.current.on('response.canceled', handleResponseCanceled);

      await openAIClientRef.current.connect();
      console.log("OpenAI Client connected successfully");

      setIsAvatarVisible(true);
    } catch (error: any) {
      console.error("Error initializing OpenAI client:", error);
      setError(`Failed to initialize OpenAI client: ${error.message}`);
    }
  }, [initialPrompt]);

  /**
   * Handles conversation updates, including user and assistant messages.
   */
  const handleConversationUpdate = useCallback((event: any) => {
    console.log("Conversation updated:", event);
    const { item, delta } = event;

    if (item.type === "message" && item.role === "assistant") {
      console.log("Assistant message detected");
      if (delta && delta.audio) {
        const downsampledAudio = downsampleAudio(delta.audio, 24000, 16000);
        audioChunkQueueRef.current.push(downsampledAudio);
        if (!isProcessingChunkRef.current) {
          processNextAudioChunk();
        }
      }
    } else if (item.type === "message" && item.role === "user") {
      setUserMessage(item.content[0].transcript);
    }
  }, []);

  /**
   * Processes the next audio chunk in the queue.
   */
  const processNextAudioChunk = useCallback(() => {
    if (
      audioChunkQueueRef.current.length > 0 &&
      !isProcessingChunkRef.current
    ) {
      isProcessingChunkRef.current = true;
      const audioChunk = audioChunkQueueRef.current.shift();
      if (audioChunk) {
        const chunkDurationMs = (audioChunk.length / 16000) * 1000; // Calculate chunk duration in milliseconds

        // Send audio chunks to Simli immediately
        simliClient?.sendAudioData(audioChunk as any);
        console.log(
          "Sent audio chunk to Simli:",
          chunkDurationMs,
          "Duration:",
          chunkDurationMs.toFixed(2),
          "ms"
        );
        isProcessingChunkRef.current = false;
        processNextAudioChunk();
      }
    }
  }, []);

  /**
   * Handles the end of user speech.
   */
  const handleSpeechStopped = useCallback((event: any) => {
    console.log("Speech stopped event received", event);
  }, []);

  /**
   * Downsamples audio data from one sample rate to another.
   */
  const downsampleAudio = (
    audioData: Int16Array,
    inputSampleRate: number,
    outputSampleRate: number
  ): Int16Array => {
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
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext({ sampleRate: 24000 });
    }

    try {
      console.log("Starting audio recording...");
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      const source = audioContextRef.current.createMediaStreamSource(
        streamRef.current
      );
      processorRef.current = audioContextRef.current.createScriptProcessor(
        2048,
        1,
        1
      );

      processorRef.current.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const audioData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          audioData[i] = Math.max(
            -32768,
            Math.min(32767, Math.floor(inputData[i] * 32768))
          );
        }
        openAIClientRef.current?.appendInputAudio(audioData);
      };

      source.connect(processorRef.current);
      processorRef.current.connect(audioContextRef.current.destination);
      setIsRecording(true);
      console.log("Audio recording started");
    } catch (err) {
      console.error("Error accessing microphone:", err);
      setError("Error accessing microphone. Please check your permissions.");
    }
  }, []);

  /**
   * Stops audio recording from the user's microphone
   */
  const stopRecording = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsRecording(false);
    console.log("Audio recording stopped");
  }, []);

  /**
   * Handles the start of the interaction, initializing clients and starting recording.
   */
  const handleStart = useCallback(async () => {
    setIsLoading(true);
    setError("");
    onStart();

    try {
      await simliClient?.start();
      await initializeOpenAIClient();
      setIsAvatarVisible(true);
    } catch (error: any) {
      console.error("Error starting interaction:", error);
      setError(`Error starting interaction: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [initializeOpenAIClient, onStart]);

  /**
   * Handles stopping the interaction, cleaning up resources and resetting states.
   */
  const handleStop = useCallback(() => {
    console.log("Stopping interaction...");
    setIsLoading(false);
    setError("");
    setIsAvatarVisible(false);
    simliClient?.close();
    openAIClientRef.current?.disconnect();
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    stopRecording();
    console.log("Interaction stopped");
  }, [stopRecording]);

  // Push-to-talk button handlers
  const handlePushToTalkStart = useCallback(() => {
    if (!isButtonDisabled) {
      startRecording();
    }
  }, [startRecording, isButtonDisabled]);

  const handlePushToTalkEnd = useCallback(() => {
    stopRecording();
    setIsButtonDisabled(true);
    setTimeout(() => {
      setIsButtonDisabled(false);
    }, 300); // 300ms delay before allowing the button to be pressed again
  }, [stopRecording]);

  // Visualize mic audio
  const AudioVisualizer = () => {
    const [volume, setVolume] = useState(0);

    useEffect(() => {
      const interval = setInterval(() => {
        setVolume(Math.random() * 100);
      }, 100);

      return () => clearInterval(interval);
    }, []);

    return (
      <div className="flex items-end justify-center space-x-1 h-5">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="w-2 bg-black transition-all duration-300 ease-in-out"
            style={{
              height: `${Math.min(100, volume + Math.random() * 20)}%`,
            }}
          />
        ))}
      </div>
    );
  };

  // Effect to initialize Simli client and clean up resources on unmount
  useEffect(() => {
    initializeSimliClient();

    if (simliClient) {
      simliClient?.on("connected", () => {
        console.log("SimliClient connected");
        const audioData = new Uint8Array(6000).fill(0);
        simliClient?.sendAudioData(audioData);
        console.log("Sent initial audio data");
      });
    }

    return () => {
      simliClient?.close();
      openAIClientRef.current?.disconnect();
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [initializeSimliClient]);

  return (
    <>
      <div
        className={`transition-all duration-300 ${
          showDottedFace ? "h-0 overflow-hidden" : "h-auto"
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
          <>
            <div className="flex items-center gap-4 w-full">
              <button
                onMouseDown={handlePushToTalkStart}
                onTouchStart={handlePushToTalkStart}
                onMouseUp={handlePushToTalkEnd}
                onTouchEnd={handlePushToTalkEnd}
                onMouseLeave={handlePushToTalkEnd}
                disabled={isButtonDisabled}
                className={cn(
                  "mt-4 text-white flex-grow bg-simliblue hover:rounded-sm hover:bg-opacity-70 h-[52px] px-6 rounded-[100px] transition-all duration-300",
                  isRecording && "bg-[#1B1B1B] rounded-sm hover:bg-opacity-100"
                )}
              >
                <span className="font-abc-repro-mono font-bold w-[164px]">
                  {isRecording ? "Release to Stop" : "Push & hold to talk"}
                </span>
              </button>
              <button
                onClick={handleStop}
                className=" group w-[52px] h-[52px] flex items-center mt-4 bg-red-600 text-white justify-center rounded-[100px] backdrop-blur transition-all duration-300 hover:bg-white hover:text-black hover:rounded-sm"
              >
                <IconExit className="group-hover:invert-0 group-hover:brightness-0 transition-all duration-300" />
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default OpenAISimliInteraction;

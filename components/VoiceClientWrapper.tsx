import React, { useState, useEffect, useRef} from 'react';
import dynamic from 'next/dynamic';
import { config } from './config'; // Make sure this path is correct

const SimliIntegratedVoiceClientAudioWrapper = dynamic(
  () => import('./SimliIntegratedVoiceClientAudioWrapper'),
  { ssr: false }
);

interface VoiceClientWrapperProps {
  children?: React.ReactNode;
}

const VoiceClientWrapper: React.FC<VoiceClientWrapperProps> = ({ children }) => {
  const [voiceClient, setVoiceClient] = useState<{ client: any; VoiceClientProvider: any } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const initializeVoiceClient = async () => {
      try {
        const { DailyVoiceClient } = await import('realtime-ai-daily');
        const { VoiceClientProvider } = await import('realtime-ai-react');

        const client = new DailyVoiceClient({
          baseUrl: "/api/dailybotApi",
          enableMic: true,
          enableCam: false,
          services: {
          stt: "deepgram",
          tts: "cartesia",
          llm: "anthropic"
        },
          config: [
          {
            service: "vad",
            options: [
              {
                name: "params",
                value: {
                  stop_secs: 0.3
                }
              }
            ]
          },
          {
            service: "tts",
            options: [
              {
                name: "voice",
                value: config.voiceId
              },
              {
                name: "model",
                value: "sonic-english"
              },
              {
                name: "language",
                value: "en"
              },
              {
                name: "sample_rate",
                value: 16000
              }
            ]
          },
          {
            service: "llm",
            options: [
              {
                name: "model",
                value: "claude-3-5-sonnet-20240620"
              },
              {
                name: "initial_messages",
                value: [
                  {
                    role: "user",
                    content: [
                      {
                        type: "text",
                        text: config.initialPrompt
                      }
                    ]
                  }
                ]
              },
              {
                name: "run_on_config",
                value: true
              }
            ]
          },
          {
            service: "stt",
            options: [
              {
                name: "model",
                value: "nova-2-conversationalai"
              },
              {
                name: "language",
                value: "en"
              }
            ]
          }
        ],
          callbacks: {
            onBotReady: () => console.log("Bot is ready!"),
            onMetrics: (metrics) => console.log("Metrics:", metrics),
            onUserStartedSpeaking: () => console.log("User started speaking at: ", new Date().toLocaleTimeString()),
            onUserStoppedSpeaking: () => console.log("User stopped speaking at: ", new Date().toLocaleTimeString())
          }
        });

        await client.start();
        setVoiceClient({ client, VoiceClientProvider });
      } catch (e) {
        console.error("Error initializing voice client:", e);
        setError(e instanceof Error ? e.message : "Unknown error occurred");
      }
    };

    initializeVoiceClient();
    console.log("initial prompt", config.initialPrompt);

    return () => {
      if (voiceClient && voiceClient.client) {
        voiceClient.client.disconnect();
      }
    };
  }, []);

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (!voiceClient) {
    return <div>Loading voice client...</div>;
  }

  const { client, VoiceClientProvider } = voiceClient;

  return (
    <VoiceClientProvider voiceClient={client}>
      {children}
      <SimliIntegratedVoiceClientAudioWrapper />
    </VoiceClientProvider>
  );
};

export default VoiceClientWrapper;
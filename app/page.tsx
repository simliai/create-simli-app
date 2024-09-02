'use client';
import React, { useCallback, useEffect, useState } from 'react';
import AvatarInteraction from './AvatarInteraction';
import Navbar from './Navbar';
import { Avatar } from './types';
// Update the Avatar interface to include an image URL
interface Avatar {
  name: string;
  simli_faceid: string;
  elevenlabs_voiceid: string;
  initialPrompt: string;
  imageUrl: string;
}

// Updated JSON structure for avatar data with image URLs
const avatar = {
    name: "Einstein",
    simli_faceid: "d3376e76-8830-4b86-84d0-86f25332c92e",
    elevenlabs_voiceid: "kFsnovBBn69vNsybyS3T",
    initialPrompt: "You are Einstein. Start with a short greeting. Keep your responses shorter than 50 tokens",
    imageUrl: "/characters/einstein.jpg"
}

const Demo: React.FC = () => {
  const [error, setError] = useState('');
  const [chatgptText, setChatgptText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [selectedAvatar, setSelectedAvatar] = useState<Avatar | null>(null);

  const handleChatGPTTextChange = useCallback((newText: string) => {
    console.log('Updating chatgptText:', newText);
    setChatgptText(newText);
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setAudioStream(stream);
      setIsRecording(true);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      setError('Error accessing microphone. Please check your permissions.');
    }
  }, []);

  const stopRecording = useCallback(() => {
    setIsRecording(false);
    if (audioStream) {
      audioStream.getTracks().forEach(track => track.stop());
    }
    setAudioStream(null);
  }, [audioStream]);

  useEffect(() => {
    setSelectedAvatar(avatar)
  }
  , [selectedAvatar]);
  return (
    <div className="bg-black min-h-screen flex flex-col items-center font-mono text-white p-8">
      <Navbar/>
      <h1 className="text-4xl font-bold mb-8">Create Simli App</h1>
      {false ? (
          <button 
          onClick={() => setSelectedAvatar(avatar)} 
          className="bg-black-600 text-white py-2 px-6 rounded-full hover:bg-simliblue transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900"
        >
          ← Start interaction
        </button>
      ) : (
        <div className="w-full max-w-2xl flex flex-col items-center gap-6">
          <div className="bg-effect15White p-6 rounded-xl w-full">
            <h2 className="text-2xl font-bold mb-4"></h2>
            <AvatarInteraction
              simli_faceid={avatar.simli_faceid}
              elevenlabs_voiceid={avatar.elevenlabs_voiceid}
              initialPrompt={avatar.initialPrompt}
              chatgptText={chatgptText}
              onChatGPTTextChange={handleChatGPTTextChange}
              audioStream={audioStream}
            />
            <button
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onTouchStart={startRecording}
              onTouchEnd={stopRecording}
              className="w-full mt-4 bg-gradient-to-r from-simliblue to-simliblue text-white py-3 px-6 rounded-lg hover:from-blue-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 transition-all duration-300"
            >
              {isRecording ? 'Listening...' : 'Start'}
            </button>
          </div>
        </div>
      )}
      <div className="w-full max-w-2xl flex flex-col items-center gap-6 my-16">
        <ul>
        <li>1. Start by putting in environment variables</li>
        <li>2. Create a <code>.env.local</code> file in the root of the project and add the following environment variables:</li>
        <code>
          SIMLI_API_KEY=your-simli-api-key <br/>
          GROQ_API_KEY=your-groq-api-key <br/>
          DEEPGRAM_API_KEY=your-deepgram-api-key <br/>
          ELEVENLABS_API_KEY=your-elevenlabs-api-key <br/>
        </code>
        </ul>
        <p>Note: If you want to try Simli but don't have API access to these third parties, ask in Discord and we can help you out with that.</p>

        <h1>Alternative STT, TTS and LLM providers</h1>
        <p>You can of course replace Deepgram and Elevenlabs with AI services with your own preference, or even build your own. The only requirement for Simli to work is that audio is sent using PCM16 format and 16KHz sample rate. If you're having trouble getting nice audio, feel free to ask for help in Discord.</p>
        <p>To run the back-end and the app, run the following command:</p>
        <code>npm run start</code>
        <img src="/api/placeholder/200/200" alt="Einstein"></img>
        <img src="/api/placeholder/200/200" alt="Character 2"></img>
        <img src="/api/placeholder/200/200" alt="Character 3"></img>
        <img src="/api/placeholder/200/200" alt="Character 4"></img>
        <h2>Characters</h2>
        <p>You'll start with Einstein but you can add more characters by <a href="https://simli.com">creating your own</a> or finding one that you like in the <a href="https://docs.simli.com">docs</a>.</p>

        <h2>Deploy on Vercel</h2>
        <p>The easiest way to deploy your avatar interaction to use the <a href="https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme">Vercel Platform</a>.</p>
    </div>
      {error && <p className="mt-6 text-red-500 bg-red-100 border border-red-400 rounded p-3">{error}</p>}
    </div>
  );
};

export default Demo;
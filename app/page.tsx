'use client';
import React, { useState } from 'react';
import AvatarInteraction from './AvatarInteraction';
import DottedFace from './DottedFace';
import SimliHeaderLogo from './Logo';
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
    name: "Chrystal",
    simli_faceid: "b7da5ed1-2abc-47c8-b7a6-0b018e031a26",
    elevenlabs_voiceid: "cgSgspJ2msm6clMCkdW9",
    initialPrompt: "Say this introduction: Welcome to your local Create-Simli-App, the interactive demo for Simli that you can start building from. You can swap me out with other characters.",
}



const Demo: React.FC = () => {
  const [error, setError] = useState('');
  const [showDottedFace, setShowDottedFace] = useState(true);

  const [isRecording, setIsRecording] = useState(false);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);

  const onStart = () => {
    console.log("Setting setshowDottedface to false...")
    setShowDottedFace(false);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setAudioStream(stream);
      setIsRecording(true);
      const audioData = new Uint8Array(6000).fill(0);
      simliClientRef.current?.sendAudioData(audioData);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      setError('Error accessing microphone. Please check your permissions.');
    }
  }

  
  return (
    <div className="bg-black min-h-screen flex flex-col items-center font-mono text-white p-8">
      <SimliHeaderLogo/>
      <Navbar/>
        <div className="w-full max-w-2xl flex flex-col items-center gap-6">
          <div className="bg-effect15White p-6 rounded-xl w-full">
            <h2 className="text-2xl font-bold mb-4"></h2>
            {showDottedFace && <DottedFace/>}
            <AvatarInteraction
              simli_faceid={avatar.simli_faceid}
              elevenlabs_voiceid={avatar.elevenlabs_voiceid}
              initialPrompt={avatar.initialPrompt}
              onStart={onStart}
              showDottedFace={showDottedFace}
            />
          </div>
        </div>
      <div className="w-full max-w-2xl flex flex-col items-center gap-6 my-16">
      Create Simli App is a starter repo for creating an interactive app with Simli. 

        <ol className="list-decimal mt-4 pt-4 pb-4 mb-4"> 

          <li>
          Fill in your API keys in the .env file.
          </li>
          <li>
          Test out the interaction and have a conversation with our default avatar. 
          </li>
          <li>
         You can replace the avatar's face and voice and initial prompt with your own. Do this by editing <code>app/page.tsx</code>.
          </li>
        </ol>
      You can now deploy this app to Vercel, or incorporate it as part of your existing project.  
       {/*  <p>You can replace the character by <a href="https://simli.com">creating your own</a> or finding one that you like in the <a href="https://docs.simli.com">docs</a>.</p> */}
    </div>
      {error && <p className="mt-6 text-red-500 bg-red-100 border border-red-400 rounded p-3">{error}</p>}
    </div>
  );
};

export default Demo;
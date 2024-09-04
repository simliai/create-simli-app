'use client';
import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import SimliHeaderLogo from './Logo';
import Navbar from './Navbar';
import DottedFace from './DottedFace';

// Dynamically import VoiceClientWrapper with no SSR
const VoiceClientWrapper = dynamic(
  () => import('../components/VoiceClientWrapper'),
  { ssr: false }
);

// Configuration for the avatar
const config = {
  name: "Chrystal",
  faceId: "b7da5ed1-2abc-47c8-b7a6-0b018e031a26",
  voiceId: "f9836c6e-a0bd-460e-9d3c-f7299fa60f94", // Replace with your DailyBots voice ID
  initialPrompt: "You are a young american woman named Ailana, who is a loan officer working for 'Your Financial Institution'. You are helping the caller with their loan refinancing. Keep responses brief and legible. Your responses will converted to audio. Please do not include any special characters in your response other than '!' or '?'. Start by briefly introducing yourself.",
};

const Demo: React.FC = () => {
  const [isInteracting, setIsInteracting] = useState(false);

  const handleStart = () => {
    setIsInteracting(true);
  };

  const handleStop = () => {
    setIsInteracting(false);
  };

  return (
    <div className="bg-black min-h-screen flex flex-col items-center font-mono text-white p-8">
      <SimliHeaderLogo/>
      <Navbar/>
      <div className="w-full max-w-2xl flex flex-col items-center gap-6">
        <div className="bg-effect15White p-6 rounded-xl w-full">
          <h2 className="text-2xl font-bold mb-4"></h2>
          {!isInteracting && <DottedFace />}
          {isInteracting && <VoiceClientWrapper />}
          <div className="flex justify-center mt-4">
            {isInteracting ? (
              <button
                onClick={handleStop}
                className="w-2/3 bg-red-600 text-white py-3 px-6 rounded-xl hover:bg-red-700 transition-all duration-300"
              >
                Stop Interaction
              </button>
            ) : (
              <button
                onClick={handleStart}
                className="w-2/3 bg-gradient-to-r from-simliblue to-simliblue text-white py-3 px-6 rounded-xl hover:from-simliblue-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 transition-all duration-300"
              >
                Start Interaction
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="w-full max-w-2xl flex flex-col items-center gap-6 my-16">
        <p>Create Simli App is a starter repo for creating an interactive app with Simli and DailyBots.</p>
        <ol className="list-decimal mt-4 pt-4 pb-4 mb-4">
          <li>Fill in your API keys in the .env file.</li>
          <li>Test out the interaction and have a conversation with our default avatar.</li>
          <li>You can replace the avatar's face and voice and initial prompt with your own. Do this by editing the config object in this file.</li>
        </ol>
        <p>You can now deploy this app to Vercel, or incorporate it as part of your existing project.</p>
      </div>
    </div>
  );
};

export default Demo;
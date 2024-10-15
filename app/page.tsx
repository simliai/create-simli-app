'use client';
import React, { useState } from 'react';
import OpenAISimliInteraction from './OpenAISimliInteraction';
import DottedFace from './DottedFace';
import SimliHeaderLogo from './Logo';
import Navbar from './Navbar';

const avatar = {
  name: "Chrystal",
  simli_faceid: "8e8c1a57-3f83-4861-8661-1882a879bce9",
  initialPrompt: "You are a helpful AI assistant named Chrystal. You are friendly and concise in your responses. Your task is to help users with any questions they might have.",
};

const Demo: React.FC = () => {
  const [showDottedFace, setShowDottedFace] = useState(true);

  const onStart = () => {
    console.log("Setting setshowDottedface to false...");
    setShowDottedFace(false);
  };

  return (
    <div className="bg-black min-h-screen flex flex-col items-center font-abc-repro font-normal text-sm text-white p-8">
      <SimliHeaderLogo />
      <Navbar />
      <div className="absolute top-[32px] right-[32px]">
        <text className="font-bold mb-8 text-xl leading-8">Create OpenAI-Simli App</text>
      </div>
      <div className="flex flex-col items-center gap-6 bg-effect15White p-6 pb-[40px] rounded-xl w-full">
        <div>
          {showDottedFace && <DottedFace />}
          <OpenAISimliInteraction
            simli_faceid={avatar.simli_faceid}
            initialPrompt={avatar.initialPrompt}
            onStart={onStart}
            showDottedFace={showDottedFace}
          />
        </div>
      </div>

      <div className="max-w-[350px] font-thin flex flex-col items-center ">
        <span className="font-bold mb-[8px] leading-5 "> Create OpenAI-Simli App is a starter repo for creating an interactive app with OpenAI's Realtime API and Simli's avatar visualization. </span>
        <ul className="list-decimal list-inside max-w-[350px] ml-[6px] mt-2">
          <li className="mb-1">
            Fill in your OpenAI and Simli API keys in the .env file.
          </li>
          <li className="mb-1">
            Test out the interaction and have a conversation with the OpenAI-powered, Simli-visualized avatar.
          </li>
          <li className="mb-1">
            You can replace the avatar's face ID and initial prompt with your own. Do this by editing <code>app/page.tsx</code>.
          </li>
        </ul>
        <span className=" mt-[16px]">You can now deploy this app to Vercel, or incorporate it as part of your existing project.</span>
      </div>
    </div>
  );
};

export default Demo;
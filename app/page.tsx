'use client';
import React, { useState } from 'react';
import OpenAISimliInteraction from './OpenAISimliInteraction';
import DottedFace from './DottedFace';
import SimliHeaderLogo from './Logo';
import Navbar from './Navbar';
import Image from "next/image";
import GitHubLogo from "@/media/github-mark-white.svg";

const avatar = {
  name: "Frank",
  simli_faceid: "5514e24d-6086-46a3-ace4-6a7264e5cb7c",
  initialPrompt: "You are a helpful AI assistant named Frank. You are friendly and concise in your responses. Your task is to help users with any questions they might have.",
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
        <text onClick={() => {window.open("https://github.com/simliai")}} className="font-bold cursor-pointer mb-8 text-xl leading-8"><Image className='w-[20px] inline mr-2' src={GitHubLogo} alt='' />create-simli-app (OpenAI)</text>
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
        <span className="font-bold mb-[8px] leading-5 "> Create Simli App is a starter repo for creating visual avatars with Simli </span>
        <ul className="list-decimal list-inside max-w-[350px] ml-[6px] mt-2">
          <li className="mb-1">
            Fill in your OpenAI and Simli API keys in .env file.
          </li>
          <li className="mb-1">
            Test out the interaction and have a talk with the OpenAI-powered, Simli-visualized avatar.
          </li>
          <li className="mb-1">
            You can replace the avatar's face and prompt with your own. Do this by editing <code>app/page.tsx</code>.
          </li>
        </ul>
        <span className=" mt-[16px]">You can now deploy this app to Vercel, or incorporate it as part of your existing project.</span>
      </div>
    </div>
  );
};

export default Demo;
"use client";
import AvatarInteraction from "@/app/AvatarInteraction";
import DottedFace from "@/app/components/DottedFace";
import SimliHeaderLogo from "@/app/components/Logo";
import Navbar from "@/app/components/Navbar";
import GitHubLogo from "@/media/github-mark-white.svg";
import Image from "next/image";
import { useCallback, useState } from "react";

// The avatar's face, voice and persona are configured on the server:
// SIMLI_FACE_ID / ELEVENLABS_VOICE_ID in .env, and the prompt in server/config.ts.
export default function Demo() {
  const [showDottedFace, setShowDottedFace] = useState(true);
  const onActiveChange = useCallback((active: boolean) => setShowDottedFace(!active), []);

  return (
    <div className="bg-black min-h-screen flex flex-col items-center font-abc-repro font-normal text-sm text-white p-8">
      <SimliHeaderLogo />
      <Navbar />
      <div className="absolute top-[32px] right-[32px]">
        <a
          href="https://github.com/simliai/create-simli-app"
          target="_blank"
          rel="noopener noreferrer"
          className="font-bold cursor-pointer mb-8 text-xl leading-8"
        >
          <Image className="w-[20px] inline mr-2" src={GitHubLogo} alt="" />
          create-simli-app
        </a>
      </div>
      <div className="flex flex-col items-center gap-6 bg-effect15White p-6 pb-[40px] rounded-xl w-full">
        <div className="flex flex-col items-center">
          {showDottedFace && <DottedFace />}
          <AvatarInteraction onActiveChange={onActiveChange} showDottedFace={showDottedFace} />
        </div>
      </div>

      <div className="max-w-[350px] font-thin flex flex-col items-center">
        <span className="font-bold mb-[8px] leading-5">
          Create Simli App is a starter repo for creating an interactive app with Simli.
        </span>
        <ul className="list-decimal list-inside max-w-[350px] ml-[6px] mt-2">
          <li className="mb-1">Fill in your API keys in the .env file (see .env.example).</li>
          <li className="mb-1">Test out the interaction and have a conversation with the default avatar.</li>
          <li className="mb-1">
            Swap the face and voice with <code>SIMLI_FACE_ID</code> and <code>ELEVENLABS_VOICE_ID</code>, and edit
            the persona in <code>server/config.ts</code>.
          </li>
        </ul>
        <span className="mt-[16px]">
          Before deploying, add sign-in and rate limiting to the session endpoint (see the README).
        </span>
      </div>
    </div>
  );
}

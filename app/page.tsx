"use client";

import AvatarInteraction from "@/app/AvatarInteraction";
import DottedFace from "@/app/components/DottedFace";
import SimliHeaderLogo from "@/app/components/Logo";
import { useCallback, useState } from "react";

const REPO_URL = "https://github.com/simliai/create-simli-app";

const links = [
  { href: "https://docs.simli.com", label: "Docs" },
  { href: "https://discord.gg/yQx49zNF4d", label: "Discord" },
  { href: REPO_URL, label: "GitHub" },
];

const code = "font-abc-repro-mono text-xs";

// The avatar's face, voice and persona are configured on the server:
// SIMLI_FACE_ID / ELEVENLABS_VOICE_ID in .env, and the prompt in server/config.ts.
export default function Demo() {
  const [showDottedFace, setShowDottedFace] = useState(true);
  const onActiveChange = useCallback((active: boolean) => setShowDottedFace(!active), []);

  return (
    <div className="bg-black min-h-screen flex flex-col font-abc-repro font-normal text-sm text-white">
      <header className="w-full max-w-[1100px] mx-auto flex items-center justify-between px-6 py-6">
        <SimliHeaderLogo />
        <nav className="flex items-center gap-6 text-gray-300">
          {links.map((l) => (
            <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" className="hover:text-white">
              {l.label}
            </a>
          ))}
        </nav>
      </header>

      <main className="flex-1 w-full max-w-[1100px] mx-auto flex flex-col items-center px-6 pb-12">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold leading-tight">Talk to a custom voice pipeline</h1>
          <p className="text-gray-400 mt-2">
            Deepgram hears you, OpenAI answers, ElevenLabs speaks, and a Simli avatar shows it.
          </p>
        </div>

        <div className="w-full max-w-[960px]">
          {showDottedFace && <DottedFace />}
          <AvatarInteraction onActiveChange={onActiveChange} showDottedFace={showDottedFace} />
        </div>

        <section className="w-full max-w-[960px] mt-12 rounded-lg border border-white/10 p-6 text-gray-300">
          <h2 className="text-white font-bold mb-4">Run it yourself</h2>
          <ol className="grid gap-4 sm:grid-cols-3">
            <li>
              <span className="block text-white mb-1">1. Add your keys</span>
              Copy <code className={code}>.env.example</code> to <code className={code}>.env</code> and add your Simli,
              Deepgram, OpenAI and ElevenLabs keys.
            </li>
            <li>
              <span className="block text-white mb-1">2. Start it</span>
              Run <code className={code}>npm install</code> and <code className={code}>npm run dev</code>, then open
              this page.
            </li>
            <li>
              <span className="block text-white mb-1">3. Make it yours</span>
              Set <code className={code}>SIMLI_FACE_ID</code> and <code className={code}>ELEVENLABS_VOICE_ID</code>,
              and edit the prompt in <code className={code}>server/config.ts</code>.
            </li>
          </ol>
          <p className="mt-6 text-xs text-gray-500">
            Before deploying, add sign-in and rate limiting to the session endpoint. See the{" "}
            <a
              href={`${REPO_URL}#before-you-deploy`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-white"
            >
              README
            </a>
            .
          </p>
        </section>
      </main>
    </div>
  );
}

import AvatarCall from "./components/AvatarCall";
import SimliHeaderLogo from "./components/Logo";

const REPO_URL = "https://github.com/simliai/create-simli-app";

const links = [
  { href: "https://docs.simli.com", label: "Docs" },
  { href: "https://discord.gg/yQx49zNF4d", label: "Discord" },
  { href: REPO_URL, label: "GitHub" },
];

const code = "font-abc-repro-mono text-xs whitespace-nowrap";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-black font-abc-repro text-sm font-normal text-white">
      <header className="mx-auto flex w-full max-w-[1100px] items-center justify-between px-6 py-6">
        <SimliHeaderLogo />
        <nav className="flex items-center gap-6 text-gray-300">
          {links.map((l) => (
            <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" className="hover:text-white">
              {l.label}
            </a>
          ))}
        </nav>
      </header>

      <main className="mx-auto flex w-full max-w-[1100px] flex-1 flex-col items-center px-6 pb-12">
        <div className="mb-6 text-center">
          <h1 className="text-2xl leading-tight font-bold">Talk to a voice pipeline</h1>
          <p className="mt-2 text-gray-400">
            Deepgram hears you, OpenAI answers, ElevenLabs speaks, and a Simli avatar shows it — orchestrated by
            LiveKit Agents.
          </p>
        </div>

        <div className="w-full max-w-[960px]">
          <AvatarCall />
        </div>

        <section className="mt-12 w-full max-w-[960px] rounded-lg border border-white/10 p-6 text-gray-300">
          <h2 className="mb-4 font-bold text-white">Run it yourself</h2>
          <ol className="grid gap-4 sm:grid-cols-3">
            <li>
              <span className="mb-1 block text-white">1. Add your keys</span>
              Copy <code className={code}>.env.example</code> to <code className={code}>.env</code> and add your
              Simli, LiveKit, Deepgram, OpenAI and ElevenLabs keys. Put the same LiveKit values in{" "}
              <code className={code}>frontend/.env.local</code>.
            </li>
            <li>
              <span className="mb-1 block text-white">2. Start it</span>
              Run <code className={code}>uv run agent.py dev</code>, then{" "}
              <code className={code}>npm run dev</code> in <code className={code}>frontend/</code>, and open this
              page.
            </li>
            <li>
              <span className="mb-1 block text-white">3. Make it yours</span>
              Set <code className={code}>SIMLI_FACE_ID</code> for another avatar and{" "}
              <code className={code}>ELEVENLABS_VOICE_ID</code> for its voice. The prompt is in{" "}
              <code className={code}>agent.py</code>.
            </li>
          </ol>
          <p className="mt-6 text-xs text-gray-500">
            Before deploying, put <code className={code}>/api/token</code> behind your own sign-in. See the{" "}
            <a
              href={`${REPO_URL}#before-you-go-to-production`}
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

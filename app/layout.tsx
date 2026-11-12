import type { Metadata } from "next";
import { abcRepro, abcReproMono } from "./fonts/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Create Simli App",
  description: "Talk to a real-time Simli avatar: Deepgram + OpenAI + ElevenLabs + Simli in Next.js.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${abcReproMono.variable} ${abcRepro.variable}`}>
      <body>{children}</body>
    </html>
  );
}

import localFont from "next/font/local";

// ABC Repro, Simli's typeface.
export const abcRepro = localFont({
  src: [
    { path: "./ABCRepro-Regular.woff2", weight: "400", style: "normal" },
    { path: "./ABCRepro-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-repro",
});

export const abcReproMono = localFont({
  src: [
    { path: "./ABCReproMono-Regular.woff2", weight: "400", style: "normal" },
    { path: "./ABCReproMono-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-repro-mono",
});

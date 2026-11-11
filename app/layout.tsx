import type { Metadata } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CortexOS — AI-Native Software & Second Brain Operating System",
  description:
    "CortexOS combines the 4C Second Brain (3D Knowledge Graph, Chief Librarian, LLM Wiki) with the Jarvis Supervisor, 7 Specialist Studios, and the War Room execution interface.",
  openGraph: {
    title: "CortexOS — AI-Native Software & Second Brain Operating System",
    description:
      "CortexOS combines the 4C Second Brain (3D Knowledge Graph, Chief Librarian, LLM Wiki) with the Jarvis Supervisor, 7 Specialist Studios, and the War Room execution interface.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "CortexOS — AI-Native Software & Second Brain Operating System",
    description:
      "CortexOS combines the 4C Second Brain (3D Knowledge Graph, Chief Librarian, LLM Wiki) with the Jarvis Supervisor, 7 Specialist Studios, and the War Room execution interface.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${jakarta.variable} ${jetbrainsMono.variable} dark`}>
      <body
        suppressHydrationWarning
        className="bg-[#050814] text-slate-100 font-sans antialiased selection:bg-cyan-500/30 selection:text-cyan-200"
      >
        {children}
      </body>
    </html>
  );
}

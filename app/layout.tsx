import type { Metadata } from "next";
import { Syne, Plus_Jakarta_Sans, Space_Mono } from "next/font/google";
import "./globals.css";

const syne = Syne({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--font-display",
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CortexOS — Technical Systematic AI-Native Operating System",
  description:
    "CortexOS combines the 4C Second Brain (3D Knowledge Graph, Chief Librarian, LLM Wiki) with the Jarvis Supervisor, 7 Specialist Studios, and the War Room execution interface.",
  openGraph: {
    title: "CortexOS — Technical Systematic AI-Native Operating System",
    description:
      "CortexOS combines the 4C Second Brain (3D Knowledge Graph, Chief Librarian, LLM Wiki) with the Jarvis Supervisor, 7 Specialist Studios, and the War Room execution interface.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "CortexOS — Technical Systematic AI-Native Operating System",
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
    <html
      lang="en"
      suppressHydrationWarning
      className={`${syne.variable} ${jakarta.variable} ${spaceMono.variable} dark`}
    >
      <body
        suppressHydrationWarning
        className="bg-[#0c0d0f] text-[#e4e6eb] font-sans text-[13px] antialiased selection:bg-[#00ffa3] selection:text-black"
      >
        {children}
      </body>
    </html>
  );
}

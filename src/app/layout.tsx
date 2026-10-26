import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Schibsted_Grotesk, DM_Mono, Noto_Serif_Ethiopic, Noto_Sans_Ethiopic } from "next/font/google";
import "./globals.css";

const display = Instrument_Serif({ subsets: ["latin"], weight: "400", variable: "--font-display", display: "swap" });
const body = Schibsted_Grotesk({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-body", display: "swap" });
const mono = DM_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono", display: "swap" });
const ethiopicDisplay = Noto_Serif_Ethiopic({ subsets: ["ethiopic"], weight: "400", variable: "--font-ethiopic-display", display: "swap" });
const ethiopicBody = Noto_Sans_Ethiopic({ subsets: ["ethiopic"], weight: ["400", "500"], variable: "--font-ethiopic-body", display: "swap" });

export const metadata: Metadata = {
  title: "Teach-Back",
  description: "A safety net for medical interpreting in Amharic and Afaan Oromo. Flags the facts a human must confirm; never advises a patient.",
};

export const viewport: Viewport = { themeColor: "#0B0A09", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={[display.variable, body.variable, mono.variable, ethiopicDisplay.variable, ethiopicBody.variable].join(" ")}>
      <body>{children}</body>
    </html>
  );
}

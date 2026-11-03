import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import RegisterSW from "@/components/sw";
// F14 — Bengali is bundled, not device-dependent: Noto Sans Bengali
// (OFL) regular + bold live in src/app/fonts/ and are served from
// this app (font-src 'self' in the CSP). No Google Fonts download
// at build or runtime, so the build works offline and Bengali text
// never depends on the user's device having the font installed.
// Hind Siliguri remains a named fallback in the CSS font stack.
const bengali = localFont({
  src: [
    { path: "./fonts/noto-sans-bengali-regular.ttf", weight: "400", style: "normal" },
    { path: "./fonts/noto-sans-bengali-bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-bengali",
  display: "swap",
});
export const metadata: Metadata = {
  title: "Communica — Social Communication",
  description: "Communica is a WhatsApp-like social communication app. Inside it lives SAZMU AI, an AI chatbot — always labelled AI, never a real human.",
  manifest: "/manifest.webmanifest",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#075E54", viewportFit: "cover" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en" className={bengali.variable}><body><RegisterSW />{children}</body></html>);
}

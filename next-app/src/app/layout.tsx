import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import RegisterSW from "@/components/sw";
import ThemeProvider from "@/components/theme-provider";
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
// themeColor is the static browser-chrome fallback BEFORE any theme
// resolves; it is Theme V's header (#5B21B6), i.e. the fallback theme
// itself — not a separate app colour. Per-theme browser chrome is not
// possible from static metadata; the in-app header follows data-theme.
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#5B21B6", viewportFit: "cover" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en" data-theme="v" className={bengali.variable}><body>
    {/* Pre-paint theme: apply the logged-in user's mirror instantly so
        the first paint already uses their theme. Token-gated on
        purpose: logged-out pages must use the PLATFORM DEFAULT
        (resolved by ThemeProvider), never a previous user's mirror. */}
    <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem("communica_token");var m=localStorage.getItem("communica_theme");if(t&&["p","v","c","d"].indexOf(m)>=0){document.documentElement.setAttribute("data-theme",m);}}catch(e){}})();` }} />
    <ThemeProvider /><RegisterSW />{children}</body></html>);
}

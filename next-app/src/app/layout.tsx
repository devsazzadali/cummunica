import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Bengali } from "next/font/google";
import "./globals.css";
import RegisterSW from "@/components/sw";
import ThemeProvider from "@/components/theme-provider";
// Premium fonts 2026-11-03 (replaces the temporary system-font
// fallback AND the bundled TTF plan): Inter for Latin + Noto Sans
// Bengali for Bengali, via next/font/google. Next.js downloads the
// font files at BUILD time and serves them from this site itself
// (_next/static), so at runtime there is no external font request,
// CSP font-src 'self' still holds, and no binary TTF needs to be
// pushed to GitHub or uploaded via the web UI. The old TTF upload
// step is therefore no longer needed. --font-sans in globals.css
// puts these two variables first, then device fallbacks.
const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], display: "swap", variable: "--font-latin" });
const bengali = Noto_Sans_Bengali({ subsets: ["bengali"], weight: ["400", "700"], display: "swap", variable: "--font-bengali" });
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
  return (<html lang="en" data-theme="v" className={`${inter.variable} ${bengali.variable}`}><body>
    {/* Pre-paint theme: apply the logged-in user's mirror instantly so
        the first paint already uses their theme. Token-gated on
        purpose: logged-out pages must use the PLATFORM DEFAULT
        (resolved by ThemeProvider), never a previous user's mirror. */}
    <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem("communica_token");var m=localStorage.getItem("communica_theme");if(t&&["p","v","c","d"].indexOf(m)>=0){document.documentElement.setAttribute("data-theme",m);}}catch(e){}})();` }} />
    <ThemeProvider /><RegisterSW />{children}</body></html>);
}

import type { Metadata, Viewport } from "next";
import "./globals.css";
import RegisterSW from "@/components/sw";
import ThemeProvider from "@/components/theme-provider";
// TEMPORARY deploy unblock 2026-11-03 (revert when TTFs land in repo):
// F14 bundled localFont is DISABLED here because the Noto Sans Bengali
// TTFs are binary files that the snapshot push cannot carry, so they
// are missing from GitHub and Vercel's build fails on the missing
// ./fonts/*.ttf import. Until the 2 TTFs are uploaded to
// next-app/src/app/fonts/ via the GitHub website, Bengali renders
// from the device's own "Noto Sans Bengali" / "Hind Siliguri" fonts
// (already in the --font-sans fallback chain in globals.css).
// No Google Fonts download is introduced by this fallback.
// TO REVERT: restore the localFont block below (from git history /
// local copy) once the TTFs exist in the repo, then rebuild.
//   const bengali = localFont({
//     src: [
//       { path: "./fonts/noto-sans-bengali-regular.ttf", weight: "400", style: "normal" },
//       { path: "./fonts/noto-sans-bengali-bold.ttf", weight: "700", style: "normal" },
//     ],
//     variable: "--font-bengali",
//     display: "swap",
//   });
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
  return (<html lang="en" data-theme="v"><body>
    {/* Pre-paint theme: apply the logged-in user's mirror instantly so
        the first paint already uses their theme. Token-gated on
        purpose: logged-out pages must use the PLATFORM DEFAULT
        (resolved by ThemeProvider), never a previous user's mirror. */}
    <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem("communica_token");var m=localStorage.getItem("communica_theme");if(t&&["p","v","c","d"].indexOf(m)>=0){document.documentElement.setAttribute("data-theme",m);}}catch(e){}})();` }} />
    <ThemeProvider /><RegisterSW />{children}</body></html>);
}

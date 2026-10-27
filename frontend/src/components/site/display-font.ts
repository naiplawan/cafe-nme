import { Noto_Sans_Thai } from "next/font/google";

// Thai has no condensed display face, so the variable width axis of Noto Sans Thai sets headlines.
// Loaded here, not in the root layout, so app screens do not download the wider font file.
// Keep the default preload: preload: false saves no bytes (the file is used on every page that loads it)
// and delays the headline swap from ~1.1 s to ~2.2 s on a throttled connection.
export const displayFont = Noto_Sans_Thai({ variable: "--font-display-thai", subsets: ["latin", "thai"], axes: ["wdth"] });

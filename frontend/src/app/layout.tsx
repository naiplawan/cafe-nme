import type { Metadata } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import type { ReactNode } from "react";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

const notoSansThai = Noto_Sans_Thai({
  variable: "--font-noto-sans-thai",
  subsets: ["latin", "thai"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Cafe'nMe", template: "%s · Cafe'nMe" },
  description: "ระบบจัดการร้านกาแฟและหน้าร้านที่ใช้งานง่าย",
  // App screens stay out of search by default; public pages opt in (see app/page.tsx).
  robots: { index: false, follow: false },
  openGraph: { type: "website", locale: "th_TH", siteName: "Cafe'nMe" },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="th" className={`${notoSansThai.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

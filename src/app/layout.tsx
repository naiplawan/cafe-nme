import type { Metadata } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const notoSansThai = Noto_Sans_Thai({
  variable: "--font-noto-sans-thai",
  subsets: ["latin", "thai"],
});

export const metadata: Metadata = {
  title: "Cafe'nMe",
  description: "ระบบจัดการร้านกาแฟและหน้าร้านที่ใช้งานง่าย",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="th" className={`${notoSansThai.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

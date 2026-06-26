import type { Metadata } from "next";
import { Press_Start_2P, VT323 } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const pixel = Press_Start_2P({
  variable: "--font-pixel",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const vt = VT323({
  variable: "--font-vt",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  title: "雨中骑车上学路 · Pixel Ride",
  description:
    "像素风第一人称骑车游戏：撑伞、躲蜗牛、避行人、甩开追你的同学，别被水坑溅一身！",
  keywords: ["pixel game", "bicycle", "umbrella", "rain", "像素游戏", "骑车"],
  authors: [{ name: "Pixel Ride" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body
        className={`${pixel.variable} ${vt.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}

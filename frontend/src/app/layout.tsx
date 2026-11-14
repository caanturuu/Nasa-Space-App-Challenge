import type { Metadata } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Mars Maps — Layered Martian Surface & EVA Planner",
  description:
    "Bing-Maps-style Mars orbital explorer integrating NASA MOLA, Viking, MRO CTX, terrain-aware EVA routing (IAU_2015:49900), and live surface conditions.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${jakarta.variable} ${jetbrainsMono.variable}`}>
      <body className="antialiased selection:bg-orange-100 selection:text-orange-950">
        {children}
      </body>
    </html>
  );
}

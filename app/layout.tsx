import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LLM4Writing Vercel Native",
  description: "Vercel-native rewrite of LLM4Writing"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}

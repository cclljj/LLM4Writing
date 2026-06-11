import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "LLM4Writing 寫作學習平台",
    template: "%s | LLM4Writing"
  },
  description: "AI 輔助寫作教學與學習歷程平台"
};

/**
 * #386: Read the per-request nonce injected by middleware.ts so that
 * Next.js can attach it to its own inline scripts during hydration.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="zh-Hant">
      <body>
        {/* Pass nonce as a data attribute so client-side scripts can read it
            if needed. Next.js automatically propagates the nonce to its own
            generated inline scripts when it detects a nonce in the CSP. */}
        {nonce ? <meta name="csp-nonce" content={nonce} /> : null}
        {children}
      </body>
    </html>
  );
}

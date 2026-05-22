import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  title: "LLM4Writing Vercel Native",
  description: "Vercel-native rewrite of LLM4Writing"
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

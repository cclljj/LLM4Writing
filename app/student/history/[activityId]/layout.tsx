import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "學習歷程"
};

export default function StudentHistoryLayout({ children }: { children: React.ReactNode }) {
  return children;
}

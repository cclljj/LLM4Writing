import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "教師管理台"
};

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return children;
}

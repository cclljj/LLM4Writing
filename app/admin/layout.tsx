import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "系統管理台"
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}

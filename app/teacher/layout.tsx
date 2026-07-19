import type { Metadata } from "next";
import { requireProtectedPage } from "@/src/lib/page-auth";

export const metadata: Metadata = {
  title: "教師管理台"
};

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  await requireProtectedPage("teacher");
  return children;
}

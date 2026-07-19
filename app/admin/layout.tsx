import type { Metadata } from "next";
import { requireProtectedPage } from "@/src/lib/page-auth";

export const metadata: Metadata = {
  title: "系統管理台"
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireProtectedPage("admin");
  return children;
}

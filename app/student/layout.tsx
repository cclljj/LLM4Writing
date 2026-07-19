import type { Metadata } from "next";
import { requireProtectedPage } from "@/src/lib/page-auth";
import StudentTopHeader from "./_components/StudentTopHeader";

export const metadata: Metadata = {
  title: "學生學習頁"
};

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  await requireProtectedPage("student");
  return (
    <>
      <StudentTopHeader />
      {children}
    </>
  );
}

import type { Metadata } from "next";
import StudentTopHeader from "./_components/StudentTopHeader";

export const metadata: Metadata = {
  title: "學生學習頁"
};

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <StudentTopHeader />
      {children}
    </>
  );
}

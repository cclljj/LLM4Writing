import StudentTopHeader from "./_components/StudentTopHeader";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <StudentTopHeader />
      {children}
    </>
  );
}

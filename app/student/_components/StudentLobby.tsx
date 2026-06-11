"use client";

import { useRouter } from "next/navigation";
import { formatTaipeiDateTime } from "@/src/lib/time-format";

type Course = {
  id: string;
  classNumber: string;
  title: string;
  genre: string;
  essayDescription?: string;
  durationMinutes: number;
  supplemental: string;
  groupStatus?: string;
  courseStatus?: "not_started" | "in_progress" | "paused" | "ended";
};

type ParticipatedCourse = {
  activityId: string;
  title: string;
  classNumber: string;
  lastSessionId: string;
  lastStep: number;
  lastParticipatedAt: string;
  sessionCount: number;
};

type StudentLobbyProps = {
  isLoadingOverview: boolean;
  profile: { name?: string; school?: string; classNumber?: string; ownerTeacherUsername?: string } | null;
  classCourses: Course[];
  activeCourses: Course[];
  upcomingCourses: Course[];
  pausedCourses: Course[];
  participatedCourses: ParticipatedCourse[];
  onJoinActivity: (activityId: string) => void;
  onPrepareCourse: (course: Course) => void;
};

export default function StudentLobby({
  isLoadingOverview,
  profile,
  classCourses,
  activeCourses,
  upcomingCourses,
  pausedCourses,
  participatedCourses,
  onJoinActivity,
  onPrepareCourse,
}: StudentLobbyProps) {
  const router = useRouter();

  return (
    <>
      {isLoadingOverview ? (
        <div className="card" style={{ borderColor: "var(--info-accent)", background: "var(--info-bg-strong)", padding: "14px 16px" }}>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--info-text)" }}>系統正在載入資料中，請稍候...</p>
          <small style={{ display: "block", marginTop: 6, color: "var(--info-text)" }}>載入完成後會自動顯示課程清單。</small>
        </div>
      ) : null}

      <div className="card">
        <h2>進行中課程（本班）</h2>
        {activeCourses.length === 0 ? <small>目前沒有進行中的課程。</small> : null}
        {activeCourses.map((course) => (
          <div key={course.id} style={{ borderTop: "1px solid var(--line-soft)", padding: "10px 0" }}>
            <strong>{course.title}</strong>（班級 {course.classNumber} / {course.genre} / {course.durationMinutes} 分鐘）
            <div>
              <small>分組狀態：{course.groupStatus ?? "尚未分組"}</small>
            </div>
            <div className="row" style={{ marginTop: 8 }}>
              <div style={{ width: 180 }}>
                <button type="button" onClick={() => onJoinActivity(course.id)}>
                  進入課程
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>尚未開始課程（本班）</h2>
        <small>
          班級：{profile?.classNumber ?? "—"} / 學校：{profile?.school ?? "—"}
        </small>
        {upcomingCourses.length === 0 ? <small style={{ display: "block", marginTop: 8 }}>目前沒有尚未開始課程。</small> : null}
        {upcomingCourses.map((course) => (
          <div key={course.id} style={{ borderTop: "1px solid var(--line-soft)", padding: "10px 0" }}>
            <strong>{course.title}</strong>（班級 {course.classNumber} / {course.genre} / {course.durationMinutes} 分鐘）
            <div>
              <small>分組狀態：{course.groupStatus ?? "尚未分組"}</small>
            </div>
            <div className="row" style={{ marginTop: 8 }}>
              <div style={{ width: 180 }}>
                <button type="button" onClick={() => onPrepareCourse(course)}>
                  進入課程
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>暫停中課程（本班）</h2>
        {pausedCourses.length === 0 ? <small>目前沒有暫停中的課程。</small> : null}
        {pausedCourses.map((course) => (
          <div key={course.id} style={{ borderTop: "1px solid var(--line-soft)", padding: "10px 0" }}>
            <strong>{course.title}</strong>（班級 {course.classNumber} / {course.genre}）
            <div>
              <small>課程目前暫停中，請等待老師繼續上課。</small>
            </div>
            <div>
              <small>分組狀態：{course.groupStatus ?? "尚未分組"}</small>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>自己參與過的課程清單</h2>
        {participatedCourses.length === 0 ? <small>目前沒有已參與課程紀錄。</small> : null}
        {participatedCourses.map((course) => (
          <div key={course.activityId} style={{ borderTop: "1px solid var(--line-soft)", padding: "10px 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <div>
                <strong>{course.title}</strong>（班級 {course.classNumber}）
                <div>
                  <small>
                    最近參與：{formatTaipeiDateTime(course.lastParticipatedAt)} / 最近步驟 Step {course.lastStep} / 參與次數 {course.sessionCount}
                  </small>
                </div>
              </div>
              <button
                type="button"
                className="secondary"
                style={{ width: "fit-content", padding: "4px 10px", whiteSpace: "nowrap", flex: "0 0 auto" }}
                onClick={() => router.push(`/student/history/${course.activityId}`)}
              >
                查詢紀錄
              </button>
            </div>
          </div>
        ))}
      </div>

      {classCourses.length === 0 ? (
        <div className="card card-info">
          <h2>目前沒有可顯示課程</h2>
          <small>請確認老師已建立寫作任務，且你的學校與班級資料設定正確。</small>
        </div>
      ) : null}
    </>
  );
}

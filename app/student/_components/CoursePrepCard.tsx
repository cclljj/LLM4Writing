"use client";

import { memo } from "react";

type PrepCourse = {
  id: string;
  title: string;
  classNumber: string;
  genre: string;
  durationMinutes: number;
};

function CoursePrepCard({
  course,
  onJoin,
  onRefresh,
  onLeave
}: {
  course: PrepCourse;
  onJoin: (activityId: string) => void;
  onRefresh: () => void;
  onLeave: () => void;
}) {
  return (
    <div className="card card-info">
      <h2>準備開始上課</h2>
      <p><strong>{course.title}</strong></p>
      <p>班級：{course.classNumber} / 文體：{course.genre} / 討論時長：{course.durationMinutes} 分鐘</p>
      <small>你已進入準備階段，請等待老師點選「開始上課」。</small>
      <div className="row" style={{ marginTop: 10 }}>
        <div style={{ width: 220 }}>
          <button type="button" onClick={() => onJoin(course.id)}>檢查並進入討論</button>
        </div>
        <div style={{ width: 180 }}>
          <button type="button" className="secondary" onClick={onRefresh}>重新整理狀態</button>
        </div>
        <div style={{ width: 180 }}>
          <button type="button" className="secondary" onClick={onLeave}>離開準備</button>
        </div>
      </div>
    </div>
  );
}

export default memo(CoursePrepCard);

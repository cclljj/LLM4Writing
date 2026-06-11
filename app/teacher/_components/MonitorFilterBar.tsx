"use client";

import { memo } from "react";

function MonitorFilterBar({
  schoolFilter,
  classFilter,
  courseFilter,
  statusFilter,
  schoolOptions,
  classOptions,
  courseOptions,
  onSchoolChange,
  onClassChange,
  onCourseChange,
  onStatusChange
}: {
  schoolFilter: string;
  classFilter: string;
  courseFilter: string;
  statusFilter: string;
  schoolOptions: string[];
  classOptions: string[];
  courseOptions: Array<{ id: string; label: string }>;
  onSchoolChange: (value: string) => void;
  onClassChange: (value: string) => void;
  onCourseChange: (value: string) => void;
  onStatusChange: (value: string) => void;
}) {
  return (
    <div className="row" style={{ marginBottom: 10, gap: 8 }}>
      <div className="col">
        <label>學校篩選</label>
        <select value={schoolFilter} onChange={(e) => onSchoolChange(e.target.value)}>
          <option value="all">全部</option>
          {schoolOptions.map((school) => (
            <option key={school} value={school}>
              {school}
            </option>
          ))}
        </select>
      </div>
      <div className="col">
        <label>班級篩選</label>
        <select value={classFilter} onChange={(e) => onClassChange(e.target.value)}>
          <option value="all">全部</option>
          {classOptions.map((classNumber) => (
            <option key={classNumber} value={classNumber}>
              {classNumber}
            </option>
          ))}
        </select>
      </div>
      <div className="col">
        <label>課程篩選</label>
        <select value={courseFilter} onChange={(e) => onCourseChange(e.target.value)}>
          <option value="all">全部</option>
          {courseOptions.map((course) => (
            <option key={course.id} value={course.id}>
              {course.label}
            </option>
          ))}
        </select>
      </div>
      <div className="col">
        <label>狀態篩選</label>
        <select value={statusFilter} onChange={(e) => onStatusChange(e.target.value)}>
          <option value="all">全部</option>
          <option value="not_started">尚未開始</option>
          <option value="in_progress">進行中</option>
          <option value="paused">暫停中</option>
          <option value="ended">已結束</option>
        </select>
      </div>
    </div>
  );
}

export default memo(MonitorFilterBar);

"use client";

import { useEffect, useState } from "react";
import { deferStateUpdate } from "@/src/lib/defer-state-update";
import { fetchStudentJson, getStudentRetryableMessage } from "@/src/lib/student-page-helpers";
import { Course, ParticipatedCourse } from "./student-session-types";

export type ActivityStatusMap = Record<string, "not_started" | "in_progress" | "paused" | "ended">;

// Lobby/overview data for the student page (#459): profile, visible course
// lists and the per-activity course-status map used to gate interactions.
export function useStudentOverview(input: {
  authReady: boolean;
  loginUser: string;
  setError: (message: string) => void;
}) {
  const { authReady, loginUser, setError } = input;
  const [profile, setProfile] = useState<{ name?: string; school?: string; classNumber?: string; ownerTeacherUsername?: string } | null>(null);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [classCourses, setClassCourses] = useState<Course[]>([]);
  const [upcomingCourses, setUpcomingCourses] = useState<Course[]>([]);
  const [activeCourses, setActiveCourses] = useState<Course[]>([]);
  const [pausedCourses, setPausedCourses] = useState<Course[]>([]);
  const [participatedCourses, setParticipatedCourses] = useState<ParticipatedCourse[]>([]);
  const [activityStatusMap, setActivityStatusMap] = useState<ActivityStatusMap>({});
  const [isLoadingOverview, setIsLoadingOverview] = useState(false);

  async function refreshOverview() {
    setIsLoadingOverview(true);
    try {
      const { data } = await fetchStudentJson<{
        profile?: { name?: string; school?: string; classNumber?: string; ownerTeacherUsername?: string } | null;
        missingFields?: string[];
        classCourses?: Course[];
        upcomingCourses?: Course[];
        activeCourses?: Course[];
        pausedCourses?: Course[];
        participatedCourses?: ParticipatedCourse[];
      }>("/api/student/overview", { cache: "no-store" });
      setProfile(data.profile ?? null);
      setMissingFields(data.missingFields ?? []);
      setClassCourses(data.classCourses ?? []);
      setUpcomingCourses(data.upcomingCourses ?? []);
      setActiveCourses(data.activeCourses ?? []);
      setPausedCourses(data.pausedCourses ?? []);
      setParticipatedCourses(data.participatedCourses ?? []);
      const allCourses: Course[] = [
        ...(data.classCourses ?? []),
        ...(data.upcomingCourses ?? []),
        ...(data.activeCourses ?? []),
        ...(data.pausedCourses ?? [])
      ];
      const statusMap = allCourses.reduce((acc, course) => {
        if (course.id && course.courseStatus) acc[course.id] = course.courseStatus;
        return acc;
      }, {} as ActivityStatusMap);
      setActivityStatusMap(statusMap);
      setError("");
    } catch {
      setError(getStudentRetryableMessage("overview"));
    } finally {
      setIsLoadingOverview(false);
    }
  }

  async function refreshActivityStatuses() {
    const { data } = await fetchStudentJson<{ activities?: Course[] }>("/api/student/activities", { cache: "no-store" });
    const list: Course[] = data.activities ?? [];
    const statusMap = list.reduce((acc, course) => {
      if (course.id && course.courseStatus) acc[course.id] = course.courseStatus;
      return acc;
    }, {} as ActivityStatusMap);
    setActivityStatusMap(statusMap);
  }

  useEffect(() => {
    if (!authReady || !loginUser) return;
    deferStateUpdate(() => {
      refreshOverview().catch(() => undefined);
    });
    // refreshOverview is stable per render and intentionally not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, loginUser]);

  return {
    profile,
    missingFields,
    classCourses,
    upcomingCourses,
    activeCourses,
    pausedCourses,
    participatedCourses,
    activityStatusMap,
    isLoadingOverview,
    refreshOverview,
    refreshActivityStatuses
  };
}

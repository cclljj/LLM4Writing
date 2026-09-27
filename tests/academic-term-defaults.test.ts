import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ACADEMIC_YEARS,
  DEFAULT_ACADEMIC_YEAR,
  DEFAULT_ACADEMIC_YEAR_TERM,
  getEnabledAcademicTerms,
  isEnabledAcademicTerm,
  isEnabledAcademicYear,
  STAFF_ACADEMIC_YEAR
} from "../src/lib/academic-term-defaults";

test("academic term rules provide one shared allow-list", () => {
  assert.deepEqual(ACADEMIC_YEARS, ["114", "115"]);
  assert.equal(DEFAULT_ACADEMIC_YEAR, "115");
  assert.equal(DEFAULT_ACADEMIC_YEAR_TERM, "1");
  assert.deepEqual(getEnabledAcademicTerms("115"), ["1", "2"]);
  assert.equal(isEnabledAcademicYear("116"), false);
  assert.equal(isEnabledAcademicTerm("114", "2"), true);
  assert.equal(isEnabledAcademicTerm("114", "3"), false);
  assert.equal(STAFF_ACADEMIC_YEAR, "999");
});

test("user-store enforces staff year and scopes class-owner conflicts by academic year", () => {
  const source = readFileSync(resolve(process.cwd(), "src/lib/user-store.ts"), "utf8");
  assert.ok(source.includes('if (role === "teacher" || role === "admin") return STAFF_ACADEMIC_YEAR'));
  const updateUserStoreSource = source.slice(source.indexOf("export async function updateUserStore"));
  assert.ok(updateUserStoreSource.includes("user.academicYear === academicYear"));
});

test("account and course entry points use the shared academic-term rules", () => {
  const usersRoute = readFileSync(resolve(process.cwd(), "app/api/admin/users/route.ts"), "utf8");
  const coursesRoute = readFileSync(resolve(process.cwd(), "app/api/admin/openclasses/route.ts"), "utf8");
  const accountForm = readFileSync(resolve(process.cwd(), "app/teacher/_components/StudentAccountTab.tsx"), "utf8");
  const courseForm = readFileSync(resolve(process.cwd(), "app/teacher/_components/CourseManagementTab.tsx"), "utf8");
  assert.ok(usersRoute.includes("isEnabledAcademicYear(academicYear)"));
  assert.ok(coursesRoute.includes("isEnabledAcademicTerm(academicYear, academicYearTerm)"));
  assert.ok(accountForm.includes("ACADEMIC_YEARS.map"));
  assert.ok(courseForm.includes("getEnabledAcademicTerms"));
});

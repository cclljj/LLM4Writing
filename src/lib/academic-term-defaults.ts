/**
 * The source of truth for selectable school years and their available terms.
 * Add a school year here when it becomes available; account and course APIs
 * and their corresponding forms consume these helpers rather than keeping
 * their own allow-lists.
 */
export const ACADEMIC_YEAR_TERM_RULES = [
  { academicYear: "114", enabledTerms: ["1", "2"] },
  { academicYear: "115", enabledTerms: ["1", "2"] }
] as const;

export const ACADEMIC_YEARS = ACADEMIC_YEAR_TERM_RULES.map((rule) => rule.academicYear);
export const STAFF_ACADEMIC_YEAR = "999";

export function isEnabledAcademicYear(academicYear: string): boolean {
  return ACADEMIC_YEAR_TERM_RULES.some((rule) => rule.academicYear === academicYear);
}

export function getEnabledAcademicTerms(academicYear: string): string[] {
  const rule = ACADEMIC_YEAR_TERM_RULES.find((item) => item.academicYear === academicYear);
  return rule ? [...rule.enabledTerms] : [];
}

export function isEnabledAcademicTerm(academicYear: string, academicYearTerm: string): boolean {
  return getEnabledAcademicTerms(academicYear).includes(academicYearTerm);
}

export const DEFAULT_ACADEMIC_YEAR = "115";
export const DEFAULT_ACADEMIC_YEAR_TERM = "1";
export const DEFAULT_ACADEMIC_TERM_CONFIG_KEY = `${DEFAULT_ACADEMIC_YEAR}-${DEFAULT_ACADEMIC_YEAR_TERM}`;

/** School year assigned to student records that predate the academic-year field. */
export const LEGACY_STUDENT_ACADEMIC_YEAR = "114";
/** Academic-term assignments for courses created before term fields existed. */
export const LEGACY_COURSE_TERM = { academicYear: LEGACY_STUDENT_ACADEMIC_YEAR, academicYearTerm: "2" } as const;

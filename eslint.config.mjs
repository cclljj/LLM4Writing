import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // Existing codebase patterns rely on effect-driven local state sync.
      // Keep visible as warnings for gradual cleanup instead of blocking CI.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
    },
  },
  {
    // Tech-debt guardrail (#455): keep new app/src modules below 800 lines so
    // the warning list stays empty on main and any new oversized file stands
    // out. Test files are exempt by scope.
    files: ["app/**/*.ts", "app/**/*.tsx", "src/**/*.ts", "src/**/*.tsx"],
    rules: {
      "max-lines": ["warn", { max: 800, skipBlankLines: false, skipComments: false }],
    },
  },
  {
    // Tech-debt exemptions (#455): legacy files already above the limit when
    // the guardrail landed. student/page.tsx and LearningMonitorTab.tsx were
    // brought under the limit in #457-#460; remove remaining entries as each
    // file drops below 800 lines.
    files: [
      "app/teacher/_components/CourseManagementTab.tsx",
      "app/teacher/_components/StudentAccountTab.tsx",
      "app/teacher/_components/AdminPromptDiagnostics.tsx",
      "app/teacher/_components/CourseImplementationReportTab.tsx",
      "app/api/admin/diagnostics/route.ts",
      "src/lib/store.ts",
      "src/lib/engine.ts",
      "src/lib/activity-store.ts",
    ],
    rules: {
      "max-lines": "off",
    },
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
];

export default eslintConfig;

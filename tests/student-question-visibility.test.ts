import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const thisDir = dirname(fileURLToPath(import.meta.url));

test("#310: interaction panel labels question messages as 問題", () => {
  const src = readFileSync(resolve(thisDir, "../app/student/_components/InteractionPanel.tsx"), "utf8");
  assert.ok(src.includes('? "問題"'), "question label should be 問題 in InteractionPanel");
});

test("#310: step3 interaction view labels question messages as 問題", () => {
  const src = readFileSync(resolve(thisDir, "../app/student/page.tsx"), "utf8");
  assert.ok(src.includes('? "問題"'), "step3 question label should be 問題 in student page");
});

test("#310: step3 no longer drops system question messages", () => {
  const src = readFileSync(resolve(thisDir, "../app/student/page.tsx"), "utf8");
  assert.equal(
    src.includes("if (currentStep === 3) return;"),
    false,
    "interactive message mapping should not skip system messages in step3"
  );
});

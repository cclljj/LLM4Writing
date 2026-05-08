import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import structureTreeConfig from "@/src/config/structure-tree.json";

const structureTreeMapByGenre = structureTreeConfig as Record<string, string>;

const defaultStructureTreePath = "structure-tree/1.map";

function resolveStructureTreePathByGenre(genre: string): { path: string; matchedGenre: string; fallbackUsed: boolean } {
  const normalized = genre.trim();
  if (!normalized) return { path: defaultStructureTreePath, matchedGenre: "議論文", fallbackUsed: true };
  if (structureTreeMapByGenre[normalized]) {
    return { path: structureTreeMapByGenre[normalized]!, matchedGenre: normalized, fallbackUsed: false };
  }

  const compact = normalized.replace(/\s+/g, "");
  const directCompactKey = Object.keys(structureTreeMapByGenre).find((key) => key.replace(/\s+/g, "") === compact);
  if (directCompactKey) {
    return { path: structureTreeMapByGenre[directCompactKey]!, matchedGenre: directCompactKey, fallbackUsed: false };
  }

  if (compact.includes("議論")) return { path: structureTreeMapByGenre["議論文"] ?? defaultStructureTreePath, matchedGenre: "議論文", fallbackUsed: false };
  if (compact.includes("記敘")) return { path: structureTreeMapByGenre["記敘文"] ?? defaultStructureTreePath, matchedGenre: "記敘文", fallbackUsed: false };
  if (compact.includes("抒情")) return { path: structureTreeMapByGenre["抒情文"] ?? defaultStructureTreePath, matchedGenre: "抒情文", fallbackUsed: false };
  if (compact.includes("說明")) return { path: structureTreeMapByGenre["說明文"] ?? defaultStructureTreePath, matchedGenre: "說明文", fallbackUsed: false };

  return { path: defaultStructureTreePath, matchedGenre: "議論文", fallbackUsed: true };
}

function replaceEssayTitleInTemplate(template: string, essayTitle: string): string {
  const normalizedTitle = essayTitle.trim() || "未命名題目";
  return template.replaceAll("作文題目", normalizedTitle);
}

export function resolveStructureTreeTemplate(genre: string, essayTitle: string): string {
  const relPath = resolveStructureTreePathByGenre(genre).path.trim();
  if (!relPath) return "";
  const filePath = path.join(process.cwd(), "src", "config", relPath);
  if (!existsSync(filePath)) return "";
  try {
    const raw = readFileSync(filePath, "utf8");
    return replaceEssayTitleInTemplate(raw, essayTitle);
  } catch {
    return "";
  }
}

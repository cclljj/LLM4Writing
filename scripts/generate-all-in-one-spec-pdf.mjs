import { readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const docsDir = resolve(root, "docs");
const outputHtml = resolve(docsDir, "llm4writing-all-in-one-project-spec.html");
const outputPdf = resolve(docsDir, "llm4writing-all-in-one-project-spec.pdf");

const generatedAt = new Intl.DateTimeFormat("zh-TW", {
  timeZone: "Asia/Taipei",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false
}).format(new Date());

const sources = [
  {
    title: "Canonical Implementation Specification",
    subtitle: "產品、資料模型、流程、API、部署與營運規格",
    path: "docs/SPEC.md",
    type: "markdown"
  },
  {
    title: "OpenSpec Overview",
    subtitle: "OpenSpec 目錄、慣例與來源對照",
    path: "docs/openspec/README.md",
    type: "markdown"
  },
  {
    title: "OpenSpec Configuration",
    subtitle: "規格驅動流程與專案上下文",
    path: "docs/openspec/config.yaml",
    type: "code",
    language: "yaml"
  },
  {
    title: "OpenSpec Domain: Platform",
    subtitle: "平台、資料、部署、營運與核心不變量",
    path: "docs/openspec/specs/platform/spec.md",
    type: "markdown"
  },
  {
    title: "OpenSpec Domain: Learning Workflow",
    subtitle: "spec10 寫作學習流程與學生互動",
    path: "docs/openspec/specs/learning-workflow/spec.md",
    type: "markdown"
  },
  {
    title: "OpenSpec Domain: Authentication And Security",
    subtitle: "身分、權限、Cookie、CSRF、RLS 與安全界線",
    path: "docs/openspec/specs/auth-security/spec.md",
    type: "markdown"
  },
  {
    title: "OpenSpec Domain: API",
    subtitle: "公開端點、session/step 路由、教師與管理 API",
    path: "docs/openspec/specs/api/spec.md",
    type: "markdown"
  },
  {
    title: "OpenSpec Domain: Teacher And Admin",
    subtitle: "教師/admin 管理介面、診斷、報告與監控",
    path: "docs/openspec/specs/teacher-admin/spec.md",
    type: "markdown"
  }
];

const diagrams = [
  ["Context", "docs/openspec/diagrams/context.png"],
  ["Container Architecture", "docs/openspec/diagrams/containers.png"],
  ["Web App Components", "docs/openspec/diagrams/webapp-components.png"],
  ["System Landscape", "docs/openspec/diagrams/landscape.png"],
  ["Student User Flow", "docs/openspec/diagrams/student-user-flow.png"],
  ["Teacher User Flow", "docs/openspec/diagrams/teacher-user-flow.png"],
  ["Admin User Flow", "docs/openspec/diagrams/admin-user-flow.png"],
  ["Web App Student Flow", "docs/openspec/diagrams/webapp-student-flow.png"],
  ["Web App Teacher/Admin Flow", "docs/openspec/diagrams/webapp-teacher-admin-flow.png"]
];

const toc = [];
const usedIds = new Map();

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function slugify(value) {
  const base = value
    .toLowerCase()
    .replace(/[`*_()[\]{}:：,，.。/\\|]/g, " ")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "");
  const fallback = `section-${toc.length + 1}`;
  const candidate = base || fallback;
  const count = usedIds.get(candidate) ?? 0;
  usedIds.set(candidate, count + 1);
  return count > 0 ? `${candidate}-${count + 1}` : candidate;
}

function inlineMarkdown(value) {
  let html = escapeHtml(value);
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, href) => {
    return `<a href="${escapeHtml(href)}">${label}</a>`;
  });
  return html;
}

function parseTable(lines, start) {
  if (start + 1 >= lines.length) return null;
  const header = lines[start];
  const separator = lines[start + 1];
  if (!header.includes("|") || !/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(separator)) return null;
  const splitRow = (line) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
  const headers = splitRow(header);
  const rows = [];
  let index = start + 2;
  while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
    rows.push(splitRow(lines[index]));
    index += 1;
  }
  const thead = `<thead><tr>${headers.map((cell) => `<th>${inlineMarkdown(cell)}</th>`).join("")}</tr></thead>`;
  const tbody = `<tbody>${rows
    .map((row) => `<tr>${row.map((cell) => `<td>${inlineMarkdown(cell)}</td>`).join("")}</tr>`)
    .join("")}</tbody>`;
  return { html: `<table>${thead}${tbody}</table>`, next: index };
}

function renderMarkdown(markdown, sourcePath) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const html = [];
  let paragraph = [];
  let list = null;
  let code = null;

  const closeParagraph = () => {
    if (paragraph.length === 0) return;
    html.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
    paragraph = [];
  };
  const closeList = () => {
    if (!list) return;
    html.push(`</${list}>`);
    list = null;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();

    if (code) {
      if (trimmed.startsWith("```")) {
        html.push(`<pre><code class="language-${escapeHtml(code.language)}">${escapeHtml(code.lines.join("\n"))}</code></pre>`);
        code = null;
      } else {
        code.lines.push(line);
      }
      continue;
    }

    if (trimmed.startsWith("```")) {
      closeParagraph();
      closeList();
      code = { language: trimmed.slice(3).trim(), lines: [] };
      continue;
    }

    if (!trimmed) {
      closeParagraph();
      closeList();
      continue;
    }

    const table = parseTable(lines, index);
    if (table) {
      closeParagraph();
      closeList();
      html.push(table.html);
      index = table.next - 1;
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      closeParagraph();
      closeList();
      const level = heading[1].length;
      const text = heading[2].trim();
      const id = slugify(`${sourcePath}-${text}`);
      toc.push({ level, text, id, sourcePath });
      html.push(`<h${level} id="${id}">${inlineMarkdown(text)}</h${level}>`);
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      closeParagraph();
      closeList();
      html.push("<hr>");
      continue;
    }

    const unordered = trimmed.match(/^[-*]\s+(.+)$/);
    const ordered = trimmed.match(/^\d+\.\s+(.+)$/);
    if (unordered || ordered) {
      closeParagraph();
      const nextList = unordered ? "ul" : "ol";
      if (list && list !== nextList) closeList();
      if (!list) {
        list = nextList;
        html.push(`<${list}>`);
      }
      html.push(`<li>${inlineMarkdown((unordered ?? ordered)[1])}</li>`);
      continue;
    }

    if (trimmed.startsWith(">")) {
      closeParagraph();
      closeList();
      html.push(`<blockquote>${inlineMarkdown(trimmed.replace(/^>\s?/, ""))}</blockquote>`);
      continue;
    }

    paragraph.push(trimmed);
  }

  closeParagraph();
  closeList();
  if (code) {
    html.push(`<pre><code class="language-${escapeHtml(code.language)}">${escapeHtml(code.lines.join("\n"))}</code></pre>`);
  }
  return html.join("\n");
}

function renderSource(source) {
  const absPath = resolve(root, source.path);
  const content = readFileSync(absPath, "utf8");
  const body = source.type === "code"
    ? `<pre><code class="language-${source.language ?? ""}">${escapeHtml(content)}</code></pre>`
    : renderMarkdown(content, source.path);
  const id = slugify(source.title);
  toc.push({ level: 1, text: source.title, id, sourcePath: source.path });
  return `
    <section class="source-section" id="${id}">
      <div class="section-kicker">${escapeHtml(source.path)}</div>
      <h1>${escapeHtml(source.title)}</h1>
      <p class="section-subtitle">${escapeHtml(source.subtitle)}</p>
      ${body}
    </section>`;
}

function renderDiagramSection() {
  const id = slugify("Architecture Diagrams");
  toc.push({ level: 1, text: "Architecture Diagrams", id, sourcePath: "docs/openspec/diagrams" });
  return `
    <section class="source-section" id="${id}">
      <div class="section-kicker">docs/openspec/diagrams</div>
      <h1>Architecture Diagrams</h1>
      <p class="section-subtitle">C4 and user-flow diagrams generated for the current OpenSpec snapshot.</p>
      <div class="diagram-grid">
        ${diagrams.map(([label, diagramPath]) => {
          const absolute = resolve(root, diagramPath);
          return `
            <figure>
              <img src="${pathToFileURL(absolute).href}" alt="${escapeHtml(label)}">
              <figcaption>${escapeHtml(label)} <span>${escapeHtml(diagramPath)}</span></figcaption>
            </figure>`;
        }).join("")}
      </div>
    </section>`;
}

const bodySections = [
  renderDiagramSection(),
  ...sources.map(renderSource)
].join("\n");

const tocHtml = toc
  .filter((item) => item.level <= 3)
  .map((item) => `
    <a class="toc-level-${Math.min(item.level, 3)}" href="#${item.id}">
      <span>${escapeHtml(item.text)}</span>
      <small>${escapeHtml(item.sourcePath)}</small>
    </a>`)
  .join("");

const sourceRows = sources
  .map((source) => `
    <tr>
      <td>${escapeHtml(source.title)}</td>
      <td><code>${escapeHtml(source.path)}</code></td>
      <td>${escapeHtml(source.subtitle)}</td>
    </tr>`)
  .join("");

const html = `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>LLM4Writing All-in-One Project Specification</title>
  <style>
    @page {
      size: A4;
      margin: 17mm 15mm 18mm;
      @bottom-right {
        content: "LLM4Writing Project Specification · " counter(page);
        color: #64748b;
        font-size: 8pt;
      }
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #172033;
      background: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif;
      font-size: 10.5pt;
      line-height: 1.62;
    }
    a { color: #1d4ed8; text-decoration: none; }
    .cover {
      min-height: 255mm;
      padding: 22mm 18mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      color: #f8fafc;
      background:
        linear-gradient(135deg, rgba(15, 23, 42, 0.96), rgba(30, 64, 175, 0.91)),
        radial-gradient(circle at 78% 18%, rgba(20, 184, 166, 0.45), transparent 30%);
      page-break-after: always;
    }
    .cover-mark {
      width: 54px;
      height: 54px;
      border: 1px solid rgba(255, 255, 255, 0.45);
      display: grid;
      place-items: center;
      font-weight: 800;
      letter-spacing: 0.08em;
    }
    .cover h1 {
      margin: 18mm 0 4mm;
      max-width: 780px;
      color: #ffffff;
      font-size: 34pt;
      line-height: 1.08;
      letter-spacing: 0;
    }
    .cover p {
      max-width: 720px;
      margin: 0;
      color: #dbeafe;
      font-size: 13pt;
    }
    .cover-meta {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-top: 16mm;
    }
    .cover-meta div {
      border-top: 1px solid rgba(255, 255, 255, 0.35);
      padding-top: 8px;
    }
    .cover-meta small {
      display: block;
      color: #bfdbfe;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-size: 7.5pt;
    }
    .cover-meta strong {
      display: block;
      margin-top: 3px;
      color: #ffffff;
      font-size: 10.5pt;
    }
    .front-matter, .source-section {
      page-break-after: always;
      padding-top: 2mm;
    }
    .front-matter h1, .source-section h1 {
      margin: 0 0 3mm;
      color: #0f172a;
      font-size: 22pt;
      line-height: 1.15;
      letter-spacing: 0;
    }
    .front-matter h2, .source-section h2 {
      margin: 8mm 0 2.5mm;
      color: #1e3a8a;
      font-size: 15pt;
      line-height: 1.25;
      break-after: avoid;
    }
    .front-matter h3, .source-section h3 {
      margin: 6mm 0 2mm;
      color: #0f766e;
      font-size: 12.5pt;
      line-height: 1.3;
      break-after: avoid;
    }
    .source-section h4, .source-section h5, .source-section h6 {
      margin: 4.5mm 0 1.5mm;
      color: #334155;
      break-after: avoid;
    }
    .section-kicker {
      margin-bottom: 2mm;
      color: #64748b;
      font-size: 8.5pt;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .section-subtitle {
      margin-top: 0;
      color: #475569;
      font-size: 11.5pt;
    }
    .executive-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
      margin: 8mm 0;
    }
    .metric-card {
      min-height: 31mm;
      padding: 12px;
      border: 1px solid #dbe4f0;
      background: #f8fafc;
    }
    .metric-card small {
      display: block;
      color: #64748b;
      font-weight: 700;
    }
    .metric-card strong {
      display: block;
      margin-top: 4px;
      color: #0f172a;
      font-size: 13pt;
    }
    .toc {
      column-count: 2;
      column-gap: 12mm;
      margin-top: 6mm;
    }
    .toc a {
      display: block;
      break-inside: avoid;
      padding: 2.2mm 0;
      border-bottom: 1px solid #e2e8f0;
    }
    .toc span {
      display: block;
      color: #0f172a;
      font-weight: 650;
    }
    .toc small {
      color: #64748b;
      font-size: 7.5pt;
    }
    .toc-level-2 { padding-left: 4mm !important; }
    .toc-level-3 { padding-left: 8mm !important; }
    p, li { orphans: 3; widows: 3; }
    code {
      padding: 0.6px 3.5px;
      border-radius: 3px;
      color: #0f766e;
      background: #ecfdf5;
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
      font-size: 0.9em;
    }
    pre {
      white-space: pre-wrap;
      word-break: break-word;
      padding: 10px 12px;
      border: 1px solid #dbe4f0;
      border-left: 4px solid #2563eb;
      background: #f8fafc;
      break-inside: avoid;
    }
    pre code {
      padding: 0;
      color: #172033;
      background: transparent;
    }
    table {
      width: 100%;
      margin: 4mm 0;
      border-collapse: collapse;
      break-inside: avoid;
      font-size: 9pt;
    }
    th, td {
      padding: 6px 7px;
      border: 1px solid #dbe4f0;
      vertical-align: top;
    }
    th {
      color: #0f172a;
      background: #eaf1fb;
      text-align: left;
    }
    tr:nth-child(even) td { background: #fbfdff; }
    blockquote {
      margin: 4mm 0;
      padding: 2mm 4mm;
      border-left: 4px solid #14b8a6;
      color: #334155;
      background: #f0fdfa;
    }
    hr {
      border: 0;
      border-top: 1px solid #dbe4f0;
      margin: 8mm 0;
    }
    .source-table td:first-child { width: 25%; font-weight: 700; }
    .source-table td:nth-child(2) { width: 34%; }
    .diagram-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 11mm;
    }
    figure {
      margin: 0;
      padding: 8px;
      border: 1px solid #dbe4f0;
      background: #ffffff;
      break-inside: avoid;
    }
    figure img {
      display: block;
      width: 100%;
      max-height: 176mm;
      object-fit: contain;
    }
    figcaption {
      margin-top: 6px;
      color: #0f172a;
      font-weight: 700;
      font-size: 9pt;
    }
    figcaption span {
      display: block;
      color: #64748b;
      font-weight: 400;
      font-size: 7.5pt;
    }
  </style>
</head>
<body>
  <section class="cover">
    <div>
      <div class="cover-mark">LLM</div>
      <h1>LLM4Writing All-in-One Project Specification</h1>
      <p>以目前 OpenSpec 與 canonical implementation spec 整理而成的完整專案規格文件，涵蓋產品行為、系統架構、學習流程、API、教師/admin 管理、安全與營運規範。</p>
      <div class="cover-meta">
        <div><small>Generated</small><strong>${escapeHtml(generatedAt)} Asia/Taipei</strong></div>
        <div><small>Source Of Truth</small><strong>docs/SPEC.md + docs/openspec/</strong></div>
        <div><small>Repository</small><strong>llm4writing</strong></div>
      </div>
    </div>
    <p>Prepared for implementation review, maintenance handoff, and future spec-driven development.</p>
  </section>

  <section class="front-matter">
    <div class="section-kicker">Overview</div>
    <h1>Document Guide</h1>
    <p>本文件將目前專案規格整理成單一 PDF。前半部提供架構圖與來源索引；後半部完整收錄 canonical spec 與 OpenSpec domain specs，方便用同一份文件檢視產品行為與驗收場景。</p>
    <div class="executive-grid">
      <div class="metric-card"><small>Product</small><strong>AI-assisted writing instruction platform</strong></div>
      <div class="metric-card"><small>Primary Roles</small><strong>Student, Teacher, Admin</strong></div>
      <div class="metric-card"><small>Core Workflow</small><strong>spec10 writing process</strong></div>
      <div class="metric-card"><small>Stack</small><strong>Next.js, React, TypeScript, PostgreSQL/Supabase, Vercel</strong></div>
    </div>
    <h2>Source Traceability</h2>
    <table class="source-table">
      <thead><tr><th>Section</th><th>Source</th><th>Purpose</th></tr></thead>
      <tbody>${sourceRows}</tbody>
    </table>
  </section>

  <section class="front-matter">
    <div class="section-kicker">Navigation</div>
    <h1>Table Of Contents</h1>
    <div class="toc">${tocHtml}</div>
  </section>

  ${bodySections}
</body>
</html>`;

writeFileSync(outputHtml, html, "utf8");

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto(pathToFileURL(outputHtml).href, { waitUntil: "networkidle" });
  await page.pdf({
    path: outputPdf,
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: false
  });
} finally {
  await browser.close();
}

console.log(`Generated ${relative(root, outputHtml)}`);
console.log(`Generated ${relative(root, outputPdf)}`);

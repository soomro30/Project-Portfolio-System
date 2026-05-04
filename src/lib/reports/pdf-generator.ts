import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

import { PDFDocument } from "pdf-lib";

import {
  buildProjectStatusReportHtml,
  type ProjectReportData,
  type ReportCadence,
} from "@/lib/reports/project-status-report";

const generatedReportsRoot = join(process.cwd(), "reports", "generated");

type GeneratedBatchFile = {
  projectId: string;
  projectCode: string;
  projectName: string;
  fileName: string;
  filePath: string;
  sizeBytes: number;
  editableFileName: string;
  editableFilePath: string;
  editableSizeBytes: number;
};

type BatchReportSection = {
  key: "ongoing" | "pipeline" | "completed";
  title: string;
  subtitle: string;
  projectCount: number;
  stages: string[];
  projects: Array<{
    projectId: string;
    projectCode: string;
    projectName: string;
    projectStage: string;
    progressPercent?: number | null;
    health: string;
    pmName: string;
  }>;
};

export type BatchReportResult = {
  runId: string;
  outputDir: string;
  cadence: ReportCadence;
  generatedAt: string;
  projectCount: number;
  sections: BatchReportSection[];
  files: GeneratedBatchFile[];
  combinedFileName: string;
  combinedFilePath: string;
  combinedSizeBytes: number;
};

function escapeHtml(value: string | null | undefined) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function sanitizeFilePart(value: string) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 96);
}

async function loadPublicAssetDataUri(fileName: string, mimeType: string) {
  try {
    const buffer = await readFile(join(process.cwd(), "public", fileName));
    return `data:${mimeType};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

function reportMonthLabel(cadence: ReportCadence, generatedAt: Date) {
  const month = generatedAt.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });

  return cadence === "monthly" ? month : `Week of ${month}`;
}

function reportDateLabel(generatedAt: Date) {
  return generatedAt.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function normalizeStage(stage: string) {
  return stage.trim().toLowerCase();
}

function getBatchSectionKey(projectStage: string): BatchReportSection["key"] {
  const stage = normalizeStage(projectStage);

  if (stage === "completed") {
    return "completed";
  }

  if (stage === "tendering" || stage === "requirements" || stage === "not started") {
    return "pipeline";
  }

  return "ongoing";
}

function getBatchSectionDefinition(key: BatchReportSection["key"]) {
  if (key === "completed") {
    return {
      key,
      title: "Completed/Delivered Projects",
      subtitle: "Projects that have been delivered, closed, or handed over for operational use.",
    };
  }

  if (key === "pipeline") {
    return {
      key,
      title: "Projects in Tendering and Business Requirements Phase",
      subtitle:
        "Projects that are being shaped, commercially evaluated, or prepared before execution starts.",
    };
  }

  return {
    key,
    title: "On-Going Digital Transformation Projects",
    subtitle: "Active delivery initiatives currently being monitored for progress, risks, and next actions.",
  };
}

function getHealthBadgeTone(health: string) {
  const normalized = health.trim().toLowerCase();

  if (normalized === "red") {
    return { bg: "#da1e28", fg: "#ffffff" };
  }

  if (normalized === "amber") {
    return { bg: "#ff832b", fg: "#161616" };
  }

  if (normalized === "green") {
    return { bg: "#24a148", fg: "#ffffff" };
  }

  if (normalized === "grey" || normalized === "gray") {
    return { bg: "#525252", fg: "#ffffff" };
  }

  return { bg: "#0f62fe", fg: "#ffffff" };
}

function getStageBadgeTone(stage: string) {
  const normalized = normalizeStage(stage);

  if (normalized === "completed") {
    return { bg: "#198038", fg: "#ffffff" };
  }

  if (normalized === "in progress") {
    return { bg: "#0f62fe", fg: "#ffffff" };
  }

  if (normalized === "tendering") {
    return { bg: "#8a3ffc", fg: "#ffffff" };
  }

  if (normalized === "requirements") {
    return { bg: "#ff832b", fg: "#161616" };
  }

  if (normalized === "not started") {
    return { bg: "#6f6f6f", fg: "#ffffff" };
  }

  return { bg: "#393939", fg: "#ffffff" };
}

function renderBadge(label: string, tone: { bg: string; fg: string }) {
  return `<span class="badge" style="background:${tone.bg};color:${tone.fg};">${escapeHtml(label)}</span>`;
}

function renderProgressBadge(progressPercent?: number | null) {
  if (typeof progressPercent !== "number") {
    return renderBadge("Not set", { bg: "#525252", fg: "#ffffff" });
  }

  return renderBadge(`${progressPercent}%`, { bg: "#0f62fe", fg: "#ffffff" });
}

function buildBatchSections(projects: ProjectReportData[], files: GeneratedBatchFile[]) {
  const filesByProjectId = new Map(files.map((file) => [file.projectId, file]));
  const grouped = new Map<BatchReportSection["key"], ProjectReportData[]>();

  for (const key of ["ongoing", "pipeline", "completed"] as const) {
    grouped.set(key, []);
  }

  for (const project of projects) {
    grouped.get(getBatchSectionKey(project.projectStage))?.push(project);
  }

  return (["ongoing", "pipeline", "completed"] as const)
    .map((key) => {
      const sectionProjects = grouped.get(key) ?? [];
      const definition = getBatchSectionDefinition(key);
      const stages = Array.from(new Set(sectionProjects.map((project) => project.projectStage))).sort((left, right) =>
        left.localeCompare(right),
      );

      return {
        ...definition,
        projectCount: sectionProjects.length,
        stages,
        projects: sectionProjects.map((project) => ({
          projectId: project.id,
          projectCode: project.projectCode,
          projectName: project.projectName,
          projectStage: project.projectStage,
          progressPercent: project.progressPercent,
          health: project.health,
          pmName: project.pmName || "Not assigned",
        })),
        files: sectionProjects
          .map((project) => filesByProjectId.get(project.id))
          .filter((file): file is GeneratedBatchFile => Boolean(file)),
      };
    })
    .filter((section) => section.projectCount > 0);
}

export function getBatchReportsRoot() {
  return generatedReportsRoot;
}

export function assertSafeBatchReportPath(runId: string, fileName: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(runId)) {
    throw new Error("Invalid batch report run id");
  }

  if (!/^[a-zA-Z0-9._-]+\.(?:pdf|html)$/.test(fileName)) {
    throw new Error("Invalid batch report file name");
  }

  const runDir = resolve(generatedReportsRoot, runId);
  const filePath = resolve(runDir, basename(fileName));

  if (!filePath.startsWith(`${runDir}/`) && filePath !== runDir) {
    throw new Error("Invalid batch report path");
  }

  return filePath;
}

export async function renderProjectStatusReportPdf(
  project: ProjectReportData,
  cadence: ReportCadence,
  page?: import("playwright").Page,
) {
  const html = buildProjectStatusReportHtml(project, cadence);

  if (page) {
    await page.setContent(html, { waitUntil: "networkidle" });
    return page.pdf({
      format: "A4",
      landscape: true,
      preferCSSPageSize: true,
      printBackground: true,
      margin: {
        top: "8mm",
        right: "8mm",
        bottom: "8mm",
        left: "8mm",
      },
    });
  }

  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });

  try {
    const localPage = await browser.newPage();
    return await renderProjectStatusReportPdf(project, cadence, localPage);
  } finally {
    await browser.close();
  }
}

export async function buildBatchCoverHtml({
  cadence,
  generatedAt,
  projectCount,
}: {
  cadence: ReportCadence;
  generatedAt: Date;
  projectCount: number;
}) {
  const imkanLogo = await loadPublicAssetDataUri("imkan-logo.png", "image/png");
  const saalLogo = await loadPublicAssetDataUri("saal-logo.svg", "image/svg+xml");
  const period = reportMonthLabel(cadence, generatedAt);
  const reportTitle =
    cadence === "monthly"
      ? "Digital Transformation Projects Monthly Reports"
      : "Digital Transformation Projects Weekly Reports";
  const generatedDate = reportDateLabel(generatedAt);

  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(reportTitle)}</title>
        <style>
          @page {
            size: A4 landscape;
            margin: 8mm;
          }
          * {
            box-sizing: border-box;
          }
          body {
            margin: 0;
            font-family: "IBM Plex Sans", "Segoe UI", Arial, sans-serif;
            color: #161616;
            background: #f4f4f4;
          }
          .cover {
            position: relative;
            width: 100%;
            height: calc(210mm - 16mm);
            overflow: hidden;
            padding: 22mm 24mm;
            background:
              linear-gradient(135deg, rgba(15, 98, 254, 0.12), rgba(120, 199, 220, 0.08) 42%, rgba(255,255,255,0.92) 42%),
              #edf5ff;
          }
          .cover::before {
            content: "";
            position: absolute;
            inset: 5mm;
            border: 1px solid rgba(15, 23, 42, 0.18);
            pointer-events: none;
          }
          .cover::after {
            content: "";
            position: absolute;
            right: -35mm;
            top: -28mm;
            width: 115mm;
            height: 115mm;
            border-radius: 999px;
            background: rgba(15, 98, 254, 0.1);
            border: 1px solid rgba(15, 98, 254, 0.16);
          }
          .content {
            position: relative;
            z-index: 1;
            height: 100%;
            display: grid;
            grid-template-rows: auto 1fr auto;
          }
          .logo-block {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 18mm;
          }
          .imkan-logo {
            width: 43mm;
            height: auto;
            object-fit: contain;
          }
          .classification {
            display: grid;
            gap: 2mm;
            justify-items: end;
            text-align: right;
            color: #525252;
            font-size: 8.5pt;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }
          .classification strong {
            color: #0f62fe;
            font-size: 10.5pt;
          }
          .hero {
            display: grid;
            align-content: center;
            max-width: 194mm;
            padding-bottom: 6mm;
          }
          .eyebrow {
            margin: 0 0 7mm;
            color: #525252;
            font-size: 9.5pt;
            letter-spacing: 0.16em;
            text-transform: uppercase;
          }
          h1 {
            margin: 0;
            color: #0b0f19;
            font-size: 35pt;
            line-height: 1.04;
            letter-spacing: -0.035em;
            font-weight: 600;
          }
          .period {
            display: inline-flex;
            width: fit-content;
            margin-top: 9mm;
            padding: 3.2mm 5mm;
            background: #ffffff;
            border-left: 4px solid #0f62fe;
            box-shadow: 0 6px 20px rgba(15, 23, 42, 0.08);
            color: #0b0f19;
            font-size: 18pt;
            font-weight: 600;
          }
          .meta-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 4mm;
            max-width: 188mm;
            margin-top: 12mm;
          }
          .meta-card {
            min-height: 23mm;
            padding: 4mm;
            background: rgba(255, 255, 255, 0.72);
            border: 1px solid rgba(15, 23, 42, 0.14);
          }
          .meta-label {
            margin: 0 0 2mm;
            color: #6f6f6f;
            font-size: 7.5pt;
            font-weight: 600;
            letter-spacing: 0.12em;
            text-transform: uppercase;
          }
          .meta-value {
            margin: 0;
            color: #161616;
            font-size: 13pt;
            line-height: 1.18;
            font-weight: 500;
          }
          .footer {
            display: flex;
            align-items: flex-end;
            justify-content: space-between;
            gap: 10mm;
            border-top: 1px solid rgba(15, 23, 42, 0.18);
            padding-top: 5mm;
          }
          .footer-note {
            margin: 0;
            color: #525252;
            font-size: 8.5pt;
            line-height: 1.35;
          }
          .saal-mark {
            display: flex;
            align-items: center;
            gap: 3mm;
            color: #6f6f6f;
            font-size: 7.5pt;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }
          .saal-logo {
            width: 25mm;
            height: auto;
            object-fit: contain;
          }
        </style>
      </head>
      <body>
        <main class="cover">
          <div class="content">
            <header class="logo-block">
              ${imkanLogo ? `<img class="imkan-logo" src="${imkanLogo}" alt="IMKAN logo" />` : "<div></div>"}
              <div></div>
            </header>
            <section class="hero">
              <p class="eyebrow">IMKAN Digital Transformation Portfolio</p>
              <h1>${escapeHtml(reportTitle)}</h1>
              <div class="period">${escapeHtml(period)}</div>
              <div class="meta-grid">
                <div class="meta-card">
                  <p class="meta-label">Prepared For</p>
                  <p class="meta-value">Executive Steering & Leadership</p>
                </div>
                <div class="meta-card">
                  <p class="meta-label">Report Count</p>
                  <p class="meta-value">${projectCount} project reports</p>
                </div>
                <div class="meta-card">
                  <p class="meta-label">Generated On</p>
                  <p class="meta-value">${escapeHtml(generatedDate)}</p>
                </div>
              </div>
            </section>
            <footer class="footer">
              <p class="footer-note"></p>
              <div class="saal-mark">
                <span>Prepared by</span>
                ${saalLogo ? `<img class="saal-logo" src="${saalLogo}" alt="SAAL logo" />` : "<strong>SAAL</strong>"}
              </div>
            </footer>
          </div>
        </main>
      </body>
    </html>
  `;
}

export async function buildBatchSectionHtml({
  section,
  cadence,
  generatedAt,
}: {
  section: BatchReportSection;
  cadence: ReportCadence;
  generatedAt: Date;
}) {
  const imkanLogo = await loadPublicAssetDataUri("imkan-logo.png", "image/png");
  const saalLogo = await loadPublicAssetDataUri("saal-logo.svg", "image/svg+xml");
  const period = reportMonthLabel(cadence, generatedAt);
  const generatedDate = reportDateLabel(generatedAt);
  const stageList = section.stages.length ? section.stages.join(", ") : "Portfolio stage group";

  const rows = section.projects
    .map(
      (project, index) => `
        <tr>
          <td>${index + 1}</td>
          <td><strong>${escapeHtml(project.projectCode)}</strong></td>
          <td>${escapeHtml(project.projectName)}</td>
          <td>${renderBadge(project.projectStage, getStageBadgeTone(project.projectStage))}</td>
          <td>${renderProgressBadge(project.progressPercent)}</td>
          <td>${renderBadge(project.health, getHealthBadgeTone(project.health))}</td>
          <td>${escapeHtml(project.pmName)}</td>
        </tr>
      `,
    )
    .join("");

  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(section.title)}</title>
        <style>
          @page {
            size: A4 landscape;
            margin: 8mm;
          }
          * {
            box-sizing: border-box;
          }
          body {
            margin: 0;
            font-family: "IBM Plex Sans", "Segoe UI", Arial, sans-serif;
            color: #161616;
            background: #f4f4f4;
          }
          .section-page {
            position: relative;
            min-height: calc(210mm - 16mm);
            padding: 13mm 14mm 10mm;
            background: #ffffff;
            border: 1px solid #d0d7de;
          }
          .section-page::before {
            content: "";
            position: absolute;
            inset: 0 auto 0 0;
            width: 5mm;
            background: #0f62fe;
          }
          .header {
            position: relative;
            z-index: 1;
            display: grid;
            grid-template-columns: 1fr auto;
            align-items: start;
            gap: 12mm;
            padding-left: 5mm;
          }
          .eyebrow {
            margin: 0 0 4mm;
            color: #525252;
            font-size: 8.5pt;
            letter-spacing: 0.16em;
            text-transform: uppercase;
          }
          h1 {
            margin: 0;
            max-width: 180mm;
            color: #0b0f19;
            font-size: 29pt;
            line-height: 1.05;
            letter-spacing: -0.035em;
            font-weight: 600;
          }
          .subtitle {
            max-width: 174mm;
            margin: 4mm 0 0;
            color: #393939;
            font-size: 10.5pt;
            line-height: 1.35;
          }
          .logo-stack {
            display: grid;
            justify-items: end;
            gap: 8mm;
            min-width: 44mm;
          }
          .imkan-logo {
            width: 35mm;
            height: auto;
            object-fit: contain;
          }
          .meta-panel {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 4mm;
            margin: 10mm 0 5mm 5mm;
          }
          .meta-card {
            min-height: 18mm;
            padding: 3mm;
            background: #edf5ff;
            border: 1px solid #c6d9f1;
          }
          .meta-label {
            margin: 0 0 2mm;
            color: #525252;
            font-size: 7.5pt;
            font-weight: 600;
            letter-spacing: 0.12em;
            text-transform: uppercase;
          }
          .meta-value {
            margin: 0;
            color: #161616;
            font-size: 11.5pt;
            line-height: 1.2;
            font-weight: 600;
          }
          .table-wrap {
            margin-left: 5mm;
            border: 1px solid #c6c6c6;
            background: #ffffff;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
          }
          th {
            padding: 1.8mm 2mm;
            background: #e0e0e0;
            color: #161616;
            font-size: 7.4pt;
            line-height: 1.15;
            text-align: left;
            border-bottom: 1px solid #bdbdbd;
          }
          td {
            padding: 1.7mm 2mm;
            color: #262626;
            font-size: 7.8pt;
            line-height: 1.25;
            border-bottom: 1px solid #e0e0e0;
            vertical-align: top;
          }
          tr:last-child td {
            border-bottom: 0;
          }
          th:nth-child(1),
          td:nth-child(1) {
            width: 10mm;
            text-align: center;
          }
          th:nth-child(2),
          td:nth-child(2) {
            width: 20mm;
          }
          th:nth-child(3),
          td:nth-child(3) {
            width: 88mm;
          }
          th:nth-child(4),
          td:nth-child(4) {
            width: 30mm;
          }
          th:nth-child(5),
          td:nth-child(5) {
            width: 23mm;
          }
          th:nth-child(6),
          td:nth-child(6) {
            width: 25mm;
          }
          .badge {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 18mm;
            max-width: 100%;
            min-height: 6mm;
            padding: 1.2mm 2.4mm;
            border-radius: 999px;
            font-size: 7.2pt;
            font-weight: 700;
            line-height: 1.1;
            white-space: nowrap;
          }
          .footer {
            position: absolute;
            left: 19mm;
            right: 14mm;
            bottom: 9mm;
            display: flex;
            align-items: flex-end;
            justify-content: space-between;
            gap: 8mm;
            border-top: 1px solid #e0e0e0;
            padding-top: 3mm;
            color: #6f6f6f;
            font-size: 7.5pt;
          }
          .saal-logo {
            width: 20mm;
            height: auto;
            object-fit: contain;
          }
        </style>
      </head>
      <body>
        <main class="section-page">
          <header class="header">
            <div>
              <p class="eyebrow">Portfolio Section</p>
              <h1>${escapeHtml(section.title)}</h1>
              <p class="subtitle">${escapeHtml(section.subtitle)}</p>
            </div>
            <div class="logo-stack">
              ${imkanLogo ? `<img class="imkan-logo" src="${imkanLogo}" alt="IMKAN logo" />` : ""}
            </div>
          </header>
          <section class="meta-panel">
            <div class="meta-card">
              <p class="meta-label">Report Period</p>
              <p class="meta-value">${escapeHtml(period)}</p>
            </div>
            <div class="meta-card">
              <p class="meta-label">Projects In Section</p>
              <p class="meta-value">${section.projectCount} project${section.projectCount === 1 ? "" : "s"}</p>
            </div>
            <div class="meta-card">
              <p class="meta-label">Included Stages</p>
              <p class="meta-value">${escapeHtml(stageList)}</p>
            </div>
          </section>
          <section class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>S/N</th>
                  <th>ID</th>
                  <th>Project</th>
                  <th>Stage</th>
                  <th>Progress</th>
                  <th>Status</th>
                  <th>Project Manager</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </section>
          <footer class="footer">
            <span>Generated ${escapeHtml(generatedDate)} from the IMKAN Digital Portfolio Tracker.</span>
            ${saalLogo ? `<img class="saal-logo" src="${saalLogo}" alt="SAAL logo" />` : "<strong>SAAL</strong>"}
          </footer>
        </main>
      </body>
    </html>
  `;
}

async function renderHtmlPdf(html: string) {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1123, height: 794 });
    await page.setContent(html, { waitUntil: "networkidle" });
    return await page.pdf({
      format: "A4",
      landscape: true,
      preferCSSPageSize: true,
      printBackground: true,
      margin: {
        top: "8mm",
        right: "8mm",
        bottom: "8mm",
        left: "8mm",
      },
    });
  } finally {
    await browser.close();
  }
}

export async function renderBatchCoverPdf({
  cadence,
  generatedAt,
  projectCount,
}: {
  cadence: ReportCadence;
  generatedAt: Date;
  projectCount: number;
}) {
  return renderHtmlPdf(await buildBatchCoverHtml({ cadence, generatedAt, projectCount }));
}

export async function renderBatchSectionPdf({
  section,
  cadence,
  generatedAt,
}: {
  section: BatchReportSection;
  cadence: ReportCadence;
  generatedAt: Date;
}) {
  return renderHtmlPdf(await buildBatchSectionHtml({ section, cadence, generatedAt }));
}

type CombinedPdfPart = { kind: "buffer"; buffer: Uint8Array } | { kind: "file"; filePath: string };

async function combinePdfParts(parts: CombinedPdfPart[]) {
  const combined = await PDFDocument.create();

  for (const part of parts) {
    const bytes = part.kind === "buffer" ? part.buffer : await readFile(part.filePath);
    const source = await PDFDocument.load(bytes);
    const copiedPages = await combined.copyPages(source, source.getPageIndices());
    copiedPages.forEach((page) => combined.addPage(page));
  }

  return combined.save();
}

export async function generateBatchProjectReports({
  projects,
  cadence,
}: {
  projects: ProjectReportData[];
  cadence: ReportCadence;
}): Promise<BatchReportResult> {
  if (!projects.length) {
    throw new Error("Select at least one project before generating batch reports.");
  }

  const runId = `${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}_${randomUUID().slice(0, 8)}`;
  const outputDir = join(generatedReportsRoot, runId);
  await mkdir(outputDir, { recursive: true });

  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const files: GeneratedBatchFile[] = [];

  try {
    const page = await browser.newPage();

    for (const project of projects) {
      const baseName = `${sanitizeFilePart(project.projectCode)}-${sanitizeFilePart(project.projectName)}-${cadence}-status-report`;
      const fileName = `${baseName}.pdf` || `${project.id}-${cadence}-status-report.pdf`;
      const editableFileName = `${baseName}.html` || `${project.id}-${cadence}-status-report.html`;
      const filePath = join(outputDir, fileName);
      const editableFilePath = join(outputDir, editableFileName);
      const editableHtml = buildProjectStatusReportHtml(project, cadence);
      const pdf = await renderProjectStatusReportPdf(project, cadence, page);
      const editableBytes = Buffer.from(editableHtml, "utf8");
      await writeFile(editableFilePath, editableBytes);
      await writeFile(filePath, pdf);
      files.push({
        projectId: project.id,
        projectCode: project.projectCode,
        projectName: project.projectName,
        fileName,
        filePath,
        sizeBytes: pdf.length,
        editableFileName,
        editableFilePath,
        editableSizeBytes: editableBytes.length,
      });
    }
  } finally {
    await browser.close();
  }

  const combinedFileName = `IMKAN-${cadence}-batch-status-reports.pdf`;
  const combinedFilePath = join(outputDir, combinedFileName);
  const generatedAt = new Date();
  const sections = buildBatchSections(projects, files);
  const coverPdf = await renderBatchCoverPdf({
    cadence,
    generatedAt,
    projectCount: projects.length,
  });

  const combinedParts: CombinedPdfPart[] = [{ kind: "buffer", buffer: coverPdf }];
  for (const section of sections) {
    combinedParts.push({
      kind: "buffer",
      buffer: await renderBatchSectionPdf({
        section,
        cadence,
        generatedAt,
      }),
    });

    section.files.forEach((file) => {
      combinedParts.push({ kind: "file", filePath: file.filePath });
    });
  }

  const combinedPdf = await combinePdfParts(combinedParts);
  await writeFile(combinedFilePath, combinedPdf);

  const result: BatchReportResult = {
    runId,
    outputDir,
    cadence,
    generatedAt: generatedAt.toISOString(),
    projectCount: projects.length,
    sections: sections.map((section) => ({
      key: section.key,
      title: section.title,
      subtitle: section.subtitle,
      projectCount: section.projectCount,
      stages: section.stages,
      projects: section.projects,
    })),
    files,
    combinedFileName,
    combinedFilePath,
    combinedSizeBytes: combinedPdf.length,
  };

  await writeFile(join(outputDir, "manifest.json"), JSON.stringify(result, null, 2));
  return result;
}

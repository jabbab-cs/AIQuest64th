import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import type { ProjectCheck, ProjectMetric, ProjectScreening } from "@workspace/greenroute-research";

const PAGE = { width: 595.28, height: 841.89, left: 48, right: 48, top: 64, bottom: 54 };
const COLOR = {
  forest: rgb(0.055, 0.255, 0.18),
  deep: rgb(0.035, 0.16, 0.12),
  mint: rgb(0.91, 0.96, 0.93),
  pale: rgb(0.965, 0.978, 0.968),
  amber: rgb(0.68, 0.42, 0.08),
  red: rgb(0.63, 0.16, 0.14),
  gray: rgb(0.36, 0.40, 0.38),
  lightGray: rgb(0.82, 0.85, 0.83),
  white: rgb(1, 1, 1),
};

const METRIC_LABELS: Record<string, string> = {
  pricePerKw: "Solar installed price",
  annualSavingsJod: "Estimated annual cost saving",
  annualEnergyKwh: "Estimated annual energy impact",
  annualPaymentJod: "Illustrative annual loan payment",
  coverage100: "Savings coverage at 100%",
  coverage85: "Savings coverage at 85%",
  coverage70: "Savings coverage at 70%",
  impactTco2: "Estimated emissions impact",
  totalCostJod: "Confirmed project cost",
};

const replaceUnsupported = (value: unknown) => String(value ?? "")
  .replace(/\r\n?/g, "\n")
  .replace(/[\u2012\u2013\u2014\u2212]/g, "-")
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/[\u201C\u201D]/g, "\"")
  .replace(/\u2026/g, "...")
  .replace(/[^\x09\x0A\x20-\x7E\xA0-\xFF]+/g, "[non-Latin text]");

const label = (value: string) => value
  .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
  .replace(/[-_]+/g, " ")
  .replace(/\b\w/g, letter => letter.toUpperCase());

const formatNumber = (value: number) => new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
}).format(value);

const whyNeeded = (layer: string, sourceId?: string) => {
  const reason = layer === "Permits"
    ? "Needed to establish that the installation can lawfully proceed."
    : layer === "Taxonomy"
      ? "Needed to test the technical green-eligibility criteria."
      : layer === "Bank framework"
        ? "Needed for the bank's project-specific green and environmental review."
        : "Needed to validate baseline, affordability, or due-diligence inputs.";
  return `${reason}${sourceId ? ` Reference: ${sourceId}.` : ""}`;
};

export type ProjectReportText = {
  title: string;
  requestsOnly: boolean;
  sections: { title: string; text: string[] }[];
};

/** A semantic representation used by the PDF and focused regression tests. */
export function buildProjectReportText(project: ProjectScreening, title: string, requestsOnly = false): ProjectReportText {
  const sections: ProjectReportText["sections"] = [];
  const missingByUpgrade = new Map<string, typeof project.results.missingEvidence>();
  for (const item of project.results.missingEvidence) {
    const group = item.upgrade === "other" ? "Project-wide" : item.upgrade;
    missingByUpgrade.set(group, [...(missingByUpgrade.get(group) ?? []), item]);
  }
  const requests = [...missingByUpgrade].flatMap(([group, items]) => [
    group,
    ...items.flatMap((item, index) => [
      `${index + 1}. ${item.title}`,
      `Owner: ${item.holder}`,
      whyNeeded(project.results.compliance.find(rule => rule.id === item.id)?.layer ?? "Bank checks",
        project.results.compliance.find(rule => rule.id === item.id)?.sourceId),
    ]),
  ]);

  sections.push({
    title: requestsOnly ? "Action checklist" : "Decision summary",
    text: requestsOnly
      ? [
        `${project.results.missingEvidence.length} evidence item(s) need action before the file is ready for bank review.`,
        "No send dates are assumed. Agree timing directly with each evidence owner.",
        ...requests,
      ]
      : [
        project.results.verdict,
        project.results.summary,
        `Scope identified: ${project.results.upgrades.length ? project.results.upgrades.join(", ") : "No confirmed upgrade scope"}.`,
        `Evidence position: ${project.results.counts.confirmed} confirmed; ${project.results.counts.unconfirmed} awaiting confirmation; ${project.results.counts.missing} requirements outstanding; ${project.results.counts.notMet} not met.`,
        "This is preliminary evidence screening, not a credit decision or green approval. The final decision stays with the bank.",
      ],
  });

  if (requestsOnly) {
    sections.push({
      title: "Handover notes",
      text: [
        "Ask each owner for the complete, current document and retain the original PDF.",
        "A submission receipt is not an approval. Resolve contradictory evidence before confirming it.",
        "When evidence arrives, verify the document, page, quoted text, and confirmation state in Tahaqqaq.",
      ],
    });
    return { title, requestsOnly, sections };
  }

  sections.push({
    title: "Key calculated metrics",
    text: Object.entries(project.results.metrics).flatMap(([name, metric]) => [
      METRIC_LABELS[name] ?? label(name),
      metric.value === null
        ? `Cannot calculate yet — ${metric.missing.length ? metric.missing.join("; ") : "required confirmed inputs are unavailable"}.`
        : `${formatNumber(metric.value)} ${metric.unit}`,
      metric.note || "Calculated from confirmed, validated inputs only.",
    ]),
  });

  sections.push({
    title: "Benchmark interpretation",
    text: project.results.checks.flatMap(check => [
      check.title,
      benchmarkInterpretation(check),
      `${check.note} Source: ${check.sourceId}.`,
    ]),
  });

  sections.push({ title: "Evidence priorities", text: requests.length ? requests : ["No outstanding evidence request is currently listed."] });

  const layers = new Map<string, typeof project.results.compliance>();
  for (const rule of project.results.compliance) layers.set(rule.layer, [...(layers.get(rule.layer) ?? []), rule]);
  sections.push({
    title: "Compliance review by layer",
    text: [...layers].flatMap(([layerName, rules]) => [
      layerName,
      ...rules.flatMap(rule => [
        `${rule.title} — ${label(rule.status)}`,
        `Scope: ${rule.upgrade === "other" ? "Project-wide" : rule.upgrade}. Source: ${rule.sourceId}.`,
        rule.missing || "Confirmed evidence supports this requirement.",
      ]),
    ]),
  });

  sections.push({
    title: "File inventory",
    text: project.files.length ? project.files.flatMap((file, index) => [
      `${index + 1}. ${file.name}`,
      `Status: ${label(file.status)}. Type: ${file.documentType ?? "Not classified"}. Scope: ${file.upgrade}. Pages: ${file.pages}.`,
      file.reason || file.summary || "No file summary was recorded.",
      ...(file.outOfDate ? ["Warning: document is more than 12 months old."] : []),
      ...(file.ocrPages.length ? [`OCR used on page(s): ${file.ocrPages.join(", ")}.`] : []),
      ...file.errors.map(error => `File error: ${error}`),
    ]) : ["No project files are recorded."],
  });

  const suggestionText = project.suggestions.flatMap((item, index) => {
    const file = project.files.find(candidate => candidate.id === item.fileId);
    const state = !item.valid ? `Invalid — ${item.validationMessage || "validation failed"}`
      : item.confirmed ? "Confirmed by analyst" : "Unconfirmed AI suggestion";
    return [
      `E${index + 1}. ${file?.name ?? "Unknown file"} · page ${item.page} · ${label(item.field)}`,
      `State: ${state}. Extracted value: ${item.valid ? item.rawValue : "not accepted"}.`,
      `Full citation: “${item.sentence}”`,
    ];
  });
  const requirementText = project.requirementMatches.flatMap((item, index) => {
    const file = project.files.find(candidate => candidate.id === item.fileId);
    const state = !item.valid ? `Invalid — ${item.validationMessage || "validation failed"}`
      : item.confirmed ? "Confirmed by analyst" : "Unconfirmed AI suggestion";
    return [
      `R${index + 1}. ${file?.name ?? "Unknown file"} · page ${item.page} · ${label(item.requirementId)}`,
      `State: ${state}. Finding: ${label(item.result)}.`,
      `Full citation: “${item.sentence}”`,
    ];
  });
  sections.push({
    title: "Citation & confirmation appendix",
    text: [
      "Every extract is shown, including unconfirmed and invalid items. Only valid, analyst-confirmed evidence enters calculations.",
      "Standard-font limitation: non-Latin characters are replaced with [non-Latin text] in this download. Consult the in-app record and original PDF for original-script citations.",
      ...suggestionText,
      ...requirementText,
      ...(!suggestionText.length && !requirementText.length ? ["No extracted citations are recorded."] : []),
    ],
  });
  return { title, requestsOnly, sections };
}

function benchmarkInterpretation(check: ProjectCheck) {
  if (check.actual === null || check.benchmark === null) {
    return `Cannot compare: project value is unconfirmed or unavailable. Benchmark: ${check.benchmark === null ? "unavailable" : `${formatNumber(check.benchmark)} ${check.unit}`}. This is not an approval finding.`;
  }
  if (check.benchmark === 0) {
    return `Project: ${formatNumber(check.actual)} ${check.unit}; benchmark: 0 ${check.unit}. A percentage difference is not meaningful. This is not an approval finding.`;
  }
  const difference = (check.actual - check.benchmark) / Math.abs(check.benchmark) * 100;
  const direction = Math.abs(difference) < 0.005 ? "equal to" : difference > 0 ? "above" : "below";
  return `Project: ${formatNumber(check.actual)} ${check.unit}; benchmark: ${formatNumber(check.benchmark)} ${check.unit}. The project value is ${direction === "equal to" ? "" : `${formatNumber(Math.abs(difference))}% `}${direction} the benchmark. This comparison is contextual, not an approval finding.`;
}

type Fonts = { regular: PDFFont; bold: PDFFont };

class ReportRenderer {
  private page!: PDFPage;
  private y = 0;
  private pageNumber = 0;
  private readonly pages: PDFPage[] = [];
  private readonly contentWidth = PAGE.width - PAGE.left - PAGE.right;

  constructor(private readonly pdf: PDFDocument, private readonly fonts: Fonts, private readonly documentTitle: string) {
    this.newPage();
  }

  private newPage() {
    this.page = this.pdf.addPage([PAGE.width, PAGE.height]);
    this.pages.push(this.page);
    this.pageNumber += 1;
    this.y = PAGE.height - PAGE.top;
    this.page.drawRectangle({ x: 0, y: PAGE.height - 12, width: PAGE.width, height: 12, color: COLOR.forest });
    if (this.pageNumber > 1) {
      const headerLines = this.wrap(this.documentTitle, this.fonts.bold, 8.5, 260);
      const visibleHeaderLines = headerLines.slice(0, 2);
      if (headerLines.length > 2) {
        const last = visibleHeaderLines[1];
        visibleHeaderLines[1] = `${last.slice(0, Math.max(0, last.length - 3)).trimEnd()}...`;
      }
      visibleHeaderLines.forEach((line, index) => {
        this.page.drawText(line, { x: PAGE.left, y: PAGE.height - 39 - index * 11, size: 8.5, font: this.fonts.bold, color: COLOR.forest });
      });
      this.page.drawText("GREENROUTE · PRELIMINARY SCREENING", { x: PAGE.width - PAGE.right - 190, y: PAGE.height - 39, size: 7.5, font: this.fonts.regular, color: COLOR.gray });
    }
  }

  private ensure(height: number) {
    if (this.y - height < PAGE.bottom) this.newPage();
  }

  private wrap(text: string, font: PDFFont, size: number, width = this.contentWidth) {
    const output: string[] = [];
    for (const paragraph of replaceUnsupported(text).split("\n")) {
      if (!paragraph) { output.push(""); continue; }
      let line = "";
      for (const originalWord of paragraph.split(/\s+/)) {
        let word = originalWord;
        while (font.widthOfTextAtSize(word, size) > width) {
          let end = Math.max(1, Math.floor(word.length * width / font.widthOfTextAtSize(word, size)));
          while (end > 1 && font.widthOfTextAtSize(`${word.slice(0, end)}-`, size) > width) end -= 1;
          if (line) { output.push(line); line = ""; }
          output.push(`${word.slice(0, end)}-`);
          word = word.slice(end);
        }
        const candidate = line ? `${line} ${word}` : word;
        if (line && font.widthOfTextAtSize(candidate, size) > width) { output.push(line); line = word; }
        else line = candidate;
      }
      if (line) output.push(line);
    }
    return output;
  }

  text(text: string, options: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; indent?: number; gap?: number } = {}) {
    const size = options.size ?? 9.5;
    const font = options.bold ? this.fonts.bold : this.fonts.regular;
    const indent = options.indent ?? 0;
    const lineHeight = size * 1.42;
    for (const line of this.wrap(text, font, size, this.contentWidth - indent)) {
      this.ensure(lineHeight);
      if (line) this.page.drawText(line, { x: PAGE.left + indent, y: this.y - size, size, font, color: options.color ?? COLOR.deep });
      this.y -= lineHeight;
    }
    this.y -= options.gap ?? 3;
  }

  section(title: string) {
    // Reserve enough room for the heading and the beginning of its first card.
    this.ensure(95);
    this.y -= 11;
    this.page.drawRectangle({ x: PAGE.left, y: this.y - 24, width: 4, height: 24, color: COLOR.forest });
    this.page.drawText(replaceUnsupported(title).toUpperCase(), { x: PAGE.left + 13, y: this.y - 17, size: 11, font: this.fonts.bold, color: COLOR.forest });
    this.y -= 32;
  }

  title(title: string, project: ProjectScreening, requestsOnly: boolean) {
    this.page.drawText("GREENROUTE", { x: PAGE.left, y: this.y - 12, size: 11, font: this.fonts.bold, color: COLOR.forest });
    this.y -= 42;
    for (const line of this.wrap(title, this.fonts.bold, 24)) {
      this.page.drawText(line, { x: PAGE.left, y: this.y - 24, size: 24, font: this.fonts.bold, color: COLOR.deep });
      this.y -= 31;
    }
    this.text(requestsOnly ? "Evidence request checklist" : "Project-specific preliminary screening report", { size: 12, color: COLOR.gray, gap: 14 });
    this.page.drawRectangle({ x: PAGE.left, y: this.y - 54, width: this.contentWidth, height: 54, color: COLOR.mint });
    this.page.drawText(`APPLICATION  ${replaceUnsupported(project.applicationId)}`, { x: PAGE.left + 15, y: this.y - 20, size: 8, font: this.fonts.bold, color: COLOR.forest });
    this.page.drawText(`UPDATED  ${replaceUnsupported(project.updatedAt)}`, { x: PAGE.left + 15, y: this.y - 39, size: 8, font: this.fonts.regular, color: COLOR.deep });
    this.y -= 70;
  }

  card(lines: string[], kind: "normal" | "status" = "normal") {
    const padding = 11;
    const wrapped = lines.map((line, index) => ({
      lines: this.wrap(line, index === 0 ? this.fonts.bold : this.fonts.regular, index === 0 ? 10 : 8.8, this.contentWidth - padding * 2),
      bold: index === 0,
    }));
    const fullHeight = padding * 2 + wrapped.reduce((sum, group) => sum + group.lines.length * (group.bold ? 14 : 12.5) + 2, 0);
    if (fullHeight > PAGE.height - PAGE.top - PAGE.bottom) {
      // Exceptionally long citations flow across pages without clipping or
      // creating a mostly empty page merely to preserve a decorative box.
      this.ensure(48);
      this.y -= padding;
      for (const group of wrapped) {
        for (const line of group.lines) {
          const previousPage = this.page;
          this.ensure((group.bold ? 14 : 12.5) + padding);
          if (this.page !== previousPage) this.y -= padding;
          this.page.drawText(line, {
            x: PAGE.left + padding,
            y: this.y - (group.bold ? 10 : 8.8),
            size: group.bold ? 10 : 8.8,
            font: group.bold ? this.fonts.bold : this.fonts.regular,
            color: group.bold ? COLOR.forest : COLOR.deep,
          });
          this.y -= group.bold ? 14 : 12.5;
        }
        this.y -= 3;
      }
      this.y -= padding + 6;
      return;
    }
    this.ensure(fullHeight + 7);
    const startY = this.y;
    const background = kind === "status" ? COLOR.mint : COLOR.pale;
    this.page.drawRectangle({
      x: PAGE.left,
      y: startY - fullHeight,
      width: this.contentWidth,
      height: fullHeight,
      color: background,
      borderColor: COLOR.lightGray,
      borderWidth: 0.5,
      opacity: 0.22,
      borderOpacity: 1,
    });
    this.y -= padding;
    for (const group of wrapped) {
      for (const line of group.lines) {
        this.page.drawText(line, {
          x: PAGE.left + padding,
          y: this.y - (group.bold ? 10 : 8.8),
          size: group.bold ? 10 : 8.8,
          font: group.bold ? this.fonts.bold : this.fonts.regular,
          color: group.bold ? COLOR.forest : COLOR.deep,
        });
        this.y -= group.bold ? 14 : 12.5;
      }
      this.y -= 2;
    }
    this.y = startY - fullHeight - 6;
  }

  finish() {
    for (let index = 0; index < this.pages.length; index += 1) {
      const page = this.pages[index];
      page.drawLine({ start: { x: PAGE.left, y: 37 }, end: { x: PAGE.width - PAGE.right, y: 37 }, thickness: 0.5, color: COLOR.lightGray });
      page.drawText("PRELIMINARY · NOT A CREDIT OR GREEN APPROVAL", { x: PAGE.left, y: 21, size: 7, font: this.fonts.bold, color: COLOR.gray });
      const number = `${index + 1} / ${this.pages.length}`;
      page.drawText(number, { x: PAGE.width - PAGE.right - this.fonts.regular.widthOfTextAtSize(number, 7), y: 21, size: 7, font: this.fonts.regular, color: COLOR.gray });
    }
  }
}

const groupCards = (sectionTitle: string, lines: string[]) => {
  if (sectionTitle === "Decision summary") return [lines];
  if (sectionTitle === "Key calculated metrics" || sectionTitle === "Benchmark interpretation") {
    return Array.from({ length: Math.ceil(lines.length / 3) }, (_, index) => lines.slice(index * 3, index * 3 + 3));
  }
  const cards: string[][] = [];
  let current: string[] = [];
  for (const line of lines) {
    const isHeading = /^(Project-wide|solar PV|LED|building renovation|water fixtures|Bank checks|Taxonomy|Permits|Bank framework)$/i.test(line)
      || /^\d+\.\s/.test(line) || /^[ER]\d+\.\s/.test(line)
      || (sectionTitle === "Key calculated metrics" && Boolean(METRIC_LABELS[Object.keys(METRIC_LABELS).find(key => METRIC_LABELS[key] === line) ?? ""]))
      || (sectionTitle === "Benchmark interpretation" && !line.startsWith("Project:") && !line.startsWith("Cannot compare:"));
    if (isHeading && current.length) { cards.push(current); current = []; }
    current.push(line);
  }
  if (current.length) cards.push(current);
  return cards;
};

export async function makeProjectPDF(project: ProjectScreening, title: string, requestsOnly = false) {
  const pdf = await PDFDocument.create();
  const fonts = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
  };
  const cleanTitle = replaceUnsupported(title);
  pdf.setTitle(`${cleanTitle} — Tahaqqaq ${requestsOnly ? "evidence requests" : "screening report"}`);
  pdf.setAuthor("Tahaqqaq");
  pdf.setSubject("Project-specific preliminary evidence screening; not a credit or green approval.");
  pdf.setKeywords(["Tahaqqaq", "evidence screening", "preliminary"]);
  pdf.setCreator("Tahaqqaq");
  pdf.setProducer("Tahaqqaq");

  const content = buildProjectReportText(project, title, requestsOnly);
  const renderer = new ReportRenderer(pdf, fonts, cleanTitle);
  renderer.title(cleanTitle, project, requestsOnly);
  for (const section of content.sections) {
    renderer.section(section.title);
    const cards = groupCards(section.title, section.text);
    for (const card of cards) renderer.card(card, section.title === "Decision summary" ? "status" : "normal");
  }
  renderer.finish();
  return Buffer.from(await pdf.save());
}
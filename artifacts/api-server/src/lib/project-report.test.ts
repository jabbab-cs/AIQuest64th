import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { test } from "node:test";
import { PDFDocument } from "pdf-lib";
import {
  calculateProjectScreening,
  type ProjectScreening,
  type ProjectScreeningFile,
  type ProjectSuggestion,
} from "@workspace/greenroute-research";
import { buildProjectReportText, makeProjectPDF } from "./project-report";

const file: ProjectScreeningFile = {
  id: "solar-quote",
  name: "A very long supplier quotation filename for the north campus solar installation.pdf",
  pages: 84,
  status: "extracted",
  documentType: "supplier quote",
  upgrade: "solar PV",
  summary: "Supplier quotation for a rooftop solar installation.",
  reason: null,
  duplicateOf: null,
  outOfDate: false,
  date: "2025-01-10",
  ocrPages: [2, 3],
  errors: [],
};

const suggestion = (overrides: Partial<ProjectSuggestion>): ProjectSuggestion => ({
  id: "size",
  fileId: file.id,
  field: "systemSizeKwp",
  upgrade: "solar PV",
  value: 100,
  rawValue: "100 kWp",
  sentence: "The proposed photovoltaic system has a rated capacity of 100 kWp.",
  page: 4,
  valid: true,
  validationMessage: "",
  confirmed: true,
  ...overrides,
});

function fixture(long = false): ProjectScreening {
  const repeatedCitation = Array.from({ length: long ? 120 : 1 }, (_, index) =>
    `Clause ${index + 1} describes equipment, assumptions, exclusions, responsibilities, and documentary support without truncation.`).join(" ");
  const suggestions = [
    suggestion({}),
    suggestion({ id: "price", field: "priceJod", value: 60_000, rawValue: "JOD 60,000", sentence: repeatedCitation, page: 5 }),
    suggestion({
      id: "arabic-unconfirmed",
      field: "claimedYieldKwhPerKwp",
      value: 1_700,
      rawValue: "١٧٠٠",
      sentence: `الإنتاج السنوي المقترح ١٧٠٠ كيلوواط ساعة. ${repeatedCitation}`,
      page: 7,
      confirmed: false,
    }),
    suggestion({
      id: "invalid",
      field: "tariffJodPerKwh",
      value: null,
      rawValue: "not stated",
      sentence: repeatedCitation,
      page: 9,
      valid: false,
      validationMessage: "The value does not occur in the cited sentence.",
      confirmed: false,
    }),
  ];
  const source = { files: [file], suggestions, requirementMatches: [] };
  return {
    kind: "project",
    version: 1,
    applicationId: "GR-LONG-001",
    status: "complete",
    startedAt: "2025-01-01T00:00:00.000Z",
    completedAt: "2025-01-02T00:00:00.000Z",
    updatedAt: "2025-01-03T00:00:00.000Z",
    model: "test",
    error: null,
    ...source,
    results: calculateProjectScreening(source),
  };
}

test("project report writes decision-grade interpretations and explicit evidence states", async () => {
  const project = fixture();
  const report = buildProjectReportText(project, "North Campus Solar");
  const allText = report.sections.flatMap(section => [section.title, ...section.text]).join("\n");

  assert.match(allText, /Solar installed price/);
  assert.doesNotMatch(allText, /pricePerKw/);
  assert.match(allText, /20% above the benchmark/);
  assert.match(allText, /contextual, not an approval finding/);
  assert.match(allText, /S13/);
  assert.match(allText, /Unverified brief-supplied benchmark/);
  assert.match(allText, /Unconfirmed AI suggestion/);
  assert.match(allText, /Invalid — The value does not occur/);
  assert.match(allText, /Standard-font limitation/);
  assert.match(allText, /Full citation:/);

  const requests = buildProjectReportText(project, "North Campus Solar", true);
  const requestText = requests.sections.flatMap(section => section.text).join("\n");
  assert.match(requestText, /Owner: Solar supplier/);
  assert.match(requestText, /Needed to test the technical green-eligibility criteria/);
  assert.match(requestText, /No send dates are assumed/);
  assert.doesNotMatch(requestText, /send by|due date/i);
  assert.doesNotMatch(requestText, /Citation & confirmation appendix/);
});

test("long report uses valid A4 pages and preserves long evidence without layout overflow", async () => {
  const bytes = await makeProjectPDF(fixture(true), "North Campus Solar — Long Evidence Review");
  const pdf = await PDFDocument.load(bytes);
  assert.ok(pdf.getPageCount() >= 5, `expected a multi-page report, received ${pdf.getPageCount()} page(s)`);
  for (const page of pdf.getPages()) {
    assert.ok(Math.abs(page.getWidth() - 595.28) < 0.1);
    assert.ok(Math.abs(page.getHeight() - 841.89) < 0.1);
  }
  assert.match(pdf.getTitle() ?? "", /Tahaqqaq screening report/);
  assert.match(pdf.getSubject() ?? "", /not a credit or green approval/i);
});

if (process.env.WRITE_PROJECT_REPORT_REVIEW_FILES === "1") {
  await Promise.all([
    makeProjectPDF(fixture(true), "North Campus Solar — Long Evidence Review")
      .then(bytes => writeFile("/tmp/greenroute-project-report-review.pdf", bytes)),
    makeProjectPDF(fixture(), "North Campus Solar", true)
      .then(bytes => writeFile("/tmp/greenroute-evidence-checklist-review.pdf", bytes)),
  ]);
}
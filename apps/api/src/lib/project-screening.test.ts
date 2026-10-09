import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateProjectScreening, type ProjectScreeningFile } from "@tahaqqaq/screening";
import { validateExtraction, enforceScreeningLimits, byteHash, textHash } from "./project-extraction";

const file = (): ProjectScreeningFile => ({ id: "test-quote", name: "solar.pdf", pages: 1, status: "extracted", documentType: null, upgrade: "other", summary: "", reason: null, duplicateOf: null, outOfDate: false, date: null, ocrPages: [], errors: [] });
const page = { page: 1, text: "Quotation dated 2024-01-01. The rooftop solar PV system size is 25 kWp. Total installed price is JOD 15,000." };
const raw = { documentType: "supplier quote", upgrade: "solar PV", summary: "Solar quote", values: [
  { field: "systemSizeKwp", value: 25, rawValue: "25 kWp", sentence: "The rooftop solar PV system size is 25 kWp.", page: 1 },
  { field: "priceJod", value: 15000, rawValue: "JOD 15,000", sentence: "Total installed price is JOD 15,000.", page: 1 },
  { field: "documentDate", value: "2024-01-01", rawValue: "2024-01-01", sentence: "Quotation dated 2024-01-01.", page: 1 },
], requirements: [] };
test("quote has no impact until confirmed; 25kWp/JOD15000 yields 600 and still no savings", () => {
  const f = file();
  const validated = validateExtraction(raw, f, [page], new Date("2026-09-23"));
  assert.equal(f.outOfDate, true);
  const data = { files: [f], ...validated };
  assert.equal(calculateProjectScreening(data).metrics.pricePerKw.value, null);
  validated.suggestions.forEach(s => s.confirmed = true);
  const results = calculateProjectScreening(data);
  assert.equal(results.metrics.pricePerKw.value, 600);
  assert.equal(results.metrics.annualSavingsJod.value, null);
  assert.ok(results.missingEvidence.some(r => r.id === "electricity-bills"));
  assert.ok(results.missingEvidence.some(r => r.id === "grid-approval"));
  assert.ok(results.missingEvidence.some(r => r.id === "solar-datasheet"));
  assert.equal(results.checks.find(c => c.id === "solar-price")?.sourceId, "S13");
});
test("fabricated number, wrong page, unknown IDs/types are discarded", () => {
  const f = file();
  const answer = validateExtraction({ ...raw, values: [
    { ...raw.values[0], value: 55 },
    { ...raw.values[1], page: 2 },
    { ...raw.values[1], sentence: "Total installed price is JOD 999." },
    { ...raw.values[1], field: "invented" },
  ], requirements: [{ requirementId: "invented", result: "meets", sentence: page.text, page: 1 }] }, f, [page]);
  assert.equal(answer.suggestions.length, 3);
  assert.ok(answer.suggestions.every(s => !s.valid && s.value === null && s.validationMessage === "Not found in document"));
  assert.equal(answer.requirementMatches.length, 0);
  const unknown = file();
  const invalidType = validateExtraction({ ...raw, documentType: "magic" }, unknown, [page]);
  assert.equal(unknown.documentType, null);
  assert.equal(unknown.status, "set aside");
  assert.ok(invalidType.suggestions.every(s => !s.valid));
});
test("receipt can never count as approval", () => {
  const f = file();
  const text = "Application received, pending approval from the distribution company.";
  const answer = validateExtraction({ documentType: "application receipt", upgrade: "solar PV", requirements: [{ requirementId: "grid-approval", result: "meets", sentence: text, page: 1 }] }, f, [{ page: 1, text }]);
  assert.equal(answer.requirementMatches[0].valid, false);
});
test("file and page caps precede extraction and normalized duplicate hashes agree", () => {
  assert.throws(() => enforceScreeningLimits(Array.from({ length: 31 }, () => ({ pages: 1 }))), /30/);
  assert.throws(() => enforceScreeningLimits([{ pages: 151 }]), /150/);
  assert.doesNotThrow(() => enforceScreeningLimits([{ pages: 150 }]));
  assert.equal(byteHash(Buffer.from("same")), byteHash(Buffer.from("same")));
  assert.equal(textHash([{ page: 1, text: " SAME   text " }]), textHash([{ page: 1, text: "same text" }]));
});
test("conflicting confirmed inputs are unknown rather than first-wins", () => {
  const f = file(), validated = validateExtraction(raw, f, [page]);
  validated.suggestions.forEach(s => s.confirmed = true);
  validated.suggestions.push({ ...validated.suggestions[0], id: "conflict", value: 30 });
  assert.equal(calculateProjectScreening({ files: [f], ...validated }).metrics.pricePerKw.value, null);
});
test("numeric value must belong to rawValue, not another number in its sentence", () => {
  const sentence = "The 25 kWp solar system costs JOD 15,000.";
  const result = validateExtraction({ ...raw, values: [{ field: "priceJod", value: 25, rawValue: "JOD 15,000", sentence, page: 1 }] }, file(), [{ page: 1, text: sentence }]);
  assert.equal(result.suggestions[0].valid, false);
  assert.equal(result.suggestions[0].value, null);
});
test("building rule cites only valid confirmed suggestions", () => {
  const f = file(); f.upgrade = "building renovation"; f.documentType = "feasibility study";
  const value = { id: "confirmed", fileId: f.id, field: "claimedSavingPercent" as const, upgrade: "building renovation" as const, value: 14, rawValue: "14%", sentence: "Saving is 14%.", page: 1, valid: true, validationMessage: "", confirmed: true };
  const results = calculateProjectScreening({ files: [f], suggestions: [value, { ...value, id: "unconfirmed", confirmed: false }, { ...value, id: "invalid", valid: false }], requirementMatches: [] });
  for (const rule of results.compliance.filter(c => c.id.startsWith("building-") && c.id.endsWith("-20"))) {
    assert.deepEqual(rule.evidenceIds, ["confirmed"]);
    assert.equal(rule.status, "does not meet");
  }
});
test("contradictory confirmed requirement matches cannot be satisfied", () => {
  const f = file(); f.documentType = "utility bill"; f.upgrade = "solar PV";
  const match = { id: "yes", fileId: f.id, requirementId: "electricity-bills", result: "meets" as const, sentence: "Annual electricity bills.", page: 1, valid: true, validationMessage: "", confirmed: true };
  for (const contrary of ["partly", "does not meet"] as const) {
    const results = calculateProjectScreening({ files: [f], suggestions: [], requirementMatches: [match, { ...match, id: "no", result: contrary }] });
    assert.equal(results.compliance.find(c => c.id === "electricity-bills")?.status, "partly");
    assert.match(results.compliance.find(c => c.id === "electricity-bills")!.missing, /Contradictory/);
    assert.equal(results.metrics.annualSavingsJod.value, null);
  }
});
test("each supported upgrade exposes four layers and bank framework proof gaps", () => {
  for (const upgrade of ["solar PV", "LED", "water fixtures", "building renovation"] as const) {
    const f = file(); f.upgrade = upgrade; f.documentType = "supplier quote";
    const results = calculateProjectScreening({ files: [f], suggestions: [], requirementMatches: [] });
    assert.deepEqual(new Set(results.compliance.map(c => c.layer)), new Set(["Taxonomy", "Bank framework", "Bank checks", "Permits"]));
    assert.ok(results.compliance.some(c => c.layer === "Bank framework" && c.upgrade === upgrade && c.status === "unknown"));
  }
});
/**
 * Reference-case fixture taxonomy. Counts below are deliberately derived from
 * these records rather than maintained as independent display totals.
 */
export const REFERENCE_FILE_CLASSIFICATIONS = [
  ...Array(11).fill({ category: "screening" as const }),
  ...Array(2).fill({ category: "credit" as const }),
  ...Array(3).fill({ category: "aside" as const }),
] as const;

export const REFERENCE_MISSING_EVIDENCE = [
  ["Electricity bills, last 12 months", "University finance office"],
  ["12 months of water bills", "University finance office"],
  ["The water tariff the campus pays", "University finance office"],
  ["EPC or RSS BEP assessment for the library", "Facilities and engineering"],
  ["12+ months of the library's bills, adjusted for weather and occupancy", "Facilities and engineering"],
  ["End-of-life and recycling plan for the panels", "Suppliers and contractors"],
  ["LED line B efficiency class or ENERGY STAR listing", "Suppliers and contractors"],
  ["Fixture specs showing JS 1945:2011 or a WaterSense-type label", "Suppliers and contractors"],
] as const;

export const REFERENCE_RECEIVED_TO_CONFIRM = [
  "Solar forecast", "LED line A listing", "Library proposal",
  "Water fixtures brochure", "Grid study receipt", "Feasibility study",
] as const;

export const REFERENCE_PROOF_GAPS = [
  { layer: "taxonomy", item: "Panel end-of-life plan" },
  { layer: "taxonomy", item: "LED line B listing" },
  { layer: "taxonomy", item: "Water fixture standard" },
  { layer: "permits", item: "Grid connection approval" },
  { layer: "bank-framework", item: "Library performance evidence" },
  { layer: "bank-review", item: "Climate risk assessment" },
] as const;

/** Matching benchmarks are intentionally not included in this findings list. */
export const REFERENCE_FINDINGS = [
  { kind: "corrected" }, { kind: "corrected" }, { kind: "conflict" },
  { kind: "standIn" }, { kind: "cannotCheck" }, { kind: "cannotCheck" },
] as const;

export const REFERENCE_COMPLIANCE_OUTCOMES = [
  { layer: "jngt", criterion: "c4", outcome: "Not met" },
  { layer: "framework", criterion: "c7", outcome: "Not met" },
] as const;

const countBy = <T extends Record<string, string>>(items: readonly T[], key: keyof T, value: T[keyof T]) =>
  items.filter((item) => item[key] === value).length;

const screening = countBy(REFERENCE_FILE_CLASSIFICATIONS, "category", "screening");
const credit = countBy(REFERENCE_FILE_CLASSIFICATIONS, "category", "credit");
const setAside = countBy(REFERENCE_FILE_CLASSIFICATIONS, "category", "aside");
const corrected = countBy(REFERENCE_FINDINGS, "kind", "corrected");
const conflict = countBy(REFERENCE_FINDINGS, "kind", "conflict");
const standIn = countBy(REFERENCE_FINDINGS, "kind", "standIn");
const cannotCheck = countBy(REFERENCE_FINDINGS, "kind", "cannotCheck");
const proofGapLayers = new Set(REFERENCE_PROOF_GAPS.map((gap) => gap.layer));

export const REFERENCE_CASE_COUNTS = {
  files: { total: REFERENCE_FILE_CLASSIFICATIONS.length, screening, credit, setAside },
  evidence: {
    missing: REFERENCE_MISSING_EVIDENCE.length,
    toConfirm: REFERENCE_RECEIVED_TO_CONFIRM.length,
    proofGaps: REFERENCE_PROOF_GAPS.length,
    ruleLayers: proofGapLayers.size,
  },
  findings: { total: REFERENCE_FINDINGS.length, corrected, conflict, standIn, cannotCheck },
  compliance: { notMet: countBy(REFERENCE_COMPLIANCE_OUTCOMES, "outcome", "Not met") },
} as const;
import { createHash } from "node:crypto";
import { PROJECT_DOCUMENT_TYPES, PROJECT_FIELDS, PROJECT_REQUIREMENTS, type ProjectScreeningFile, type ProjectSuggestion, type ProjectRequirementMatch, type ProjectUpgrade } from "@tahaqqaq/screening";

export type TextPage = { page: number; text: string };
export const normalizeText = (text: string) => text.normalize("NFKC").replace(/\s+/g, " ").trim();
export const byteHash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
export const textHash = (pages: TextPage[]) => createHash("sha256").update(normalizeText(pages.map(p => p.text).join(" ")).toLowerCase()).digest("hex");
export function enforceScreeningLimits(files: { pages: number }[]) {
  if (!files.length || files.length > 30) throw new Error("Screening supports 1–30 PDF files per application.");
  if (files.some(f => !Number.isInteger(f.pages) || f.pages < 1) || files.reduce((n, f) => n + f.pages, 0) > 150) throw new Error("Application exceeds the 150-page screening limit.");
}
const upgrades: ProjectUpgrade[] = ["solar PV", "LED", "building renovation", "water fixtures", "other"];
const numeric = (text: string) => text.replace(/[٠-٩]/g, c => String("٠١٢٣٤٥٦٧٨٩".indexOf(c))).replace(/[۰-۹]/g, c => String("۰۱۲۳۴۵۶۷۸۹".indexOf(c))).replace(/[,٬]/g, "").replace(/٫/g, ".");
const numericFields = new Set(PROJECT_FIELDS.filter(f => !["billDate", "documentDate", "efficiencyLabel"].includes(f)));
function cited(sentence: unknown, page: unknown, pages: TextPage[]): sentence is string {
  return typeof sentence === "string" && sentence.trim().length >= 8 && typeof page === "number" && Number.isInteger(page) &&
    !!pages.find(p => p.page === page && normalizeText(p.text).includes(normalizeText(sentence)));
}
function validNumeric(field: string, value: unknown, sentence: string, rawValue: unknown): value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return false;
  if (["claimedSavingPercent", "loanAnnualRatePercent"].includes(field) && value > 100) return false;
  if (["systemSizeKwp", "loanYears"].includes(field) && value <= 0) return false;
  const numbers = numeric(sentence).match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  if (!numbers.includes(value)) return false;
  // Bind the numeric value to the quoted value itself, not another number in the sentence.
  // Multiple numeric tokens in rawValue are ambiguous (e.g. ranges) and need analyst clarification.
  const rawNumbers = typeof rawValue === "string" ? numeric(rawValue).match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [] : [];
  if (rawNumbers.length !== 1 || rawNumbers[0] !== value) return false;
  if (field === "priceJod" && !/\bJOD\b|Jordanian dinar|دينار/i.test(sentence)) return false;
  if (field === "systemSizeKwp" && !/kWp|kW.p|kilowatt.peak/i.test(sentence)) return false;
  if (["claimedSavingPercent", "loanAnnualRatePercent"].includes(field) && !/%|percent|per cent|٪/i.test(sentence)) return false;
  return true;
}
export function validateExtraction(raw: unknown, file: ProjectScreeningFile, pages: TextPage[], now = new Date()) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("AI did not return a JSON object.");
  const object = raw as Record<string, unknown>;
  const type = PROJECT_DOCUMENT_TYPES.find(t => t === object.documentType) ?? null;
  file.documentType = type;
  file.upgrade = upgrades.find(u => u === object.upgrade) ?? "other";
  file.summary = typeof object.summary === "string" ? normalizeText(object.summary).slice(0, 600) : "No summary supplied.";
  if (!type) { file.status = "set aside"; file.reason = "Unknown document type returned by AI; classification dropped."; }
  if (type === "unrelated") { file.status = "set aside"; file.reason = "Unrelated to this project."; }
  const suggestions: ProjectSuggestion[] = [];
  for (const [index, entry] of (Array.isArray(object.values) ? object.values : []).entries()) {
    if (!entry || typeof entry !== "object") continue;
    const field = PROJECT_FIELDS.find(f => f === entry.field);
    if (!field) continue;
    const quoteValid = cited(entry.sentence, entry.page, pages);
    const rawValid = typeof entry.rawValue === "string" && entry.rawValue.trim().length > 0 && quoteValid && normalizeText(entry.sentence).includes(normalizeText(entry.rawValue));
    const numberValid = numericFields.has(field) ? quoteValid && validNumeric(field, entry.value, entry.sentence, entry.rawValue) : typeof entry.value === "string" && quoteValid && normalizeText(entry.sentence).includes(normalizeText(entry.value));
    const dateValid = !["billDate", "documentDate"].includes(field) || typeof entry.value === "string" && !Number.isNaN(Date.parse(entry.value));
    const valid = !!type && file.status !== "set aside" && quoteValid && rawValid && numberValid && dateValid;
    suggestions.push({ id: `${file.id}:value:${index}`, fileId: file.id, field, upgrade: upgrades.find(u => u === entry.upgrade) ?? file.upgrade, value: valid ? entry.value : null, rawValue: typeof entry.rawValue === "string" ? entry.rawValue : String(entry.value ?? ""), sentence: typeof entry.sentence === "string" ? entry.sentence : "", page: Number.isInteger(entry.page) ? entry.page : 0, valid, validationMessage: valid ? "Sentence and value verified on cited page" : "Not found in document", confirmed: false });
  }
  // Dating a document is metadata, not an input to any calculation.
  const date = suggestions.find(s => s.valid && s.field === "documentDate")?.value ?? suggestions.find(s => s.valid && s.field === "billDate")?.value;
  if (typeof date === "string") {
    file.date = date;
    const cutoff = new Date(now); cutoff.setFullYear(cutoff.getFullYear() - 1);
    file.outOfDate = new Date(date) < cutoff;
  }
  const requirementMatches: ProjectRequirementMatch[] = [];
  for (const [index, entry] of (Array.isArray(object.requirements) ? object.requirements : []).entries()) {
    if (!entry || typeof entry !== "object") continue;
    const requirement = PROJECT_REQUIREMENTS.find(r => r.id === entry.requirementId);
    if (!requirement || !["meets", "partly", "does not meet"].includes(entry.result)) continue;
    let valid = !!type && file.status !== "set aside" && cited(entry.sentence, entry.page, pages);
    if (entry.result === "meets" && type && !(requirement.types as readonly string[]).includes(type)) valid = false;
    // Receipt/application evidence is never an approval, even if the model misclassifies it.
    if (entry.result === "meets" && /approval/.test(requirement.id) &&
      (type !== "grid or permit approval" || !/approv(?:al|ed)|موافقة/i.test(entry.sentence) || /receipt|application received|pending approval|not approved|طلب|إيصال/i.test(entry.sentence))) valid = false;
    if (entry.result === "meets" && ["specialist-review", "climate-risk-review", "local-permits-review"].includes(requirement.id)) valid = false; // Only separate bank review can satisfy applicability/risk checks.
    if (entry.result === "meets" && ["electricity-bills", "water-bills"].includes(requirement.id) && !/annual|12\s*months|twelve months|year|سنوي|سنة/i.test(entry.sentence)) valid = false;
    requirementMatches.push({ id: `${file.id}:requirement:${index}`, fileId: file.id, requirementId: requirement.id, result: entry.result, sentence: typeof entry.sentence === "string" ? entry.sentence : "", page: Number.isInteger(entry.page) ? entry.page : 0, valid, validationMessage: valid ? "Sentence verified on cited page" : "Not found in document", confirmed: false });
  }
  return { suggestions, requirementMatches };
}
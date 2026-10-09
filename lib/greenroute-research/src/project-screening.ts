/** Real-project data is deliberately separate from the synthetic reference inputs. */
export const SCREENING_BENCHMARKS = { solarYieldKwhPerKwp: 1639, solarPriceJodPerKw: 500, ledSavingPercent: 50, educationalTariffJodPerKwh: 0.256, efficiencyMinimumPercent: 20 } as const;
export const PROJECT_DOCUMENT_TYPES = ["supplier quote", "datasheet", "efficiency label", "contractor proposal", "utility bill", "grid or permit approval", "application receipt", "feasibility study", "financial statement", "institution profile", "unrelated", "other"] as const;
export type ProjectDocumentType = typeof PROJECT_DOCUMENT_TYPES[number];
export type ProjectUpgrade = "solar PV" | "LED" | "building renovation" | "water fixtures" | "other";
export const PROJECT_FIELDS = ["systemSizeKwp", "priceJod", "claimedYieldKwhPerKwp", "claimedSavingPercent", "buildingAreaM2", "annualElectricityKwh", "billDate", "documentDate", "efficiencyLabel", "tariffJodPerKwh", "loanPrincipalJod", "loanAnnualRatePercent", "loanYears", "gridFactorTco2PerMwh", "annualWaterM3", "waterTariffJodPerM3"] as const;
export type ProjectField = typeof PROJECT_FIELDS[number];
export type ProjectSuggestion = {
  id: string; fileId: string; field: ProjectField; upgrade: ProjectUpgrade;
  value: number | string | null; rawValue: string; sentence: string; page: number;
  valid: boolean; validationMessage: string; confirmed: boolean;
};
export type ProjectRequirementMatch = {
  id: string; fileId: string; requirementId: string; result: "meets" | "partly" | "does not meet";
  sentence: string; page: number; valid: boolean; validationMessage: string; confirmed: boolean;
};
export type ProjectScreeningFile = {
  id: string; name: string; pages: number; status: "queued" | "reading" | "extracted" | "set aside" | "unreadable" | "error";
  documentType: ProjectDocumentType | null; upgrade: ProjectUpgrade; summary: string;
  reason: string | null; duplicateOf: string | null; outOfDate: boolean; date: string | null;
  ocrPages: number[]; errors: string[];
};
export type ProjectMetric = { value: number | null; unit: string; missing: string[]; note: string };
export type ProjectCheck = { id: string; title: string; sourceId: string; actual: number | null; benchmark: number | null; unit: string; status: "matches" | "difference" | "cannot check"; note: string };
export type ProjectCompliance = { id: string; title: string; upgrade: ProjectUpgrade; layer: string; sourceId: string; status: "meets" | "partly" | "does not meet" | "unknown"; missing: string; evidenceIds: string[] };
export type ProjectResults = {
  verdict: string; summary: string; upgrades: ProjectUpgrade[];
  counts: { files: number; setAside: number; unreadable: number; unconfirmed: number; confirmed: number; missing: number; findings: number; notMet: number };
  checks: ProjectCheck[]; compliance: ProjectCompliance[];
  missingEvidence: { id: string; title: string; holder: string; upgrade: ProjectUpgrade }[];
  metrics: { pricePerKw: ProjectMetric; annualSavingsJod: ProjectMetric; annualEnergyKwh: ProjectMetric; annualPaymentJod: ProjectMetric; coverage100: ProjectMetric; coverage85: ProjectMetric; coverage70: ProjectMetric; impactTco2: ProjectMetric; totalCostJod: ProjectMetric };
};
export type ProjectScreening = {
  kind: "project"; version: 1; applicationId: string; status: "pending" | "processing" | "complete" | "error";
  startedAt: string | null; completedAt: string | null; updatedAt: string;
  model: string; error: string | null; files: ProjectScreeningFile[];
  suggestions: ProjectSuggestion[]; requirementMatches: ProjectRequirementMatch[]; results: ProjectResults;
};
export const PROJECT_REQUIREMENTS = [
  { id: "electricity-bills", title: "12 months of university electricity bills", holder: "University finance office", upgrade: "other", layer: "Bank checks", sourceId: "S03", types: ["utility bill"] },
  { id: "solar-datasheet", title: "Solar panel and inverter datasheets", holder: "Solar supplier", upgrade: "solar PV", layer: "Taxonomy", sourceId: "S09", types: ["datasheet"] },
  { id: "solar-recycling", title: "PV end-of-life and recycling plan", holder: "Solar supplier", upgrade: "solar PV", layer: "Taxonomy", sourceId: "S09", types: ["datasheet", "contractor proposal", "feasibility study"] },
  { id: "grid-approval", title: "Distribution company grid approval (not a receipt)", holder: "University facilities", upgrade: "solar PV", layer: "Permits", sourceId: "S18", types: ["grid or permit approval"] },
  { id: "municipality-approval", title: "Municipality operating approval", holder: "University facilities", upgrade: "solar PV", layer: "Permits", sourceId: "S18", types: ["grid or permit approval"] },
  { id: "led-label", title: "Top two efficiency classes or ENERGY STAR listing", holder: "Lighting supplier", upgrade: "LED", layer: "Taxonomy", sourceId: "S09", types: ["efficiency label", "datasheet"] },
  { id: "building-epc", title: "Jordanian EPC / RSS BEP and adjusted building bills for buildings over 1,000 m²", holder: "University facilities", upgrade: "building renovation", layer: "Taxonomy", sourceId: "S09", types: ["feasibility study", "efficiency label"] },
  { id: "water-label", title: "JS 1945:2011 or WaterSense-type fixture label", holder: "Water supplier", upgrade: "water fixtures", layer: "Taxonomy", sourceId: "S09", types: ["efficiency label", "datasheet"] },
  { id: "water-bills", title: "12 months of water bills and campus tariff", holder: "University finance office", upgrade: "water fixtures", layer: "Bank checks", sourceId: "S03", types: ["utility bill"] },
  { id: "financial-statements", title: "Audited university financial statements", holder: "University finance office", upgrade: "other", layer: "Bank checks", sourceId: "S03", types: ["financial statement"] },
  { id: "specialist-review", title: "Bank environmental and social specialist review", holder: "Bank specialist", upgrade: "other", layer: "Bank framework", sourceId: "S03", types: ["other"] },
  { id: "climate-risk-review", title: "Institutional climate-risk and environmental approval review", holder: "Bank specialist", upgrade: "other", layer: "Bank checks", sourceId: "S17", types: ["other"] },
  { id: "local-permits-review", title: "Local permit applicability and installation safety review", holder: "University facilities and bank specialist", upgrade: "other", layer: "Permits", sourceId: "S18", types: ["grid or permit approval"] },
] as const;

/** Only values an analyst has confirmed and code has verified can reach arithmetic. */
export function calculateProjectScreening(data: Pick<ProjectScreening, "files" | "suggestions" | "requirementMatches">): ProjectResults {
  const files = data.files.filter(f => f.status === "extracted" && f.documentType !== "unrelated");
  const fileIds = new Set(files.map(f => f.id));
  const suggestions = data.suggestions.filter(s => s.valid && s.confirmed && fileIds.has(s.fileId));
  const matches = data.requirementMatches.filter(m => m.valid && m.confirmed && fileIds.has(m.fileId));
  const upgrades = [...new Set(files.map(f => f.upgrade).filter(u => u !== "other"))];
  const metric = (value: number | null, unit: string, missing: string[] = [], note = ""): ProjectMetric =>
    ({ value: value !== null && Number.isFinite(value) ? value : null, unit, missing: [...new Set(missing)], note });
  const number = (field: ProjectField, upgrade?: ProjectUpgrade, billsOnly = false): number | null => {
    const values = suggestions.filter(s => s.field === field && (!upgrade || s.upgrade === upgrade) &&
      (!billsOnly || files.find(f => f.id === s.fileId)?.documentType === "utility bill")).map(s => s.value).filter((v): v is number => typeof v === "number");
    const unique = [...new Set(values)];
    // Conflicting supplier figures require resolution, never arbitrary first-wins.
    return unique.length === 1 ? unique[0] : null;
  };
  const required = PROJECT_REQUIREMENTS.filter(r => r.upgrade === "other" || upgrades.includes(r.upgrade));
  const compliance: ProjectCompliance[] = required.map(r => {
    const evidence = matches.filter(m => m.requirementId === r.id);
    const outcomes = new Set(evidence.map(m => m.result));
    const conflict = outcomes.size > 1;
    const status = conflict ? "partly" : outcomes.has("does not meet") ? "does not meet" : outcomes.has("meets") ? "meets" : evidence.length ? "partly" : "unknown";
    return { id: r.id, title: r.title, upgrade: r.upgrade, layer: r.layer, sourceId: r.sourceId, status, missing: conflict ? "Contradictory confirmed evidence: analyst must resolve the conflict" : status === "meets" ? "" : "Unknown: request from the university", evidenceIds: evidence.map(e => e.id) };
  });
  // Document evidence can support candidate scope, never replace the bank's category/E&S review.
  for (const upgrade of upgrades.filter(u => u !== "building renovation")) {
    const ruleIds = upgrade === "solar PV" ? ["solar-datasheet", "solar-recycling"] : upgrade === "LED" ? ["led-label"] : ["water-label", "water-bills"];
    const supporting = compliance.filter(c => ruleIds.includes(c.id));
    const allSupported = supporting.length === ruleIds.length && supporting.every(c => c.status === "meets");
    compliance.push({ id: `framework-${upgrade.replace(/\s+/g, "-").toLowerCase()}`, title: `${upgrade}: bank green-category alignment and specialist proof`, upgrade, layer: "Bank framework", sourceId: "S03", status: supporting.some(c => c.status === "does not meet") ? "does not meet" : allSupported ? "partly" : "unknown", missing: allSupported ? "Bank specialist must verify category alignment and project-specific environmental proof" : `Missing or conflicting ${upgrade} technical evidence and bank specialist category review`, evidenceIds: supporting.flatMap(c => c.evidenceIds) });
  }
  if (upgrades.includes("building renovation")) {
    const saving = number("claimedSavingPercent", "building renovation");
    for (const [id, layer, sourceId] of [["building-taxonomy-20", "Taxonomy", "S09"], ["building-framework-20", "Bank framework", "S03"]]) {
      compliance.push({ id, title: "Whole-building energy reduction of at least 20%", upgrade: "building renovation", layer, sourceId, status: saving === null ? "unknown" : saving >= SCREENING_BENCHMARKS.efficiencyMinimumPercent ? "partly" : "does not meet", missing: saving === null ? "Confirmed building saving and adjusted baseline" : saving >= SCREENING_BENCHMARKS.efficiencyMinimumPercent ? "Specialist verification of claimed savings and whole-building baseline" : "Claim is below the 20% minimum", evidenceIds: suggestions.filter(s => s.valid && s.confirmed && s.field === "claimedSavingPercent" && s.upgrade === "building renovation").map(s => s.id) });
    }
  }
  const missingEvidence = compliance.filter(c => c.status !== "meets").map(c => ({ id: c.id, title: c.title, holder: PROJECT_REQUIREMENTS.find(r => r.id === c.id)?.holder || "University facilities", upgrade: c.upgrade }));
  const size = number("systemSizeKwp", "solar PV"), price = number("priceJod", "solar PV");
  const pricePerKw = metric(size !== null && size > 0 && price !== null ? price / size : null, "JOD/kW", size && price !== null ? [] : ["Confirmed solar system size and price"], "S13 is a brief-supplied comparison only; original publication is still missing.");
  const checks: ProjectCheck[] = [];
  const check = (id: string, title: string, actual: number | null, benchmark: number, unit: string, sourceId: string, note: string) =>
    checks.push({ id, title, actual, benchmark, unit, sourceId, status: actual === null ? "cannot check" : actual === benchmark ? "matches" : "difference", note });
  if (upgrades.includes("solar PV")) {
    check("solar-price", "Solar price per kW", pricePerKw.value, SCREENING_BENCHMARKS.solarPriceJodPerKw, "JOD/kW", "S13", "Unverified brief-supplied benchmark; publication and applicability to this installation need confirmation.");
    check("solar-yield", "Solar claimed annual yield", number("claimedYieldKwhPerKwp", "solar PV"), SCREENING_BENCHMARKS.solarYieldKwhPerKwp, "kWh/kWp/year", "S10", "Published historical Jordan plant benchmark, not a project performance guarantee.");
  }
  if (upgrades.includes("LED")) check("led-saving", "LED claimed saving", number("claimedSavingPercent", "LED"), SCREENING_BENCHMARKS.ledSavingPercent, "%", "S12", "National average, not a verified saving for this project.");
  check("electricity-tariff", "Confirmed billed electricity tariff", number("tariffJodPerKwh", undefined, true), SCREENING_BENCHMARKS.educationalTariffJodPerKwh, "JOD/kWh", "S11", "Published educational benchmark; the campus billed tariff must be confirmed.");
  const electricityBills = compliance.find(c => c.id === "electricity-bills")?.status === "meets";
  const waterBills = compliance.find(c => c.id === "water-bills")?.status === "meets";
  const tariff = number("tariffJodPerKwh", undefined, true);
  const baseline = number("annualElectricityKwh", "other", true) ?? number("annualElectricityKwh", "solar PV", true);
  let totalSavings = 0, totalEnergy = 0;
  const missing: string[] = [];
  if (!upgrades.length) missing.push("Confirmed project upgrade scope");
  for (const upgrade of upgrades) {
    if (upgrade === "water fixtures") {
      const water = number("annualWaterM3", upgrade, true), rate = number("waterTariffJodPerM3", upgrade, true), saving = number("claimedSavingPercent", upgrade);
      if (!waterBills) missing.push("Confirmed 12 months of water bills");
      if (water === null || rate === null || saving === null) missing.push("Confirmed annual water use, billed water tariff and water saving");
      if (waterBills && water !== null && rate !== null && saving !== null) totalSavings += water * rate * saving / 100;
      continue;
    }
    if (!electricityBills) missing.push("Confirmed 12 months of university electricity bills");
    if (tariff === null) missing.push("Confirmed billed electricity tariff");
    let energy: number | null = null;
    if (upgrade === "solar PV") {
      const yieldValue = number("claimedYieldKwhPerKwp", upgrade);
      if (size === null || yieldValue === null || baseline === null) missing.push("Confirmed solar size, yield and annual billed electricity use");
      else energy = Math.min(size * Math.min(yieldValue, SCREENING_BENCHMARKS.solarYieldKwhPerKwp), baseline);
    } else {
      const use = number("annualElectricityKwh", upgrade, true), saving = number("claimedSavingPercent", upgrade);
      if (use === null || saving === null) missing.push(`Confirmed ${upgrade} billed baseline and saving percentage`);
      else energy = use * (upgrade === "LED" ? Math.min(saving, SCREENING_BENCHMARKS.ledSavingPercent) : saving) / 100;
    }
    if (energy !== null && electricityBills && tariff !== null) { totalEnergy += energy; totalSavings += energy * tariff; }
  }
  // Multiple energy interventions need a validated interaction model to avoid double counting.
  if (upgrades.filter(u => u !== "water fixtures").length > 1) missing.push("Specialist-verified interaction model to avoid overlapping energy savings");
  const annualEnergyKwh = metric(!missing.length ? totalEnergy : null, "kWh/year", missing, "Conservative S10/S12 comparisons; capped by confirmed billed baselines. Water is excluded from energy impact.");
  const annualSavingsJod = metric(!missing.length ? totalSavings : null, "JOD/year", missing, "Project economics only, not university repayment capacity. No export revenue or demo tariff assumed.");
  const costValues = upgrades.map(u => number("priceJod", u));
  const totalCostJod = metric(upgrades.length && costValues.every(v => v !== null) ? costValues.reduce<number>((a, b) => a + (b ?? 0), 0) : null, "JOD", ["Confirmed cost for each upgrade"]);
  if (totalCostJod.value !== null) totalCostJod.missing = [];
  const principal = number("loanPrincipalJod"), rate = number("loanAnnualRatePercent"), years = number("loanYears");
  const payment = principal !== null && rate !== null && years !== null && years > 0 ? rate === 0 ? principal / years : principal * (rate / 100) / (1 - (1 + rate / 100) ** -years) : null;
  const annualPaymentJod = metric(payment, "JOD/year", payment === null ? ["Confirmed illustrative principal, annual interest rate and loan years"] : [], "Illustrative annual amortizing payment; not a credit offer.");
  const coverage = (factor: number) => metric(annualSavingsJod.value !== null && payment !== null && payment > 0 ? annualSavingsJod.value * factor / payment : null, "times", [...annualSavingsJod.missing, ...annualPaymentJod.missing], "Savings coverage, not DSCR.");
  const factor = number("gridFactorTco2PerMwh");
  const impactTco2 = metric(annualEnergyKwh.value !== null && factor !== null ? annualEnergyKwh.value / 1000 * factor : null, "tCO2e/year", [...annualEnergyKwh.missing, ...(factor === null ? ["Confirmed emissions factor"] : [])]);
  const confirmables = [...data.suggestions, ...data.requirementMatches].filter(s => s.valid && fileIds.has(s.fileId));
  const counts = { files: data.files.length, setAside: data.files.filter(f => f.status === "set aside").length, unreadable: data.files.filter(f => f.status === "unreadable" || f.status === "error").length, unconfirmed: confirmables.filter(s => !s.confirmed).length, confirmed: confirmables.filter(s => s.confirmed).length, missing: missingEvidence.length, findings: checks.filter(c => c.status !== "matches").length, notMet: compliance.filter(c => c.status === "does not meet").length };
  return { verdict: "Not ready for credit review yet", summary: `${counts.unconfirmed} AI suggestions await confirmation; ${counts.missing} evidence requirements remain. Preliminary screening only. Credit scoring and the final green decision stay with the bank.`, upgrades, counts, checks, compliance, missingEvidence, metrics: { pricePerKw, annualSavingsJod, annualEnergyKwh, annualPaymentJod, coverage100: coverage(1), coverage85: coverage(.85), coverage70: coverage(.7), impactTco2, totalCostJod } };
}
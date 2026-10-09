/**
 * Compatibility adapter. New calculations and provenance live in
 * @workspace/greenroute-research; this keeps the original page-facing shape.
 */
import {
  referenceCase,
  referenceInputs,
  sourceRegister,
  calculateReferenceCase,
  type SourceId,
  type ReferenceCase,
  type ReferenceInputs,
} from "@workspace/greenroute-research";
import type { Application } from "@workspace/api-client-react";
import { REFERENCE_COMPLIANCE_OUTCOMES } from "@/data/case-counts";

export function caseDataForApplication(app: Application): { metrics: typeof REFERENCE_CASE_DATA.metrics; findings: typeof REFERENCE_CASE_DATA.findings; compliance: typeof REFERENCE_CASE_DATA.compliance; result: ReferenceCase; inputs: ReferenceInputs } {
  const stored = app.screeningData as { inputs?: ReferenceInputs } | null | undefined;
  const inputs = stored?.inputs || referenceInputs;
  const result = calculateReferenceCase(inputs);
  return {
    result,
    inputs,
    metrics: {
      totalRequested: result.requested, candidateScope: result.candidate,
      returnCompleteScope: result.returnCompleteScope, estimatedSavings: result.annualSavings,
      basePayment: result.loan.annuityPayment, impactMWh: result.savingsMwh, impactCO2: result.co2,
      solarYieldSubmitted: result.solarYieldClaim, solarYieldMeasured: result.solarYield,
      solarCapacityKwp: result.solarCapacityKwp, ledBaselineMwh: result.ledBaselineMwh,
      tariff: inputs.tariffJodPerKwh,
    },
    findings: result.checks.map(check => ({
      id: check.id, topic: check.topic, submitted: String(check.submitted),
      checked: String(check.used), implication: check.result, sources: check.sources,
    })),
    compliance: REFERENCE_CASE_DATA.compliance,
  };
}

export const REFERENCE_SOURCES = Object.fromEntries(
  (Object.keys(sourceRegister) as SourceId[]).map((id) => {
    const source = sourceRegister[id];
    return [id, {
      id: source.id,
      name: source.title,
      publisher: source.publisher,
      date: source.date,
      url: source.url,
      passages: source.passages,
    }];
  }),
) as Record<SourceId, (typeof sourceRegister)[SourceId] & { name: string }>;

const sourceQuote = (source: SourceId, page?: number, range?: string) => {
  const passages = sourceRegister[source].passages;
  const passage = passages.find((item) => item.page === page || item.range === range);
  return [source, page ? `page ${page}` : range, passage?.quote].filter(Boolean) as string[];
};

export const REFERENCE_CASE_DATA = {
  isReference: true,
  university: "Demo University (synthetic)",
  location: "Amman",
  title: "Campus energy upgrade",
  metrics: {
    totalRequested: referenceCase.requested,
    candidateScope: referenceCase.candidate,
    returnCompleteScope: referenceCase.returnCompleteScope,
    estimatedSavings: referenceCase.annualSavings,
    basePayment: referenceCase.loan.annuityPayment,
    impactMWh: referenceCase.savingsMwh,
    impactCO2: referenceCase.co2,
    solarYieldSubmitted: referenceCase.solarYieldClaim,
    solarYieldMeasured: referenceCase.solarYield,
    solarCapacityKwp: referenceCase.solarCapacityKwp,
    ledBaselineMwh: referenceCase.ledBaselineMwh,
    tariff: referenceInputs.tariffJodPerKwh,
  },
  findings: referenceCase.checks.map((check) => ({
    id: check.id,
    topic: check.topic,
    submitted: String(check.submitted),
    checked: String(check.used),
    implication: check.result,
    sources: check.sources,
  })),
  compliance: {
    layers: [{
      id: "jngt",
      name: "National green taxonomy",
      description: `Jordan National Green Taxonomy, ${sourceRegister.S09.date}`,
      criteria: [
        { id: "c1", label: "Solar PV activity", outcome: "Met", reason: "Solar PV is an eligible activity.", source: "S09", page: "p.86", quote: sourceRegister.S09.passages[1].quote },
        { id: "c2", label: "Do no significant harm", outcome: "Proof missing", reason: "The recycling plan for end-of-life panels is missing.", source: "S09", page: "p.86", quote: sourceRegister.S09.passages[2].quote },
        { id: "c3", label: "LED lighting replacement", outcome: "Proof missing", reason: "Line B has no listing.", source: "S09", page: "p.138", quote: sourceRegister.S09.passages[5].quote },
        { id: "c4", label: "Building renovation", outcome: REFERENCE_COMPLIANCE_OUTCOMES.find((item) => item.criterion === "c4")!.outcome, reason: `The design saves ${referenceInputs.librarySavingPercent}%; the whole building must cut energy use by at least ${referenceInputs.rules.energyEfficiencyMinimumPercent}%.`, source: "S09", page: "p.136", quote: sourceRegister.S09.passages[4].quote },
        { id: "c5", label: "Water fixtures", outcome: "Proof missing", reason: "Fixture standards and labels have not been provided.", source: "S09", page: "p.132", quote: sourceRegister.S09.passages[3].quote },
      ],
    }, {
      id: "framework",
      name: "The bank's green framework",
      description: "Illustrative only. Synthetic reference case, not bank policy.",
      criteria: [
        { id: "c6", label: "Renewable energy", outcome: "Met", reason: "Aligned with eligible green categories.", source: "S03", page: "p.19", quote: sourceRegister.S03.passages[2].quote },
        { id: "c7", label: "Library energy efficiency", outcome: REFERENCE_COMPLIANCE_OUTCOMES.find((item) => item.criterion === "c7")!.outcome, reason: `The library design saves ${referenceInputs.librarySavingPercent}%; the bank framework requires at least ${referenceInputs.rules.energyEfficiencyMinimumPercent}%.`, source: "S03", page: "p.22", quote: sourceRegister.S03.passages[0].quote },
      ],
    }, {
      id: "permits", name: "Permits and energy rules", description: "Local installation requirements",
      criteria: [{ id: "c8", label: "Grid connection approval", outcome: "Proof missing", reason: "Formal study and approval pending.", source: "S18", page: "p.5", quote: sourceRegister.S18.passages[0].quote }],
    }, {
      id: "bank", name: "Checks the bank runs itself", description: "Internal credit and policy",
      criteria: [{ id: "c9", label: "Climate risk assessment", outcome: "Bank review", reason: "Required for institutional lending.", source: "S17", page: "p.4", quote: sourceRegister.S17.passages[0].quote }],
    }],
  },
};
// Phase 2 showcase case, seeded by the API already approved (api-server data/phase2/demo_state.json).
export const APPROVED_CASE_ID = "approved-solar-led-upgrade";

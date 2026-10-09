export * from "./project-screening";
import { SCREENING_BENCHMARKS } from "./project-screening";
export type SourceId = "S03" | "S09" | "S10" | "S11" | "S12" | "S13" | "S17" | "S18";
export type SourcePassage = { page?: number; range?: string; quote: string };
export type ResearchSource = {
  id: SourceId;
  title: string;
  publisher: string;
  date: string;
  url: string;
  passages: SourcePassage[];
};

const s = (id: SourceId, title: string, publisher: string, date: string, url: string, passages: SourcePassage[]): ResearchSource =>
  ({ id, title, publisher, date, url, passages });

export const sourceRegister: Record<SourceId, ResearchSource> = {
  S03: s("S03", "Jordan Ahli Bank Sustainable Finance Framework", "Jordan Ahli Bank", "June 2024", "https://ahli.com/wp-content/uploads/2024/08/Sustainable-Finance-Framework-2024.pdf", [
    { page: 22, quote: "In general, an EE project must reduce absolute energy consumption by at least 20%." },
    { page: 14, quote: "Eligible Loans will need to satisfy the standard due diligence process as part of Jordan ahli bank's lending assessment." },
    { page: 19, quote: "Annual energy savings (MWh); or Estimated annual GHG emission avoided (tCO2e)" },
    { page: 16, quote: "final eligibility check by the E&S officer." }
  ]),
  S09: s("S09", "Jordan National Green Taxonomy", "Central Bank of Jordan and Ministry of Environment", "January 2026", "https://www.cbj.gov.jo/EBV4.0/Root_Storage/AR/Financial_Stability_/ENG_Jordan_National_Green_Taxonomy_FINAL-1.pdf", [
    { page: 3, quote: "It does not prescribe or restrict lending, investment, or financing decisions" },
    { page: 86, quote: "The activity generates electricity, heating or cooling using solar PV or other solar energy-based technologies." },
    { page: 86, quote: "End-of-life management for PV panels are implemented in accordance with recycling standards and best practices." },
    { page: 132, quote: "taps, showers and WCs must meet JS 1945:2011 or carry a WaterSense-type label." },
    { page: 136, quote: "The whole building must cut energy use by at least 20%. Buildings over 1,000 m² prove it with the Jordanian EPC or the RSS BEP tool from adjusted bills." },
    { page: 138, quote: "comply with the two highest populated efficiency classes of relevant Jordanian energy-efficiency labels (JSMO), where such labels exist, or carry an ENERGY STAR listing." }
  ]),
  S10: s("S10", "First Year Performance of a PV Plant in Jordan Compared to PV Plants in the Region", "Hamzeh et al.", "2015", "https://dergipark.org.tr/en/download/article-file/147986", [
    { page: 1, quote: "the actual and estimated specific energy productions are 1639kWh/kWp-year, and 1726 kWh/kWp-year" },
    { page: 1, quote: "The annual electricity consumption is about 4 GWh [1]." }
  ]),
  S11: s("S11", "Jordan electricity tariff guide effective 1 January 2025", "Energy and Minerals Regulatory Commission", "1 January 2025", "https://emrc.gov.jo/EBV4.0/Root_Storage/AR/EB_List_Page/%D8%AF%D9%84%D9%8A%D9%84_%D8%A7%D9%84%D8%AA%D8%B9%D8%B1%D9%81%D8%A9_2025.pdf", [
    { page: 7, quote: "educational tariff of 256 fils per kWh" }
  ]),
  S12: s("S12", "Third National Energy Efficiency Action Plan 2024–2026", "Ministry of Energy and Mineral Resources", "2024–2026", "https://www.memr.gov.jo/EBV4.0/Root_Storage/EN/EB_Info_Page/3NEEAP2024-2026.pdf", [
    { page: 91, quote: "can reach up to 70%, with an average of around 50%" },
    { page: 29, quote: "0.4447 tCO₂e per MWh" },
    { page: 3, quote: "earlier national plans delivered 40.2% and 46.3% of their targets." }
  ]),
  S13: s("S13", "Published home-solar price (citation needed)", "Publication not provided", "Date not provided", "", [
    { quote: "About JOD 500 per kW — benchmark supplied in the project brief; publication link and exact passage pending." }
  ]),
  S17: s("S17", "CBJ Climate Risk Management Regulations No. 2 of 2025", "Central Bank of Jordan", "2025", "https://data.sbfnetwork.org/sites/default/files/survey-attachments/2025-08/climate_risk_management_instructions_no_2-2025_final.pdf", [
    { page: 4, quote: "climate checks during credit processing, including environmental approvals" },
    { page: 5, quote: "where reliable data is missing, banks may use reasonable assumptions as an intermediate step." }
  ]),
  S18: s("S18", "Jordan PV installation process guide", "EBRD GEFF Jordan", "2024", "https://ebrdgeff.com/jordan/wp-content/uploads/2024/05/PV-installation-process-Industrial.pdf", [
    { page: 5, quote: "the distribution company runs a grid-impact study, then gives approval" },
    { page: 8, quote: "municipality approval to operate." }
  ])
};

export type ReferenceInputs = {
  upgradeAmounts: { solar: number; led: number; library: number; water: number };
  solar: { claimedYieldKwhPerKwp: number; benchmarkYieldKwhPerKwp: number; pricePerKw: number; benchmarkPricePerKw: number };
  led: { claimedSavingPercent: number; benchmarkSavingPercent: number };
  lightingSharePrintedPercent: number;
  lightingShareNumerator: number;
  lightingShareDenominator: number;
  campusElectricityMwh: number;
  tariffJodPerKwh: number;
  gridFactorTco2PerMwh: number;
  rules: { energyEfficiencyMinimumPercent: number };
  loan: { principalPercent: number; annualRate: number; years: number };
  coverageFactors: { full: number; stressed85: number; stressed70: number };
  librarySavingPercent: number;
  waterSavingPercent: number;
};

export const referenceInputs: ReferenceInputs = {
  upgradeAmounts: { solar: 250000, led: 180000, library: 85000, water: 38000 },
  solar: { claimedYieldKwhPerKwp: 1800, benchmarkYieldKwhPerKwp: SCREENING_BENCHMARKS.solarYieldKwhPerKwp, pricePerKw: 500, benchmarkPricePerKw: SCREENING_BENCHMARKS.solarPriceJodPerKw },
  led: { claimedSavingPercent: 70, benchmarkSavingPercent: SCREENING_BENCHMARKS.ledSavingPercent },
  lightingSharePrintedPercent: 3.2, lightingShareNumerator: 32, lightingShareDenominator: 100,
  campusElectricityMwh: 4000, tariffJodPerKwh: SCREENING_BENCHMARKS.educationalTariffJodPerKwh, gridFactorTco2PerMwh: 0.4447,
  rules: { energyEfficiencyMinimumPercent: SCREENING_BENCHMARKS.efficiencyMinimumPercent },
  loan: { principalPercent: 0.8, annualRate: 0.08, years: 5 },
  coverageFactors: { full: 1, stressed85: 0.85, stressed70: 0.7 },
  librarySavingPercent: 14, waterSavingPercent: 30
};

export type ReferenceProvenance = { sourceId: SourceId; page?: number; range?: string; note?: string };
/** Provenance for every published benchmark used by the reference calculation. */
export const referenceProvenance = {
  solarYield: { sourceId: "S10", page: 1 },
  solarPrice: { sourceId: "S13", note: "500 JOD/kW is a brief-supplied scenario benchmark; original publication not provided" },
  ledSaving: { sourceId: "S12", page: 91 },
  tariff: { sourceId: "S11", page: 7 },
  gridFactor: { sourceId: "S12", page: 29 },
  campusProfile: { sourceId: "S10", page: 1 },
  campusStandIn: { sourceId: "S17", page: 5 },
} satisfies Record<string, ReferenceProvenance>;

export type CheckResult = "Corrected" | "Matches" | "Conflict" | "Stand-in" | "Cannot check";
export type ReferenceCheck = { id: string; topic: string; submitted: number | string; benchmark: number | string; used: number | string; result: CheckResult; sources: { sourceId: SourceId; page?: number; range?: string }[] };
export type ReferenceCase = {
  requested: number; candidate: number; returnCompleteScope: number; annualSavings: number; savingsMwh: number;
  solarCapacityKwp: number; ledBaselineMwh: number;
  solarYield: number; solarYieldClaim: number; solarYieldPercentAbove: number; solarPrice: number; ledSavingPercent: number;
  loan: { principal: number; annuityPayment: number; annualRate: number; years: number };
  coverage: { savingsAt100: number; savingsAt85: number; savingsAt70: number };
  breakEvenPercent: number; co2: number; checks: ReferenceCheck[];
  derivedFromSyntheticAssumptions: { solarCapacityKwp: boolean; ledBaselineMwh: boolean };
};

export const calculateReferenceCase = (input: ReferenceInputs): ReferenceCase => {
  const returnCompleteScope = input.upgradeAmounts.library + input.upgradeAmounts.water;
  const requested = input.upgradeAmounts.solar + input.upgradeAmounts.led + returnCompleteScope;
  const candidate = input.upgradeAmounts.solar + input.upgradeAmounts.led;
  // Capacity and lighting baseline are synthetic-case derivations, not measurements:
  // solar cost / published scenario price, and campus stand-in × arithmetic share.
  const solarCapacityKwp = input.upgradeAmounts.solar / input.solar.benchmarkPricePerKw;
  const ledBaselineMwh = input.campusElectricityMwh * input.lightingShareNumerator / input.lightingShareDenominator;
  const solarMwh = solarCapacityKwp * input.solar.benchmarkYieldKwhPerKwp / 1000;
  const ledMwh = ledBaselineMwh * input.led.benchmarkSavingPercent / 100;
  const savingsMwh = solarMwh + ledMwh;
  const annualSavings = savingsMwh * 1000 * input.tariffJodPerKwh;
  const principal = candidate * input.loan.principalPercent;
  const r = input.loan.annualRate, n = input.loan.years;
  const annuityPayment = principal * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
  const arithmeticShare = input.lightingShareNumerator / input.lightingShareDenominator * 100;
  return {
    requested, candidate, returnCompleteScope, annualSavings, savingsMwh, solarCapacityKwp, ledBaselineMwh,
    solarYield: input.solar.benchmarkYieldKwhPerKwp, solarYieldClaim: input.solar.claimedYieldKwhPerKwp,
    solarYieldPercentAbove: (input.solar.claimedYieldKwhPerKwp / input.solar.benchmarkYieldKwhPerKwp - 1) * 100,
    solarPrice: input.solar.benchmarkPricePerKw, ledSavingPercent: input.led.benchmarkSavingPercent,
    loan: { principal, annuityPayment, annualRate: r, years: n },
    coverage: {
      savingsAt100: annualSavings * input.coverageFactors.full / annuityPayment,
      savingsAt85: annualSavings * input.coverageFactors.stressed85 / annuityPayment,
      savingsAt70: annualSavings * input.coverageFactors.stressed70 / annuityPayment
    },
    breakEvenPercent: annuityPayment / annualSavings * 100, co2: savingsMwh * input.gridFactorTco2PerMwh,
    checks: [
      { id: "solar-yield", topic: "Solar yield forecast", submitted: input.solar.claimedYieldKwhPerKwp, benchmark: input.solar.benchmarkYieldKwhPerKwp, used: input.solar.benchmarkYieldKwhPerKwp, result: "Corrected", sources: [{ sourceId: "S10", page: 1 }] },
      { id: "solar-price", topic: "Solar price", submitted: input.solar.pricePerKw, benchmark: input.solar.benchmarkPricePerKw, used: input.solar.benchmarkPricePerKw, result: input.solar.pricePerKw === input.solar.benchmarkPricePerKw ? "Matches" : "Conflict", sources: [{ sourceId: "S13" }] },
      { id: "led", topic: "LED saving", submitted: input.led.claimedSavingPercent, benchmark: input.led.benchmarkSavingPercent, used: input.led.benchmarkSavingPercent, result: "Corrected", sources: [{ sourceId: "S12", page: 91 }] },
      { id: "lighting-share", topic: "Lighting share", submitted: input.lightingSharePrintedPercent, benchmark: arithmeticShare, used: arithmeticShare, result: "Conflict", sources: [] },
      { id: "campus", topic: "Campus electricity", submitted: "No bills", benchmark: input.campusElectricityMwh, used: input.campusElectricityMwh, result: "Stand-in", sources: [{ sourceId: "S10", page: 1 }, { sourceId: "S17", page: 5 }] },
      { id: "baselines", topic: "Library and water baselines", submitted: `Library ${input.librarySavingPercent}%; water ${input.waterSavingPercent}%`, benchmark: "Measured baselines and product labels missing", used: "Cannot verify either claim", result: "Cannot check", sources: [] }
    ],
    derivedFromSyntheticAssumptions: { solarCapacityKwp: true, ledBaselineMwh: true }
  };
};

export const referenceCase = calculateReferenceCase(referenceInputs);
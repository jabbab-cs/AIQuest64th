export const referenceId = "reference-campus-energy-upgrade";
export const syntheticStamp = "SYNTHETIC DEMO DOCUMENT — not a real record";

type ReferenceDocument = { name: string; category: "screening" | "credit" | "aside"; quality: string; text: string; pages: number };
const quote = "20 Aug 2026 supplier quote. 500 kWp on roofs and car-park shades. Price JOD 250,000. Projected yield 1,800 kWh/kWp/year. Valid 60 days. This is a supplier claim, not measured generation.";
export const referenceDocuments: ReferenceDocument[] = [
  { name: "Solar_Quote_FINAL_v3.pdf", category: "screening", pages: 2, quality: "Supplier claim", text: quote },
  { name: "Solar_Quote_FINAL_v3 (1).pdf", category: "aside", pages: 2, quality: "Exact duplicate", text: quote },
  { name: "Fwd_ Solar quote.pdf", category: "aside", pages: 2, quality: "Duplicate text", text: quote },
  { name: "PV_modules_and_inverters_datasheets.pdf", category: "screening", pages: 3, quality: "Certificates missing", text: "Monocrystalline panels and three-phase string inverter. Manufacturer certificates are mentioned, but copies have not been submitted." },
  { name: "LED_offer_2026.pdf", category: "screening", pages: 2, quality: "Supplier claim", text: "25 Aug 2026 supplier offer. Classroom and office panel line A; high-bay and outdoor line B. Price JOD 180,000. Supplier claims up to 70% lighting saving. This claim is not measured." },
  { name: "LED_panel_lineA_ENERGY_STAR.pdf", category: "screening", pages: 2, quality: "Line A only", text: "Product sheet shows ENERGY STAR listing for LED panel line A only. It does not establish certification for high-bay/outdoor line B." },
  { name: "Library_upgrade_proposal.pdf", category: "screening", pages: 2, quality: "Baseline missing", text: "30 Jul 2026 contractor proposal. Main library 6,000 m², window film and HVAC controls. Cost JOD 85,000. Claims 14% whole-building reduction. Measured baseline and performance proof are absent." },
  { name: "Water_saving_fixtures_brochure.pdf", category: "screening", pages: 2, quality: "Baseline missing", text: "1 Jun 2026 brochure. Taps and dual-flush toilets, JOD 38,000. Claims up to 30% water saving. Baseline and product labels are absent." },
  { name: "Electricity_bill_March_2019.pdf", category: "screening", pages: 1, quality: "Stale · replace", text: "March 2019 electricity bill. Historical bill only; cannot establish the current electricity baseline." },
  { name: "scan_0012.pdf", category: "screening", pages: 1, quality: "Unreadable · replace", text: "[Image-only scan. No readable text could be extracted. Request a legible copy.]" },
  { name: "Grid_connection_application_receipt.pdf", category: "screening", pages: 1, quality: "Study pending", text: "1 Sep 2026 receipt of grid-impact study application. The study is pending. This receipt is not grid approval." },
  { name: "Campus_newsletter_Spring_2026.pdf", category: "aside", pages: 3, quality: "Irrelevant", text: "Spring 2026 newsletter: graduation, football and cafeteria updates. No project screening evidence." },
  { name: "About_Demo_University_2026.pdf", category: "credit", pages: 2, quality: "Context only", text: "Institution background and admissions overview. This is context for credit staff, not evidence of repayment capacity." },
  { name: "Solar_generation_forecast_2026.pdf", category: "screening", pages: 2, quality: "Method missing", text: "22 Aug 2026 supplier projection: 500 kWp at 1,800 kWh/kWp/year. No forecast method or measured site output is provided." },
  { name: "Campus_energy_feasibility_study.pdf", category: "screening", pages: 3, quality: "Unconfirmed total", text: "26 Aug 2026 feasibility study. Solar JOD 250,000, LED JOD 180,000, library JOD 85,000, water JOD 38,000. Total JOD 553,000. Savings are estimated from supplier claims. No verified operating baseline, university cash flow or debt schedule." },
  { name: "Institution_financial_summary_2026.pdf", category: "credit", pages: 2, quality: "Unaudited", text: "27 Aug 2026 management revenue and cash forecast only. Audited financial statements, existing debt schedule and debt-service history have not been submitted. No repayment conclusion can be drawn." },
];
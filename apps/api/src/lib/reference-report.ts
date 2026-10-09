import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { calculateReferenceCase, referenceInputs, sourceRegister, type ReferenceInputs } from "@tahaqqaq/screening";
import { referenceDocuments } from "./reference";

export const missingRequirements = [
  { item: "Electricity bills, last 12 months", requester: "University finance office" },
  { item: "12 months of water bills", requester: "University finance office" },
  { item: "The water tariff the campus pays", requester: "University finance office" },
  { item: "EPC or RSS BEP assessment for the library", requester: "Facilities and engineering" },
  { item: "12+ months of the library's bills, adjusted for weather and occupancy", requester: "Facilities and engineering" },
  { item: "End-of-life and recycling plan for the panels", requester: "Suppliers and contractors" },
  { item: "LED line B efficiency class or ENERGY STAR listing", requester: "Suppliers and contractors" },
  { item: "Fixture specs showing JS 1945:2011 or a WaterSense-type label", requester: "Suppliers and contractors" },
];

const money = (n: number) => `JOD ${Math.round(n).toLocaleString()}`;
const clean = (s: string) => s.replace(/–|—/g, "-").replace(/·/g, "/").replace(/²/g, "2").replace(/₂/g, "2").replace(/[^\x20-\x7e]/g, "");

/** The PDF intentionally uses the same research calculation as the web report. */
export async function makeReferencePDF(kind: "memo" | "requests", inputs: ReferenceInputs = referenceInputs) {
  const data = calculateReferenceCase(inputs);
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const green = rgb(0.055, 0.22, 0.16), moss = rgb(0.20, 0.39, 0.28), ink = rgb(0.08, 0.14, 0.12);
  const pale = rgb(0.93, 0.97, 0.94), cream = rgb(0.985, 0.99, 0.975), line = rgb(0.79, 0.86, 0.81);
  const amber = rgb(0.72, 0.43, 0.07), red = rgb(0.64, 0.18, 0.14), blue = rgb(0.16, 0.34, 0.48);
  const white = rgb(1, 1, 1), muted = rgb(0.34, 0.42, 0.37);
  type Color = ReturnType<typeof rgb>;
  type Op = { type: "text" | "rect" | "line"; x: number; y: number; w?: number; h?: number; value?: string; size?: number; font?: PDFFont; color?: Color };
  const pages: Op[][] = [];
  let ops: Op[] = [];
  let y = 0;
  const push = (op: Op) => ops.push(op);
  const lines = (value: string, size: number, font: PDFFont, width: number) => {
    const result: string[] = [];
    let row = "";
    for (const word of clean(value).split(/\s+/).filter(Boolean)) {
      const next = row ? `${row} ${word}` : word;
      if (row && font.widthOfTextAtSize(next, size) > width) { result.push(row); row = word; } else row = next;
    }
    if (row) result.push(row);
    return result;
  };
  const label = (value: string, x: number, yy: number, size = 10, font = regular, color = ink) =>
    push({ type: "text", value: clean(value), x, y: yy, size, font, color });
  const rect = (x: number, yy: number, w: number, h: number, color: Color) => push({ type: "rect", x, y: yy, w, h, color });
  const rule = (x: number, yy: number, w: number, color = line) => push({ type: "line", x, y: yy, w, color });
  const paragraph = (value: string, x = 42, width = 510, size = 10, font = regular, color = ink, leading = 14) => {
    for (const row of lines(value, size, font, width)) { label(row, x, y, size, font, color); y -= leading; }
  };
  const newPage = (title: string, kicker: string, intro?: string) => {
    if (ops.length) pages.push(ops);
    ops = [];
    rect(0, 0, 595, 842, cream);
    rect(0, 803, 595, 39, green);
    label("GREENROUTE", 42, 818, 9, bold, white);
    label(kicker.toUpperCase(), 116, 818, 7, bold, rgb(0.72, 0.89, 0.78));
    y = 762;
    paragraph(title, 42, 510, 23, bold, green, 27);
    y -= 3;
    rule(42, y, 510);
    y -= 19;
    if (intro) { paragraph(intro, 42, 510, 10, regular, muted, 14); y -= 7; }
  };
  const statusStyle = (status: string): [Color, Color] =>
    /MET|VERIFIED|MATCHES/.test(status) && !/NOT/.test(status) ? [moss, pale] :
      /NOT MET|UNUSABLE|SET ASIDE/.test(status) ? [red, rgb(0.98, 0.93, 0.92)] :
        /BANK REVIEW|STAND-IN/.test(status) ? [blue, rgb(0.92, 0.96, 0.98)] : [amber, rgb(0.99, 0.96, 0.88)];
  const pill = (value: string, x: number, yy: number) => {
    const textValue = clean(value).toUpperCase();
    const [color, bg] = statusStyle(textValue);
    const width = Math.min(150, bold.widthOfTextAtSize(textValue, 7.5) + 18);
    rect(x, yy - 4, width, 18, bg); label(textValue, x + 9, yy + 1, 7.5, bold, color);
  };
  const field = (name: string, value: string, x: number, yy: number, width: number) => {
    label(name.toUpperCase(), x, yy, 7.5, bold, moss);
    lines(value, 10, regular, width).forEach((row, i) => label(row, x, yy - 15 - i * 13, 10, regular, ink));
  };
  const footerAndAssert = () => {
    pages.push(ops);
    pages.forEach((pageOps, pageIndex) => {
      for (const op of pageOps) {
        if (op.x < 0 || op.y < 0 || op.x + (op.w ?? 0) > 595.1 || op.y + (op.h ?? 0) > 842.1) {
          throw new Error(`Reference PDF layout out of bounds on page ${pageIndex + 1}`);
        }
        if (op.type === "text" && (op.y < 50 || op.y > 830)) throw new Error(`Reference PDF text outside safe area on page ${pageIndex + 1}`);
        if (op.type === "text" && op.font!.widthOfTextAtSize(op.value!, op.size!) > 595 - op.x + 0.1) {
          throw new Error(`Reference PDF unwrapped text on page ${pageIndex + 1}`);
        }
      }
    });
  };

  // Page 1: summary hero retained, with decisions kept deliberately preliminary.
  ops = [];
  rect(0, 0, 595, 842, cream); rect(0, 666, 595, 176, green);
  label("GREENROUTE", 42, 808, 9, bold, rgb(0.72, 0.89, 0.78));
  label(kind === "memo" ? "SCREENING REPORT" : "EVIDENCE REQUEST LIST", 42, 780, 8, bold, rgb(0.72, 0.89, 0.78));
  y = 743;
  paragraph(kind === "memo" ? "Request evidence before credit review" : "Evidence needed before review", 42, 500, 23, bold, white, 27);
  label("Preliminary screening for the bank's reviewer, not a credit decision", 42, 690, 9, regular, white);
  y = 634; label("DEMO UNIVERSITY (SYNTHETIC) / AMMAN", 42, y, 7, bold, moss); y -= 19;
  label("Campus energy upgrade", 42, y, 12, bold, green); y -= 33;
  if (kind === "memo") {
    label("1", 49, y + 2, 10, bold, white); rect(42, y - 5, 24, 24, green); label("1", 50, y + 1, 10, bold, white);
    label("Summary", 78, y + 1, 17, bold, green); y -= 29;
    const tiles = [
      ["REQUESTED", money(data.requested), "4 upgrades"], ["CANDIDATE SCOPE", money(data.candidate), "Solar + LED / proof required"],
      ["RETURN OR COMPLETE", money(data.returnCompleteScope), "Library + water"], ["ANNUAL SAVINGS", money(data.annualSavings), "Illustrative screening result"],
      ["COVERAGE", `${data.coverage.savingsAt100.toFixed(1)}x`, `${data.coverage.savingsAt70.toFixed(1)}x at 70% savings`],
      ["IMPACT", `${data.savingsMwh.toFixed(1)} MWh`, `${data.co2.toFixed(0)} tCO2e / year`],
    ];
    tiles.forEach(([a, b, c], i) => {
      const x = 42 + (i % 3) * 175, yy = y - Math.floor(i / 3) * 75;
      rect(x, yy - 61, 160, 66, pale); rect(x, yy - 61, 4, 66, moss);
      label(a, x + 13, yy - 12, 6.8, bold, moss); label(b, x + 13, yy - 32, 13, bold, ink);
      lines(c, 7.2, regular, 136).slice(0, 2).forEach((row, j) => label(row, x + 13, yy - 47 - j * 9, 7.2, regular, muted));
    });
    y -= 155; rect(42, y - 54, 510, 54, rgb(0.90, 0.95, 0.91));
    label("NEXT ACTION", 55, y - 17, 7, bold, green);
    lines("Request the missing evidence, then specialist review. The bank retains eligibility and credit decisions.", 9.5, regular, 390)
      .forEach((row, i) => label(row, 145, y - 17 - i * 13, 9.5, regular, ink));
  } else {
    rect(42, y - 82, 510, 82, pale); rect(42, y - 82, 5, 82, green);
    label("8 REQUESTS / 3 OWNERS", 61, y - 22, 14, bold, green);
    label("Screening evidence only", 61, y - 43, 10, bold, ink);
    label("Later-stage payout and credit items are separated.", 61, y - 61, 10, regular, muted);
  }

  if (kind === "memo") {
    newPage("Scope by upgrade", "Decision map", "Each status is a screening judgment, not an approval. Amounts and rules are unchanged.");
    const upgrades = [
      ["SOLAR PV", money(inputs.upgradeAmounts.solar), "CONDITIONAL / PROOF MISSING", "Eligible activity is plausible, but supplier forecast is not verified and end-of-life proof is missing.", "Forecast method or measured site output; panel recycling plan."],
      ["LED LIGHTING", money(inputs.upgradeAmounts.led), "CONDITIONAL / PROOF MISSING", "50% benchmark is used instead of the 70% supplier claim. Line B listing is absent.", "LED line B efficiency class or ENERGY STAR listing."],
      ["LIBRARY RETROFIT", money(inputs.upgradeAmounts.library), "NOT MET", `Claimed ${inputs.librarySavingPercent}% reduction is below the ${inputs.rules.energyEfficiencyMinimumPercent}% whole-building rule; baseline is also absent.`, "EPC or RSS BEP assessment and 12+ months adjusted bills."],
      ["WATER FIXTURES", money(inputs.upgradeAmounts.water), "UNKNOWN / CANNOT SCREEN", "The 30% brochure claim has no measured baseline or qualifying product labels.", "12 months water bills, tariff, and JS 1945:2011 or WaterSense-type labels."],
    ];
    upgrades.forEach(([name, amount, status, reason, needed], i) => {
      const x = i % 2 ? 307 : 42, yy = 690 - Math.floor(i / 2) * 275;
      rect(x, yy - 235, 245, 240, white); rect(x, yy - 235, 5, 240, green);
      label(name, x + 18, yy - 25, 12, bold, green); label(amount, x + 18, yy - 49, 16, bold, ink); pill(status, x + 18, yy - 79);
      field("SCREENING REASON", reason, x + 18, yy - 112, 205);
      field("EVIDENCE NEEDED", needed, x + 18, yy - 180, 205);
    });

    const inventoryRows = referenceDocuments;
    [inventoryRows.slice(0, 6), inventoryRows.slice(6, 11), inventoryRows.slice(11)].forEach((chunk, pageNo) => {
      newPage(pageNo ? "Evidence inventory / continued" : "Evidence inventory", "16 submitted files",
        pageNo ? "Remaining screening, set-aside and credit-only records." : "Supplier claims are not verified evidence. Credit-only files are not green proof.");
      label("DOCUMENT", 48, y, 8, bold, moss); label("QUALITY", 264, y, 8, bold, moss); label("WHAT IT SUPPORTS / WHY UNUSABLE", 370, y, 8, bold, moss);
      y -= 13; rule(42, y, 510); y -= 8;
      chunk.forEach(doc => {
        const support = doc.category === "aside" ? `Set aside: ${doc.text}` :
          doc.category === "credit" ? `Credit-only, not green proof. ${doc.text}` :
            /Supplier claim/.test(doc.quality) ? `Supplier claim is not verified. ${doc.text}` : doc.text;
        const a = lines(doc.name, 10, bold, 198), b = lines(doc.quality, 10, bold, 92), c = lines(support, 10, regular, 176);
        const h = Math.max(50, Math.max(a.length, b.length, c.length) * 12 + 17);
        rect(42, y - h + 5, 510, h, doc.category === "aside" ? rgb(0.98, 0.94, 0.93) : doc.category === "credit" ? rgb(0.93, 0.96, 0.98) : white);
        rect(42, y - h + 5, 4, h, doc.category === "aside" ? red : doc.category === "credit" ? blue : moss);
        a.forEach((r, i) => label(r, 52, y - 11 - i * 12, 10, bold, ink));
        b.forEach((r, i) => label(r, 264, y - 11 - i * 12, 10, bold, doc.category === "aside" ? red : moss));
        c.forEach((r, i) => label(r, 370, y - 11 - i * 12, 10, regular, ink));
        y -= h + 5;
      });
    });

    const checkMeaning: Record<string, [string, string]> = {
      "solar-yield": ["Published benchmark / S10 p.1", "Supplier forecast corrected for screening; site output remains unverified."],
      "solar-price": ["Brief-supplied scenario / S13 citation missing", "The numbers match, but this is not a verified published benchmark."],
      led: ["Published benchmark / S12 p.91", "Use 50% for screening, not the supplier's unmeasured 70% claim."],
      "lighting-share": ["Arithmetic from 32 / 100", "Printed 3.2% conflicts with the underlying arithmetic; 32% is used."],
      campus: ["4 GWh stand-in / S10 p.1; permitted as intermediate by S17 p.5", "Not campus evidence. Replace with 12 months of current bills."],
      baselines: ["No benchmark can replace project baselines", "Library and water claims cannot be checked."],
    };
    const formatCheckValue = (check: (typeof data.checks)[number], value: number | string, role: "submitted" | "used") => {
      if (check.id === "solar-yield") return `${Number(value).toLocaleString()} kWh/kWp/year`;
      if (check.id === "solar-price") return `JOD ${Number(value).toLocaleString()} / kW`;
      if (check.id === "led" || check.id === "lighting-share") return `${Number(value).toLocaleString()}%`;
      if (check.id === "campus" && role === "used") return `${(Number(value) * 1000).toLocaleString()} kWh/year`;
      return String(value);
    };
    [data.checks.slice(0, 3), data.checks.slice(3)].forEach((chunk, pageNo) => {
      newPage(pageNo ? "Data checks / continued" : "Data checks", "Submitted claims vs screening inputs", "Findings distinguish published benchmarks, arithmetic corrections, stand-ins and evidence gaps.");
      chunk.forEach((check, i) => {
        const yy = 682 - i * 190; rect(42, yy - 163, 510, 170, white); rect(42, yy - 163, 5, 170, green);
        label(check.topic, 55, yy - 20, 11, bold, green); pill(check.result, 430, yy - 21);
        field("SUBMITTED", formatCheckValue(check, check.submitted, "submitted"), 55, yy - 49, 125);
        field("REFERENCE OR SCREENING INPUT", `${formatCheckValue(check, check.used, "used")} / ${checkMeaning[check.id][0]}`, 195, yy - 49, 165);
        field("FINDING / MEANING", checkMeaning[check.id][1], 375, yy - 49, 160);
      });
    });

    newPage("Compliance matrix", "Four layers / no approval", "Statuses reproduce the demo compliance mapping. They are screening outcomes, not an eligibility or credit approval.");
    const layers = [
      ["NATIONAL GREEN TAXONOMY / S09", [
        ["Solar PV activity", "MET", "Solar PV is an eligible activity.", "Continue evidence review"],
        ["Do no significant harm", "PROOF MISSING", "The recycling plan for end-of-life panels is missing.", "Request recycling plan"],
        ["LED lighting replacement", "PROOF MISSING", "Line B has no listing.", "Request line B listing"],
        ["Building renovation", "NOT MET", `The design saves ${inputs.librarySavingPercent}%; the whole building must cut energy use by at least ${inputs.rules.energyEfficiencyMinimumPercent}%. EPC or RSS BEP baseline proof is also absent.`, "Return or redesign; provide EPC / RSS BEP proof"],
        ["Water fixtures", "PROOF MISSING", "Fixture standards and labels have not been provided.", "Request product labels"],
      ]],
      ["BANK GREEN FRAMEWORK / S03", [
        ["Renewable energy", "MET", "Aligned with eligible green categories.", "Specialist eligibility review"],
        ["Library energy efficiency", "NOT MET", `The library design saves ${inputs.librarySavingPercent}%; the bank framework requires at least ${inputs.rules.energyEfficiencyMinimumPercent}%.`, "Return or redesign; provide performance evidence"],
      ]],
      ["PERMITS + ENERGY RULES / S18", [["Grid connection approval", "PROOF MISSING", "Formal study and approval pending.", "Obtain formal approval"]]],
      ["BANK-RUN CHECKS / S17", [["Climate risk assessment", "BANK REVIEW", "Required for institutional lending.", "Bank completes review"]]],
    ] as const;
    layers.forEach(([layerName, rows], layerIndex) => {
      if (layerIndex === 1) newPage("Compliance matrix / continued", "Framework, permits + bank checks", "These are separate rule layers. A green-screening status does not determine credit approval.");
      label(layerName, 42, y, 10, bold, green); y -= 16;
      rows.forEach(([criterion, status, blocker, action]) => {
        const detailLines = Math.max(lines(blocker, 10, regular, 135).length, lines(action, 10, regular, 92).length);
        const height = Math.max(58, 31 + detailLines * 13);
        rect(42, y - height + 4, 510, height, white); label(criterion, 53, y - 15, 10, bold, ink); pill(status, 190, y - 17);
        field("BLOCKER / BASIS", blocker, 302, y - 5, 135); field("NEXT ACTION", action, 448, y - 5, 92); y -= height + 6;
      });
      y -= 6;
    });

    newPage("Project analysis", "Illustrative economics", "Screening arithmetic only. Savings, assumptions and loan illustration are not bank terms.");
    rect(42, y - 84, 510, 88, pale); label("ANNUAL SAVINGS FORMULA", 57, y - 20, 8, bold, moss);
    label(`${data.savingsMwh.toFixed(1)} MWh x 1,000 kWh/MWh x ${inputs.tariffJodPerKwh} JOD/kWh`, 57, y - 47, 14, bold, green);
    label(`= ${money(data.annualSavings)} per year`, 57, y - 70, 14, bold, ink); y -= 115;
    label("STRESS COVERAGE", 42, y, 11, bold, green); y -= 25;
    ([[100, data.coverage.savingsAt100], [85, data.coverage.savingsAt85], [70, data.coverage.savingsAt70]] as const).forEach(([pct, value]) => {
      label(`${pct}% savings`, 42, y, 10, bold, ink); rect(145, y - 4, 300, 14, line); rect(145, y - 4, Math.min(300, value / 5 * 300), 14, moss);
      label(`${value.toFixed(1)}x`, 465, y, 11, bold, green); y -= 34;
    });
    y -= 7; label("ASSUMPTIONS / NOT BANK TERMS", 42, y, 11, bold, green); y -= 22;
    const assumptions = [
      ["Candidate principal", `${money(data.loan.principal)} / ${Math.round(inputs.loan.principalPercent * 100)}% of candidate scope`],
      ["Illustrative financing", `${(data.loan.annualRate * 100).toFixed(0)}% assumed / ${data.loan.years} years / ${money(data.loan.annuityPayment)} annual payment`],
      ["Synthetic derivations", `${data.solarCapacityKwp.toFixed(0)} kWp from cost / price; ${data.ledBaselineMwh.toFixed(0)} MWh lighting baseline from stand-in campus use`],
      ["Impact factor", `${inputs.gridFactorTco2PerMwh} tCO2e/MWh / S12 p.29 / ${data.co2.toFixed(0)} tCO2e per year`],
    ];
    assumptions.forEach(([a, b]) => { rect(42, y - 49, 510, 54, white); field(a, b, 55, y - 10, 480); y -= 62; });
  }

  const requestOwners = ["University finance office", "Facilities and engineering", "Suppliers and contractors"];
  requestOwners.forEach((owner, ownerIndex) => {
    newPage(ownerIndex ? `Evidence requests / ${owner}` : "Evidence requests", "Owner-grouped actions",
      ownerIndex ? undefined : "Request now: 8 items. Received items awaiting confirmation are not requested again.");
    const ownerItems = missingRequirements.filter(item => item.requester === owner);
    label(owner.toUpperCase(), 42, y, 11, bold, green); y -= 22;
    ownerItems.forEach((item, index) => {
      const why = /Electricity bills/.test(item.item) ? "Replace the campus electricity stand-in with a current operating baseline." :
        /water bills/.test(item.item) ? "Establish current water consumption before testing the savings claim." :
          /water tariff/.test(item.item) ? "Convert measured water savings into a supported financial estimate." :
            /EPC|RSS/.test(item.item) ? "Test the whole-building reduction against the 20% rule." :
              /library/.test(item.item) ? "Create a weather- and occupancy-adjusted library baseline." :
                /End-of-life/.test(item.item) ? "Address the taxonomy recycling requirement for PV panels." :
                  /LED/.test(item.item) ? "Line A evidence does not establish line B eligibility." :
                    "Show that fixtures meet JS 1945:2011 or a WaterSense-type label.";
      const yy = y; rect(42, yy - 125, 510, 130, white); rect(42, yy - 125, 5, 130, green);
      label(String(index + 1).padStart(2, "0"), 56, yy - 23, 9, bold, moss);
      lines(item.item, 11, bold, 440).forEach((r, i) => label(r, 88, yy - 20 - i * 14, 11, bold, ink));
      field("WHY NEEDED", why, 88, yy - 61, 310); field("STAGE", "Request now / preliminary screening", 416, yy - 61, 120);
      y -= 143;
    });
    if (ownerIndex === 0) {
      label("RECEIVED / AWAITING CONFIRMATION / DO NOT REQUEST AGAIN", 42, y, 8, bold, moss); y -= 19;
      paragraph("Solar forecast / LED line A listing / Library proposal / Water fixtures brochure / Grid study receipt / Feasibility study", 42, 510, 10, regular, ink, 14);
      y -= 9; label("LATER STAGES", 42, y, 10, bold, green); y -= 18;
      paragraph("Before payout: grid-connection approval; municipality permit plus electrical-safety sign-off. Credit team: legal identity; 3 years audited statements; debt schedule; governance.", 42, 510, 10, regular, ink, 14);
    }
  });

  if (kind === "memo") {
    newPage("Limits + source register", "Provenance", "Bills, baselines, labels, permits and audited financials are incomplete. Assumptions are intermediate screening inputs, not proof.");
    Object.values(sourceRegister).forEach(source => {
      const status = source.id === "S13" ? "CITATION MISSING" : "SOURCE LOCATED";
      const refs = source.passages.map(p => p.page ? `p.${p.page}` : p.range || "no page").join(", ");
      rect(42, y - 67, 510, 72, white); label(source.id, 55, y - 18, 11, bold, green); pill(status, 90, y - 20);
      lines(source.title, 10, bold, 290).forEach((r, i) => label(r, 232, y - 17 - i * 13, 10, bold, ink));
      label(`${clean(source.publisher)} / ${clean(source.date)}`, 55, y - 46, 9, regular, muted);
      label(`PASSAGES: ${refs}`, 322, y - 48, 8, bold, moss); y -= 80;
    });

    const summaryOnly = new Set(["S03:p.16", "S09:p.132", "S09:p.136", "S11:p.7", "S12:p.29", "S12:p.3", "S17:p.4", "S17:p.5", "S18:p.5", "S18:p.8", "S13:"]);
    const passages = Object.values(sourceRegister).flatMap(source => source.passages.map(passage => ({ source, passage })));
    let appendixPage = 0;
    for (const { source, passage } of passages) {
      const reference = `${source.id}:${passage.page ? `p.${passage.page}` : passage.range ?? ""}`;
      const quoteLines = lines(passage.quote, 10, regular, 470);
      const height = 54 + quoteLines.length * 14;
      if (!appendixPage || y - height < 62) {
        appendixPage += 1;
        newPage(appendixPage === 1 ? "Appendix / source passages" : "Appendix / source passages continued", "Exact quote vs summary", "Quoted text is separated from analyst summaries. Badges identify source and page.");
      }
      rect(42, y - height + 5, 510, height, white); rect(42, y - height + 5, 5, height, green);
      const badge = `${source.id} / ${passage.page ? `p.${passage.page}` : passage.range || "page not provided"}`;
      pill(badge, 55, y - 18);
      label(summaryOnly.has(reference) ? "SUMMARY" : "EXACT QUOTE", 410, y - 13, 8, bold, summaryOnly.has(reference) ? amber : moss);
      quoteLines.forEach((row, i) => label(row, 55, y - 44 - i * 14, 10, regular, ink));
      y -= height + 10;
    }
    if (y < 125) newPage("Appendix B / record of changes", "Data lineage");
    else { y -= 10; label("APPENDIX B / RECORD OF CHANGES", 42, y, 13, bold, green); y -= 22; }
    paragraph("Inputs and source register loaded from @tahaqqaq/screening; supplier claims corrected or labelled as stand-ins; local request history retained.", 42, 510, 10, regular, ink, 14);
  }

  footerAndAssert();
  const total = pages.length;
  pages.forEach((pageOps, index) => {
    const page = pdf.addPage([595, 842]);
    pageOps.forEach(op => {
      if (op.type === "rect") page.drawRectangle({ x: op.x, y: op.y, width: op.w!, height: op.h!, color: op.color });
      else if (op.type === "line") page.drawLine({ start: { x: op.x, y: op.y }, end: { x: op.x + op.w!, y: op.y }, thickness: 0.6, color: op.color });
      else page.drawText(op.value!, { x: op.x, y: op.y, size: op.size, font: op.font, color: op.color });
    });
    page.drawLine({ start: { x: 42, y: 44 }, end: { x: 552, y: 44 }, thickness: 0.5, color: line });
    page.drawText("Synthetic reference case, not a real record. Preliminary screening, not a lending decision.", { x: 42, y: 27, size: 7.2, font: regular, color: muted });
    page.drawText(`${index + 1} / ${total}`, { x: 522, y: 27, size: 7.2, font: bold, color: moss });
  });
  return Buffer.from(await pdf.save());
}
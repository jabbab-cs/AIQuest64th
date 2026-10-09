import { calculateReferenceCase, referenceInputs, type ReferenceInputs } from "@tahaqqaq/screening";
import { referenceDocuments, syntheticStamp } from "./reference";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

export type SyntheticScreening = { inputs: ReferenceInputs; result: ReturnType<typeof calculateReferenceCase> };

const normalize = (value: string) => value.replace(/[^\x20-\x7e]/g, "-").replace(/\s+/g, " ").trim().toLowerCase();
const numberAfter = (text: string, pattern: RegExp) => {
  const match = text.match(pattern);
  return match ? Number(match[1].replace(/,/g, "")) : undefined;
};

async function extractText(bytes: Buffer): Promise<string> {
  const require = createRequire(import.meta.url);
  GlobalWorkerOptions.workerSrc = pathToFileURL(require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs")).href;
  const document = await getDocument({ data: new Uint8Array(bytes), disableWorker: true } as any).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => "str" in item ? item.str : "").join(" "));
  }
  return pages.join(" ");
}

/** Validates the uploaded bytes against every fixed synthetic source before enabling screening. */
export async function detectSyntheticFiles(files: { name: string; bytes: Buffer }[]): Promise<SyntheticScreening | null> {
  if (files.length !== referenceDocuments.length || new Set(files.map(file => file.name)).size !== referenceDocuments.length) return null;
  const byName = new Map<string, string>();
  try {
    for (const file of files) byName.set(file.name, normalize(await extractText(file.bytes)));
  } catch {
    return null;
  }
  for (const source of referenceDocuments) {
    const text = byName.get(source.name);
    if (!text || !text.includes(normalize(syntheticStamp)) || !text.includes(normalize(source.text).slice(0, 28))) return null;
  }
  const joined = files.map(file => byName.get(file.name) || "").join(" ");
  const solar = numberAfter(byName.get("Solar_Quote_FINAL_v3.pdf") || "", /price\s+jod\s*([\d,]+)/i);
  const led = numberAfter(byName.get("LED_offer_2026.pdf") || "", /price\s+jod\s*([\d,]+)/i);
  const library = numberAfter(byName.get("Library_upgrade_proposal.pdf") || "", /cost\s+jod\s*([\d,]+)/i);
  const water = numberAfter(byName.get("Water_saving_fixtures_brochure.pdf") || "", /jod\s*([\d,]+)/i);
  const claimedYieldKwhPerKwp = numberAfter(joined, /projected\s+yield\s+([\d,]+)\s+kwh/i);
  const claimedSavingPercent = numberAfter(joined, /claims\s+up\s+to\s+([\d.]+)%\s+lighting/i);
  const librarySavingPercent = numberAfter(joined, /claims\s+([\d.]+)%\s+whole-building/i);
  const waterSavingPercent = numberAfter(joined, /claims\s+up\s+to\s+([\d.]+)%\s+water/i);
  if ([solar, led, library, water, claimedYieldKwhPerKwp, claimedSavingPercent, librarySavingPercent, waterSavingPercent].some(value => value === undefined)) return null;
  const inputs: ReferenceInputs = {
    ...referenceInputs,
    upgradeAmounts: { solar: solar!, led: led!, library: library!, water: water! },
    solar: { ...referenceInputs.solar, claimedYieldKwhPerKwp: claimedYieldKwhPerKwp! },
    led: { ...referenceInputs.led, claimedSavingPercent: claimedSavingPercent! },
    librarySavingPercent: librarySavingPercent!,
    waterSavingPercent: waterSavingPercent!,
  };
  return { inputs, result: calculateReferenceCase(inputs) };
}
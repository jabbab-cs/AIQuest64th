import { test } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { referenceDocuments, syntheticStamp } from "./reference";
import { detectSyntheticFiles } from "./synthetic-screening";

async function fixture(text: string) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  page.drawText(syntheticStamp, { x: 20, y: 800, font, size: 10 });
  page.drawText(text.replace(/[^\x20-\x7e]/g, "-"), { x: 20, y: 760, font, size: 8 });
  return Buffer.from(await pdf.save());
}

test("only the complete stamped reference PDF set is screened", async () => {
  const files = await Promise.all(referenceDocuments.map(async (document) => ({
    name: document.name,
    bytes: await fixture(document.text),
  })));
  const screened = await detectSyntheticFiles(files);
  assert.equal(screened?.result.requested, 553000);
  assert.equal(screened?.result.candidate, 430000);
  assert.equal(await detectSyntheticFiles([{ name: "ordinary.pdf", bytes: await fixture("ordinary upload") }]), null);
});
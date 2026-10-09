import assert from "node:assert/strict";
import { test } from "node:test";
import { PDFDocument } from "pdf-lib";
import { createCanvas } from "@napi-rs/canvas";
import type { ProjectScreeningFile } from "@tahaqqaq/screening";
import { extractProjectPages } from "./project-pdf";

test("local OCR reads an image-only PDF through production worker and language paths", { timeout: 180000 }, async () => {
  const canvas = createCanvas(1200, 450), context = canvas.getContext("2d");
  context.fillStyle = "white"; context.fillRect(0, 0, 1200, 450);
  context.fillStyle = "black"; context.font = "36px sans-serif";
  context.fillText("SOLAR QUOTATION", 50, 100);
  context.fillText("System size: 25 kWp", 50, 180);
  context.fillText("Total price: JOD 15000", 50, 260);
  const pdf = await PDFDocument.create();
  const image = await pdf.embedPng(canvas.toBuffer("image/png"));
  pdf.addPage([600, 225]).drawImage(image, { x: 0, y: 0, width: 600, height: 225 });
  const file: ProjectScreeningFile = { id: "ocr-test", name: "scan.pdf", pages: 1, status: "reading", documentType: null, upgrade: "other", summary: "", reason: null, duplicateOf: null, outOfDate: false, date: null, ocrPages: [], errors: [] };
  const pages = await extractProjectPages(Buffer.from(await pdf.save()), file);
  assert.deepEqual(file.ocrPages, [1]);
  assert.match(pages[0].text, /25\s*kWp/i);
  assert.match(pages[0].text, /15000/);
});
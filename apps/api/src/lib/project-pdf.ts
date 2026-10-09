import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import { mkdir } from "node:fs/promises";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { ProjectScreeningFile } from "@tahaqqaq/screening";
import type { TextPage } from "./project-extraction";
const require = createRequire(import.meta.url);
GlobalWorkerOptions.workerSrc = pathToFileURL(require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs")).href;
const fonts = join(dirname(require.resolve("pdfjs-dist/package.json")), "standard_fonts/");
/** Page-faithful extraction; a textless page must pass local OCR or the file is unreadable. */
export async function extractProjectPages(bytes: Buffer, file: ProjectScreeningFile): Promise<TextPage[]> {
  const document = await getDocument({ data: new Uint8Array(bytes), standardFontDataUrl: fonts, isEvalSupported: false }).promise;
  let worker: Awaited<ReturnType<typeof import("tesseract.js").createWorker>> | undefined;
  try {
    if (document.numPages !== file.pages) throw new Error("PDF page count differs from upload metadata.");
    const pages: TextPage[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      let text = content.items.map(item => "str" in item ? item.str : "").join(" ").trim();
      if (!text) {
        const canvasModule = "@napi-rs/" + "canvas";
        const { createCanvas } = await import(canvasModule) as typeof import("@napi-rs/canvas");
        const viewport = page.getViewport({ scale: 1.8 });
        if (viewport.width * viewport.height > 24_000_000) throw new Error("OCR page is too large. Request a text copy.");
        const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
        await page.render({ canvasContext: canvas.getContext("2d") as any, viewport }).promise;
        if (!worker) {
          const { createWorker } = await import("tesseract.js");
          const cachePath = join(tmpdir(), "greenroute-ocr");
          await mkdir(cachePath, { recursive: true });
          worker = await createWorker("eng+ara", 1, { cachePath });
        }
        const result = await worker.recognize(canvas.toBuffer("image/png"));
        text = result.data.text.trim();
        if (result.data.confidence < 35 || text.length < 8) throw new Error(`OCR failed on page ${pageNumber}.`);
        file.ocrPages.push(pageNumber);
      }
      pages.push({ page: pageNumber, text });
    }
    return pages;
  } finally { await worker?.terminate(); await document.destroy(); }
}
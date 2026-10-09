import { createRequire } from "node:module";
import { sourceRegister, type SourceId } from "@tahaqqaq/screening";
import { objectStorageClient } from "./objectStorage";
import { getDocument, GlobalWorkerOptions, Util } from "pdfjs-dist/legacy/build/pdf.mjs";
import { pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const MAX_PDF_BYTES = 30 * 1024 * 1024;
// Keep downloaded originals stable when the rendered-image format changes.
const PDF_PREFIX = "source-evidence-v2";
const RENDER_PREFIX = "source-evidence-v3";
type EvidenceState = { status: "preparing" | "available" | "unavailable"; matched: boolean; page: number | null; imagePath?: string; reason?: string };
const states = new Map<string, EvidenceState>();
const pdfLoads = new Map<string, Promise<Buffer>>();
const require = createRequire(import.meta.url);
GlobalWorkerOptions.workerSrc = pathToFileURL(require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs")).href;
const standardFontDataUrl = join(dirname(require.resolve("pdfjs-dist/package.json")), "standard_fonts") + "/";

function bucketPath(): { bucket: ReturnType<typeof objectStorageClient.bucket>; privatePrefix: string } {
  const raw = process.env.PRIVATE_OBJECT_DIR || "local/private";
  const clean = raw.replace(/^\/+|\/+$/g, "");
  const slash = clean.indexOf("/");
  if (slash < 1) throw new Error("PRIVATE_OBJECT_DIR is invalid");
  return { bucket: objectStorageClient.bucket(clean.slice(0, slash)), privatePrefix: clean.slice(slash + 1) };
}
function key(sourceId: string, index: number) { return `${sourceId}/${index}`; }
function normalize(text: string) { return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim(); }
function source(sourceId: string) { return Object.values(sourceRegister).find(item => item.id === sourceId); }

async function readCached(bucket: ReturnType<typeof objectStorageClient.bucket>, path: string) {
  const file = bucket.file(path);
  const [exists] = await file.exists();
  return exists ? file : null;
}

async function getSourcePdf(sourceId: SourceId, url: string): Promise<Buffer> {
  const active = pdfLoads.get(sourceId);
  if (active) return active;
  const load = (async () => {
    const { bucket, privatePrefix } = bucketPath();
    const pdfPath = `${privatePrefix}/${PDF_PREFIX}/${sourceId}/original.pdf`;
    const cached = await readCached(bucket, pdfPath);
    if (cached) {
      const [bytes] = await cached.download();
      if (bytes.length <= MAX_PDF_BYTES && bytes.subarray(0, 5).toString() === "%PDF-") return bytes;
      await cached.delete({ ignoreNotFound: true });
    }
    const upstream = await fetch(url, { signal: AbortSignal.timeout(30_000), redirect: "follow" });
    if (!upstream.ok || !upstream.body) throw new Error(`source download returned ${upstream.status}`);
    const reader = upstream.body.getReader(); const chunks: Buffer[] = []; let size = 0;
    while (true) {
      const part = await reader.read(); if (part.done) break;
      size += part.value.byteLength;
      if (size > MAX_PDF_BYTES) { await reader.cancel(); throw new Error("source PDF exceeds size limit"); }
      chunks.push(Buffer.from(part.value));
    }
    const bytes = Buffer.concat(chunks);
    if (bytes.subarray(0, 5).toString() !== "%PDF-") throw new Error("source did not return a PDF");
    await bucket.file(pdfPath).save(bytes, { contentType: "application/pdf", resumable: false, private: true });
    return bytes;
  })();
  pdfLoads.set(sourceId, load);
  return load;
}

async function warmPassage(sourceId: SourceId, passageIndex: number): Promise<void> {
  const item = source(sourceId);
  const passage = item?.passages[passageIndex];
  const id = key(sourceId, passageIndex);
  if (!item || !passage || !passage.page || !item.url) {
    states.set(id, { status: "unavailable", matched: false, page: passage?.page ?? null, reason: !item?.url ? "no public source link" : "page not specified" });
    return;
  }
  try {
    const { bucket, privatePrefix } = bucketPath();
    const metadataPath = `${privatePrefix}/${RENDER_PREFIX}/${sourceId}/${passageIndex}.json`;
    const cached = await readCached(bucket, metadataPath);
    if (cached) {
      const [bytes] = await cached.download();
      states.set(id, JSON.parse(bytes.toString()) as EvidenceState);
      return;
    }
    const bytes = await getSourcePdf(sourceId, item.url);
    const document = await getDocument({ data: new Uint8Array(bytes), disableWorker: true, standardFontDataUrl } as any).promise;
    const page = await document.getPage(passage.page);
    const viewport = page.getViewport({ scale: 1.6 });
    // Keep the native renderer external to the esbuild bundle.
    const canvasModule = "@napi-rs/" + "canvas";
    const { createCanvas } = await import(canvasModule) as typeof import("@napi-rs/canvas");
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const context = canvas.getContext("2d");
    const text = await page.getTextContent();
    const items = text.items.filter((entry): entry is typeof entry & { str: string; transform: number[]; width: number } =>
      "str" in entry && "transform" in entry && "width" in entry);
    const wanted = normalize(passage.quote);
    let joined = ""; const spans: { start: number; end: number; index: number }[] = [];
    items.forEach((entry, index) => {
      const value = normalize(entry.str); if (!value) return;
      if (joined) joined += " ";
      const start = joined.length; joined += value; spans.push({ start, end: joined.length, index });
    });
    const matchStart = joined.indexOf(wanted);
    const matchEnd = matchStart + wanted.length;
    const matched = matchStart >= 0;
    await page.render({ canvasContext: context as any, viewport }).promise;
    if (matched) {
      context.fillStyle = "rgba(255, 232, 115, 0.52)";
      for (const span of spans.filter(value => value.end > matchStart && value.start < matchEnd)) {
        const entry = items[span.index];
        const normalizedLength = Math.max(1, span.end - span.start);
        const localStart = Math.max(0, matchStart - span.start);
        const localEnd = Math.min(normalizedLength, matchEnd - span.start);
        const startRatio = localStart / normalizedLength;
        const endRatio = localEnd / normalizedLength;
        const transformed = Util.transform(viewport.transform, entry.transform);
        const itemWidth = entry.width * viewport.scale;
        const height = Math.max(8, Math.hypot(transformed[2], transformed[3]));
        const x = transformed[4] + itemWidth * startRatio;
        const y = transformed[5];
        context.fillRect(x, y - height, Math.max(2, itemWidth * (endRatio - startRatio)), height + 3);
      }
    }
    const imagePath = `${privatePrefix}/${RENDER_PREFIX}/${sourceId}/${passageIndex}.png`;
    await bucket.file(imagePath).save(canvas.toBuffer("image/png"), { contentType: "image/png", resumable: false, private: true });
    const state: EvidenceState = { status: "available", matched, page: passage.page, imagePath };
    await bucket.file(metadataPath).save(Buffer.from(JSON.stringify(state)), { contentType: "application/json", resumable: false, private: true });
    states.set(id, state);
  } catch (error) {
    const state: EvidenceState = { status: "unavailable", matched: false, page: passage.page, reason: error instanceof Error ? error.message : "rendering failed" };
    states.set(id, state);
    try {
      const { bucket, privatePrefix } = bucketPath();
      await bucket.file(`${privatePrefix}/${RENDER_PREFIX}/${sourceId}/${passageIndex}.json`).save(Buffer.from(JSON.stringify(state)), { contentType: "application/json", resumable: false, private: true });
    } catch { /* In-memory unavailable state remains explicit if storage itself failed. */ }
  }
}

export function warmSourceEvidence(): void {
  for (const item of Object.values(sourceRegister)) {
    item.passages.forEach((passage, index) => {
      states.set(key(item.id, index), {
        status: passage.page && item.url ? "preparing" : "unavailable",
        matched: false,
        page: passage.page ?? null,
      });
      void warmPassage(item.id, index);
    });
  }
}

export function getSourceEvidence(sourceId: string, passageIndex: number) {
  const id = key(sourceId, passageIndex);
  const state = states.get(id) || { status: "unavailable" as const, matched: false, page: null };
  return { status: state.status, matched: state.matched, page: state.page, imageUrl: state.status === "available" ? `/api/source-evidence/${encodeURIComponent(sourceId)}/${passageIndex}/image` : undefined };
}

export async function streamSourceEvidenceImage(sourceId: string, passageIndex: number, res: { setHeader(name: string, value: string): void; status(code: number): { json(body: unknown): void }; send(body: Buffer): void }) {
  const state = states.get(key(sourceId, passageIndex));
  if (!state?.imagePath) { res.status(404).json({ error: "Evidence page image unavailable." }); return; }
  try {
    const { bucket } = bucketPath(); const file = await readCached(bucket, state.imagePath);
    if (!file) { res.status(404).json({ error: "Evidence page image unavailable." }); return; }
    const [bytes] = await file.download(); res.setHeader("Content-Type", "image/png"); res.setHeader("Cache-Control", "private, max-age=86400"); res.send(bytes);
  } catch { res.status(404).json({ error: "Evidence page image unavailable." }); }
}
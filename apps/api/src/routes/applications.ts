import express, { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { eq, desc, inArray, sql } from "drizzle-orm";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  db, applicationsTable, applicationFilesTable, evidenceRequestsTable,
  type ApplicationRow, type ApplicationFileRow,
} from "@tahaqqaq/db";
import {
  ListApplicationsResponse, CreateApplicationBody, CreateApplicationResponse,
  GetApplicationParams, GetApplicationResponse, RequestUploadUrlBody, RequestUploadUrlResponse,
  ListEvidenceRequestsParams, ListEvidenceRequestsResponse, RecordEvidenceRequestBody,
  RecordEvidenceRequestParams, RecordEvidenceRequestResponse,
} from "@tahaqqaq/api-zod";
import { ObjectStorageService } from "../lib/objectStorage";
import { referenceDocuments, referenceId, syntheticStamp } from "../lib/reference";
import { makeReferencePDF } from "../lib/reference-report";
import { detectSyntheticFiles } from "../lib/synthetic-screening";
import { calculateReferenceCase, sourceRegister, type ReferenceInputs } from "@tahaqqaq/screening";
import { getSourceEvidence, streamSourceEvidenceImage } from "../lib/sourceEvidence";
import { emptyProjectScreening, parseProjectScreening, saveProjectScreening, runProjectScreening, screeningRateAllowed, screeningIsActive, claimScreening, releaseScreening } from "../lib/project-screening";
import { enforceScreeningLimits } from "../lib/project-extraction";
import { makeProjectPDF } from "../lib/project-report";
import { calculateProjectScreening } from "@tahaqqaq/screening";
import { verificationApi, resetVerification, siteOrigin, approvedCaseId } from "../lib/verification";

const router: IRouter = Router();
const storage = new ObjectStorageService();
const MAX_SIZE = 15 * 1024 * 1024;

async function ensureReference() {
  // Additive compatibility for databases created before demo screening existed.
  await db.execute(sql`ALTER TABLE campus_applications ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false`);
  await db.execute(sql`ALTER TABLE campus_applications ADD COLUMN IF NOT EXISTS screening_data text`);
  await db.execute(sql`ALTER TABLE campus_applications ADD COLUMN IF NOT EXISTS institution_type text`);
  await db.insert(applicationsTable).values({
    id: referenceId, university: "Demo University (synthetic)", title: "Campus energy upgrade",
    description: "Four proposed campus upgrades: solar generation, LED lighting, main library renovation and water-saving fixtures. Synthetic reference case for evidence-led pre-credit screening.",
    location: "Amman", status: "Pending", isReference: true,
  }).onConflictDoNothing();
  // Phase 2 showcase: a separate case whose evidence was confirmed and scope approved before the demo starts.
  await db.insert(applicationsTable).values({
    id: approvedCaseId, university: "Amman Private Hospital (synthetic)", institutionType: "Hospital", title: "Solar and LED upgrade",
    description: "Rooftop solar PV (250 kW) and LED lighting. Evidence confirmed and scope approved by the bank; ready for on-site verification. Synthetic case.",
    location: "Amman", status: "Approved", isReference: false,
  }).onConflictDoNothing();
  await db.insert(applicationFilesTable).values(referenceDocuments.map((doc, index) => ({
    id: `reference-${String(index + 1).padStart(2, "0")}`,
    applicationId: referenceId, name: doc.name, size: 0,
    objectPath: `reference-${index + 1}`, category: doc.category, pages: doc.pages,
    quality: doc.quality, extractedText: doc.text,
  }))).onConflictDoNothing();
}
let seed: Promise<void> | undefined;
function ready() {
  if (!seed) seed = ensureReference().catch(error => { seed = undefined; throw error; });
  return seed;
}
// Phase 2 routes: approve-scope, /verification and the installer's /site endpoints.
router.use(async (req, res, next): Promise<void> => {
  if (!/^\/(verification|site)(\/|$)|\/approve-scope$/.test(req.path)) { next(); return; }
  await ready();
  const reply = await verificationApi(req.method, req.path, req.body ?? {}, {
    getApp: async id => (await db.select().from(applicationsTable).where(eq(applicationsTable.id, id)))[0],
    setStatus: async (id, status) => { await db.update(applicationsTable).set({ status }).where(eq(applicationsTable.id, id)); },
    siteOrigin: siteOrigin(req.get("x-forwarded-host") ?? req.get("host"), req.get("x-forwarded-proto")?.split(",")[0] ?? req.protocol),
  });
  if (!reply) { next(); return; }
  if (reply.pdf) {
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${reply.pdf.name}"`);
    res.setHeader("Cache-Control", "private, no-store");
    res.send(Buffer.from(reply.pdf.bytes)); return;
  }
  res.status(reply.status).json(reply.json);
});
function param(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function fileDTO(file: ApplicationFileRow) {
  return {
    id: file.id, name: file.name, size: file.size,
    url: `/api/files/${encodeURIComponent(file.id)}/original`, category: file.category,
    pages: file.pages, quality: file.quality, text: file.extractedText,
  };
}
async function applicationDTO(row: ApplicationRow) {
  const files = await db.select().from(applicationFilesTable).where(eq(applicationFilesTable.applicationId, row.id));
  const stored = row.screeningData ? JSON.parse(row.screeningData) as { kind?: string; inputs: ReferenceInputs } : null;
  return {
    id: row.id, university: row.university, institutionType: row.institutionType, title: row.title, description: row.description,
    location: row.location, status: row.status, isReference: row.isReference,
    isDemo: row.isDemo, screeningData: stored ? stored.kind === "project" ? parseProjectScreening(row.screeningData) : { inputs: stored.inputs, result: calculateReferenceCase(stored.inputs) } : null,
    createdAt: row.createdAt.toISOString(), files: files.map(fileDTO),
  };
}

router.get("/applications", async (_req, res): Promise<void> => {
  await ready();
  const rows = await db.select().from(applicationsTable).orderBy(desc(applicationsTable.createdAt));
  res.json(ListApplicationsResponse.parse(await Promise.all(rows.map(applicationDTO))));
});
router.get("/applications/:id", async (req, res): Promise<void> => {
  await ready();
  const parsed = GetApplicationParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: "Invalid application ID" }); return; }
  const [row] = await db.select().from(applicationsTable).where(eq(applicationsTable.id, parsed.data.id));
  if (!row) { res.status(404).json({ error: "Application not found" }); return; }
  res.json(GetApplicationResponse.parse(await applicationDTO(row)));
});
router.post("/uploads/request-url", async (req, res): Promise<void> => {
  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success || !parsed.data.name.toLowerCase().endsWith(".pdf") ||
      parsed.data.contentType !== "application/pdf") {
    res.status(400).json({ error: "Choose a non-empty PDF up to 15 MB." }); return;
  }
  const uploadURL = await storage.getObjectEntityUploadURL();
  res.json(RequestUploadUrlResponse.parse({ uploadURL, objectPath: storage.normalizeObjectEntityPath(uploadURL) }));
});
router.put("/uploads/:id", express.raw({ type: () => true, limit: MAX_SIZE }), async (req, res): Promise<void> => {
  const id = param(req.params.id) || "";
  const bytes = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
  if (!/^[0-9a-f-]{36}$/.test(id) || bytes.length < 1 || bytes.subarray(0, 5).toString() !== "%PDF-") { res.status(400).json({ error: "Upload a non-empty PDF up to 15 MB." }); return; }
  if ((await storage.getObjectEntityFile(`/objects/uploads/${id}`).then(() => true, () => false))) { res.status(409).json({ error: "This upload slot was already used." }); return; }
  await storage.saveUpload(id, bytes);
  res.status(200).end();
});
router.post("/applications", async (req, res): Promise<void> => {
  await ready();
  const parsed = CreateApplicationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Check the required fields and attach 1–30 PDF files (15 MB max each).", details: parsed.error.issues }); return; }
  const input = parsed.data;
  if (!input.university.trim() || !input.title.trim() || !input.description.trim() ||
      input.files.some(f => !f.name.toLowerCase().endsWith(".pdf") || f.size < 1 || f.size > MAX_SIZE ||
        !/^\/objects\/uploads\/[0-9a-f-]{36}$/.test(f.objectPath)) ||
      new Set(input.files.map(f => f.objectPath)).size !== input.files.length) {
    res.status(400).json({ error: "Provide valid project details and non-empty PDF files, up to 15 MB each." }); return;
  }
  // Verify actual stored bytes; a submitted path or filename alone is never enough.
  const checked: { path: string; size: number; pages: number; bytes: Buffer }[] = [];
  try {
    for (const inputFile of input.files) {
      const existing = await db.select({ id: applicationFilesTable.id }).from(applicationFilesTable)
        .where(eq(applicationFilesTable.objectPath, inputFile.objectPath)).limit(1);
      if (existing.length) throw new Error("A file has already been submitted.");
      const object = await storage.getObjectEntityFile(inputFile.objectPath);
      const [bytes] = await object.download();
      if (bytes.length !== inputFile.size || bytes.length < 1 || bytes.length > MAX_SIZE ||
          bytes.subarray(0, 5).toString() !== "%PDF-") throw new Error("A selected file is empty, oversized, or not a valid PDF.");
      const pdf = await PDFDocument.load(bytes, { ignoreEncryption: false });
      if (pdf.getPageCount() < 1) throw new Error("A selected PDF has no pages.");
      checked.push({ path: inputFile.objectPath, size: bytes.length, pages: pdf.getPageCount(), bytes });
    }
    enforceScreeningLimits(checked);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Could not validate the PDF files." }); return;
  }
  const demo = await detectSyntheticFiles(input.files.map((file, index) => ({ name: file.name, bytes: checked[index].bytes })));
  const screeningData = demo ? JSON.stringify(demo) : null;
  const id = randomUUID();
  await db.transaction(async tx => {
    await tx.insert(applicationsTable).values({
      id, university: input.university.trim(), institutionType: input.institutionType ?? null, title: input.title.trim(), description: input.description.trim(),
      status: demo ? "New" : "Pending", isReference: !!demo, isDemo: !!demo, screeningData, location: "",
    });
    await tx.insert(applicationFilesTable).values(input.files.map((file, index) => ({
      id: randomUUID(), applicationId: id, name: file.name, size: checked[index].size,
      objectPath: checked[index].path, pages: checked[index].pages,
      category: demo ? referenceDocuments.find(doc => doc.name === file.name)?.category || "received" : "received",
      quality: demo ? referenceDocuments.find(doc => doc.name === file.name)?.quality || "Received" : "Received · awaiting screening",
      extractedText: demo ? referenceDocuments.find(doc => doc.name === file.name)?.text || "" : "Original PDF received. No case-specific extraction or screening has been performed yet.",
    })));
  });
  const [row] = await db.select().from(applicationsTable).where(eq(applicationsTable.id, id));
  res.status(201).json(CreateApplicationResponse.parse(await applicationDTO(row)));
});
router.post("/applications/:id/complete-screening", async (req, res): Promise<void> => {
  const id = param(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid application ID" }); return; }
  const [application] = await db.select().from(applicationsTable).where(eq(applicationsTable.id, id));
  if (!application || !application.isDemo) { res.status(404).json({ error: "This endpoint is only available for the synthetic demo submission." }); return; }
  const [updated] = await db.update(applicationsTable).set({ status: "Evidence requested" }).where(eq(applicationsTable.id, id)).returning();
  res.json(await applicationDTO(updated));
});
router.get("/applications/:id/screening", async (req, res): Promise<void> => {
  await ready();
  const id = param(req.params.id) || "";
  const [row] = await db.select().from(applicationsTable).where(eq(applicationsTable.id, id));
  if (!row || row.isReference || row.isDemo) { res.status(404).json({ error: "Real-project application not found." }); return; }
  const data = parseProjectScreening(row.screeningData) ?? emptyProjectScreening(id);
  if (data.status === "processing" && !screeningIsActive(id)) {
    data.status = "error"; data.error = "Screening was interrupted by a server restart. Press Screen this application to retry.";
    await saveProjectScreening(data);
  }
  res.json(data);
});
router.post("/applications/:id/screen", async (req, res): Promise<void> => {
  await ready();
  const id = param(req.params.id) || "";
  const [row] = await db.select().from(applicationsTable).where(eq(applicationsTable.id, id));
  if (!row || row.isReference || row.isDemo) { res.status(404).json({ error: "Real-project application not found; the demo flow is unchanged." }); return; }
  const existing = parseProjectScreening(row.screeningData);
  if (existing?.status === "complete" || existing?.status === "processing" && screeningIsActive(id)) { res.status(existing.status === "processing" ? 202 : 200).json(existing); return; }
  const files = await db.select().from(applicationFilesTable).where(eq(applicationFilesTable.applicationId, id));
  try { enforceScreeningLimits(files); } catch (error) { res.status(400).json({ error: (error as Error).message }); return; }
  if (!screeningRateAllowed(req.ip || "unknown")) { res.status(429).json({ error: "Screening is busy or the hourly request limit was reached. Try again later." }); return; }
  if (!claimScreening(id)) { res.status(409).json({ error: "This application is already being screened." }); return; }
  const data = emptyProjectScreening(id);
  data.status = "processing"; data.startedAt = new Date().toISOString();
  data.files = files.map(file => ({ id: file.id, name: file.name, pages: file.pages, status: "queued", documentType: null, upgrade: "other", summary: "", reason: null, duplicateOf: null, outOfDate: false, date: null, ocrPages: [], errors: [] }));
  try {
    await saveProjectScreening(data);
    res.status(202).json(data);
    void runProjectScreening(data, files).catch(error => req.log.error({ error }, "Project screening persistence failed"));
  } catch (error) { releaseScreening(id); throw error; }
});
router.post("/applications/:id/screening/confirm", async (req, res): Promise<void> => {
  const id = param(req.params.id) || "";
  const body = req.body as { itemIds?: unknown; confirmed?: unknown };
  if (!Array.isArray(body?.itemIds) || !body.itemIds.length || body.itemIds.length > 1000 || !body.itemIds.every(item => typeof item === "string") || typeof body.confirmed !== "boolean") {
    res.status(400).json({ error: "Choose valid suggestion IDs and an explicit confirmation state." }); return;
  }
  const ids = new Set(body.itemIds as string[]);
  const outcome = await db.transaction(async tx => {
    const [row] = await tx.select().from(applicationsTable).where(eq(applicationsTable.id, id)).for("update");
    const data = row && !row.isReference && !row.isDemo ? parseProjectScreening(row.screeningData) : null;
    if (!data || data.status !== "complete") return null;
    const items = [...data.suggestions, ...data.requirementMatches];
    const chosen = items.filter(s => ids.has(s.id));
    if (chosen.length !== ids.size || chosen.some(s => !s.valid || data.files.find(f => f.id === s.fileId)?.status !== "extracted")) return false;
    for (const item of chosen) item.confirmed = body.confirmed as boolean;
    data.updatedAt = new Date().toISOString(); data.results = calculateProjectScreening(data);
    await tx.update(applicationsTable).set({ screeningData: JSON.stringify(data) }).where(eq(applicationsTable.id, id));
    return data;
  });
  if (!outcome) { res.status(outcome === false ? 400 : 409).json({ error: outcome === false ? "Only verified evidence from readable, non-duplicate files can be confirmed." : "Finish screening before confirming evidence." }); return; }
  res.json(outcome);
});
router.post("/demo/reset", async (_req, res): Promise<void> => {
  const demoRows = await db.select({ id: applicationsTable.id }).from(applicationsTable).where(eq(applicationsTable.isDemo, true));
  const ids = demoRows.map(row => row.id);
  if (ids.length) {
    await db.transaction(async tx => {
      await tx.delete(evidenceRequestsTable).where(inArray(evidenceRequestsTable.applicationId, ids));
      await tx.delete(applicationFilesTable).where(inArray(applicationFilesTable.applicationId, ids));
      await tx.delete(applicationsTable).where(inArray(applicationsTable.id, ids));
    });
  }
  resetVerification();
  await db.update(applicationsTable).set({ status: "Approved" }).where(eq(applicationsTable.id, approvedCaseId));
  res.json({ removed: ids.length });
});
router.get("/source-evidence/:sourceId/:passageIndex", async (req, res): Promise<void> => {
  const sourceId = param(req.params.sourceId);
  const passageIndex = Number(param(req.params.passageIndex));
  if (!sourceId || !Number.isInteger(passageIndex) || passageIndex < 0 ||
      !Object.values(sourceRegister).some(source => source.id === sourceId)) {
    res.status(404).json({ error: "Evidence snippet unavailable." }); return;
  }
  res.json(await getSourceEvidence(sourceId, passageIndex));
});
router.get("/source-evidence/:sourceId/:passageIndex/image", async (req, res): Promise<void> => {
  const sourceId = param(req.params.sourceId);
  const passageIndex = Number(param(req.params.passageIndex));
  if (!sourceId || !Number.isInteger(passageIndex) || passageIndex < 0) {
    res.status(404).json({ error: "Evidence page image unavailable." }); return;
  }
  await streamSourceEvidenceImage(sourceId, passageIndex, res);
});
router.get("/files/:fileId/original", async (req, res): Promise<void> => {
  await ready();
  const [row] = await db.select().from(applicationFilesTable).where(eq(applicationFilesTable.id, param(req.params.fileId) || ""));
  if (!row) { res.status(404).json({ error: "File not found" }); return; }
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${row.name.replace(/["\r\n]/g, "_")}"`);
  res.setHeader("Cache-Control", "private, no-store");
  if (row.applicationId === referenceId) {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    for (let pageIndex = 0; pageIndex < row.pages; pageIndex++) {
      const page = pdf.addPage([595, 842]);
      page.drawRectangle({ x: 0, y: 803, width: 595, height: 39, color: rgb(0.09, 0.25, 0.20) });
      page.drawText("SYNTHETIC DEMO DOCUMENT - not a real record", { x: 35, y: 818, size: 11, font: bold, color: rgb(1, 1, 1) });
      page.drawText(row.name.replace(/[^\x20-\x7e]/g, "-"), { x: 35, y: 765, size: 17, font: bold, color: rgb(0.09, 0.25, 0.20) });
      const words = row.extractedText.replace(/[^\x20-\x7e]/g, "-").split(/\s+/);
      let line = ""; let y = 718;
      for (const word of words) {
        if ((line + word).length > 83) { page.drawText(line, { x: 35, y, size: 11, font }); y -= 19; line = ""; }
        line += word + " ";
      }
      if (line) page.drawText(line, { x: 35, y, size: 11, font });
      page.drawText(`${syntheticStamp.replace(/[^\x20-\x7e]/g, "-")}  |  Page ${pageIndex + 1} of ${row.pages}`, { x: 35, y: 32, size: 9, font });
    }
    res.send(Buffer.from(await pdf.save())); return;
  }
  const object = await storage.getObjectEntityFile(row.objectPath);
  object.createReadStream().on("error", error => { req.log.error({ error }, "PDF read failed"); res.destroy(error); }).pipe(res);
});
router.get("/applications/:id/:document", async (req, res, next): Promise<void> => {
  const id = param(req.params.id);
  const document = param(req.params.document);
  if (document !== "memo.pdf" && document !== "request-list.pdf") { next(); return; }
  await ready();
  const [application] = await db.select().from(applicationsTable).where(eq(applicationsTable.id, id || ""));
  const project = application ? parseProjectScreening(application.screeningData) : null;
  if (!application || (!application.isDemo && application.id !== referenceId && project?.status !== "complete")) {
    res.status(404).json({ error: "Finish screening before downloading the project report." }); return;
  }
  const inputs = application.screeningData
    ? (JSON.parse(application.screeningData) as { inputs: ReferenceInputs }).inputs
    : undefined;
  const bytes = project ? await makeProjectPDF(project, application.title, document === "request-list.pdf") : await makeReferencePDF(document === "memo.pdf" ? "memo" : "requests", inputs);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="Tahaqqaq_${document}"`);
  res.setHeader("Cache-Control", "private, no-store");
  res.send(bytes);
});
router.get("/applications/:id/requests", async (req, res): Promise<void> => {
  const parsed = ListEvidenceRequestsParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: "Invalid application ID" }); return; }
  const rows = await db.select().from(evidenceRequestsTable).where(eq(evidenceRequestsTable.applicationId, parsed.data.id)).orderBy(desc(evidenceRequestsTable.createdAt));
  res.json(ListEvidenceRequestsResponse.parse(rows.map(row => ({ ...row, createdAt: row.createdAt.toISOString() }))));
});
router.post("/applications/:id/requests", async (req, res): Promise<void> => {
  const params = RecordEvidenceRequestParams.safeParse(req.params);
  const body = RecordEvidenceRequestBody.safeParse(req.body);
  if (!params.success || !body.success || !body.data.reviewer.trim() || !body.data.reason.trim()) {
    res.status(400).json({ error: "Reviewer name and reason are required." }); return;
  }
  const [application] = await db.select().from(applicationsTable).where(eq(applicationsTable.id, params.data.id));
  if (!application || !application.isReference && parseProjectScreening(application.screeningData)?.status !== "complete") { res.status(404).json({ error: "Finish screening before recording an evidence request." }); return; }
  const [row] = await db.insert(evidenceRequestsTable).values({
    id: randomUUID(), applicationId: application.id, reviewer: body.data.reviewer.trim(),
    reason: body.data.reason.trim(),
  }).returning();
  res.status(201).json(RecordEvidenceRequestResponse.parse({ ...row, createdAt: row.createdAt.toISOString() }));
});
export default router;
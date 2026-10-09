// Tahaqqaq local preview: serves the built app and answers the API from saved demo data.
// No database, no installs. Run: node server.mjs   then open http://localhost:3000
// The installer phone needs the camera, so the same app is also served on https://<laptop-ip>:3443 (self-signed).
import http from "node:http";
import https from "node:https";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { verificationApi, resetVerification, siteOrigin, approvedCaseId } from "./verification.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const appDir = join(here, "app");
const dataDir = join(here, "data");
const json = (name) => JSON.parse(readFileSync(join(dataDir, name), "utf8"));

const reference = json("reference.json");
const demoScreening = json("demo-screening.json");
const emptyResults = json("empty-results.json");
const approvedCase = { id: approvedCaseId, university: "Amman Private Hospital (synthetic)", institutionType: "Hospital", title: "Solar and LED upgrade",
  description: "Rooftop solar PV (250 kW) and LED lighting. Evidence confirmed and scope approved by the bank; ready for on-site verification. Synthetic case.",
  location: "Amman", status: "Approved", isReference: false, isDemo: false, screeningData: null, createdAt: "2026-10-01T09:00:00.000Z", files: [] };
let applications = [reference, approvedCase];
const requests = new Map();
const screenings = new Map();

const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json", ".pdf": "application/pdf", ".txt": "text/plain", ".woff2": "font/woff2", ".png": "image/png" };
const send = (res, status, body, type = "application/json") => {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(type === "application/json" ? JSON.stringify(body) : body);
};
const readBody = (req) => new Promise((resolve) => {
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString() || "{}")); } catch { resolve({}); } });
});
const pdf = (res, file, name) => {
  res.writeHead(200, { "Content-Type": "application/pdf", "Content-Disposition": `${name ? "attachment" : "inline"}; filename="${name || "document.pdf"}"` });
  res.end(readFileSync(file));
};
const find = (id) => applications.find((a) => a.id === id);

async function api(req, res, path) {
  const m = req.method;
  let p;
  if (path === "/api/healthz") return send(res, 200, { status: "ok" });
  if (path === "/api/applications" && m === "GET") return send(res, 200, [...applications].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)));
  if (path === "/api/uploads/request-url" && m === "POST") { const id = randomUUID(); return send(res, 200, { uploadURL: `/__upload/${id}`, objectPath: `/objects/uploads/${id}` }); }
  if (path === "/api/applications" && m === "POST") {
    const body = await readBody(req);
    const files = body.files || [];
    const names = new Set(reference.files.map((f) => f.name));
    const isDemo = files.length === reference.files.length && files.every((f) => names.has(f.name));
    const app = isDemo
      ? { ...reference, id: randomUUID(), university: body.university, institutionType: body.institutionType || null, title: body.title, description: body.description, location: "", status: "New", isReference: true, isDemo: true, screeningData: demoScreening, createdAt: new Date().toISOString() }
      : { id: randomUUID(), university: body.university, institutionType: body.institutionType || null, title: body.title, description: body.description, location: "", status: "Pending", isReference: false, isDemo: false, screeningData: null, createdAt: new Date().toISOString(),
          files: files.map((f) => ({ id: randomUUID(), name: f.name, size: f.size, url: "", category: "received", pages: 1, quality: "Received · awaiting screening", text: "Original PDF received. No case-specific extraction or screening has been performed yet." })) };
    applications.push(app);
    return send(res, 201, app);
  }
  if ((p = path.match(/^\/api\/applications\/([^/]+)\/complete-screening$/)) && m === "POST") {
    const app = find(decodeURIComponent(p[1]));
    if (!app?.isDemo) return send(res, 404, { error: "This endpoint is only available for the synthetic demo submission." });
    app.status = "Evidence requested";
    return send(res, 200, app);
  }
  if ((p = path.match(/^\/api\/applications\/([^/]+)\/screening$/))) {
    const id = decodeURIComponent(p[1]);
    return send(res, 200, screenings.get(id) || { kind: "project", version: 1, applicationId: id, status: "pending", startedAt: null, completedAt: null, updatedAt: new Date().toISOString(), model: "claude-opus-5", error: null, files: [], suggestions: [], requirementMatches: [], results: emptyResults });
  }
  if ((p = path.match(/^\/api\/applications\/([^/]+)\/screen$/)) && m === "POST") return send(res, 503, { error: "AI screening of new uploads is switched off in this local preview. Use Load demo files to see the full flow." });
  if ((p = path.match(/^\/api\/applications\/([^/]+)\/(memo|request-list)\.pdf$/))) {
    const app = find(decodeURIComponent(p[1]));
    if (!app?.isReference) return send(res, 404, { error: "Finish screening before downloading the project report." });
    return pdf(res, join(dataDir, `${p[2]}.pdf`), `Tahaqqaq_${p[2]}.pdf`);
  }
  if ((p = path.match(/^\/api\/applications\/([^/]+)\/requests$/))) {
    const id = decodeURIComponent(p[1]);
    const list = requests.get(id) || [];
    if (m === "GET") return send(res, 200, list);
    const body = await readBody(req);
    if (!body.reviewer?.trim() || !body.reason?.trim()) return send(res, 400, { error: "Reviewer name and reason are required." });
    const row = { id: randomUUID(), applicationId: id, reviewer: body.reviewer.trim(), reason: body.reason.trim(), createdAt: new Date().toISOString() };
    requests.set(id, [row, ...list]);
    return send(res, 201, row);
  }
  if ((p = path.match(/^\/api\/applications\/([^/]+)$/))) {
    const app = find(decodeURIComponent(p[1]));
    return app ? send(res, 200, app) : send(res, 404, { error: "Application not found" });
  }
  if ((p = path.match(/^\/api\/files\/([^/]+)\/original$/))) {
    const file = join(dataDir, "files", `${decodeURIComponent(p[1]).replace(/[^\w-]/g, "")}.pdf`);
    return existsSync(file) ? pdf(res, file) : send(res, 404, { error: "Original files are not stored in this local preview." });
  }
  if (/^\/api\/(verification|site)(\/|$)|\/approve-scope$/.test(path)) {
    const reply = await verificationApi(m, path.slice(4), m === "POST" ? await readBody(req) : {}, {
      getApp: async (id) => find(id),
      setStatus: async (id, status) => { const app = find(id); if (app) app.status = status; },
      siteOrigin: siteOrigin("localhost", "https", httpsPort),
    });
    if (reply?.pdf) { res.writeHead(200, { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${reply.pdf.name}"` }); return res.end(Buffer.from(reply.pdf.bytes)); }
    if (reply) return send(res, reply.status, reply.json);
  }
  if (path.startsWith("/api/source-evidence/")) return send(res, 200, { status: "unavailable", matched: false });
  if (path === "/api/demo/reset" && m === "POST") {
    const removed = applications.filter((a) => a.isDemo).length;
    applications = applications.filter((a) => !a.isDemo);
    resetVerification();
    approvedCase.status = "Approved";
    return send(res, 200, { removed });
  }
  return send(res, 404, { error: "Not found" });
}

const handler = async (req, res) => {
  const path = decodeURI(new URL(req.url, "http://localhost").pathname);
  try {
    if (path.startsWith("/__upload/")) { req.resume(); req.on("end", () => send(res, 200, "", "text/plain")); return; }
    if (path.startsWith("/api/")) return await api(req, res, path);
    const file = join(appDir, path);
    if (file.startsWith(appDir) && existsSync(file) && statSync(file).isFile()) return send(res, 200, readFileSync(file), types[extname(file)] || "application/octet-stream");
    return send(res, 200, readFileSync(join(appDir, "index.html")), types[".html"]);
  } catch (error) {
    send(res, 500, { error: String(error) });
  }
};

const port = Number(process.env.PORT) || 3000;
const httpsPort = Number(process.env.HTTPS_PORT) || 3443;
http.createServer(handler).listen(port, () => console.log(`Tahaqqaq preview running: http://localhost:${port}  (Ctrl+C to stop)`));
https.createServer({ key: readFileSync(join(here, "key.pem")), cert: readFileSync(join(here, "cert.pem")) }, handler)
  .listen(httpsPort, () => console.log(`Installer phone link: ${siteOrigin("localhost", "https", httpsPort)}/site  (same Wi-Fi; accept the certificate warning once)`));

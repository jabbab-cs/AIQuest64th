// Phase 2: on-site verification of an approved scope. State lives in memory and is
// seeded from three JSON files; Reset demo reloads them. Scan results are scripted.
import { networkInterfaces } from "node:os";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import scope from "../../data/phase2/approved_scope.json";
import script from "../../data/phase2/scan_script.json";
import initial from "../../data/phase2/demo_state.json";

type Tone = "green" | "amber" | "red";
type Step = { item: string; image?: string; tone: Tone; title: string; titleAr: string; detail: string; detailAr: string; bank: string; serial?: string };
type Logged = Step & { n: number; at: string; scanned?: string; replaces?: string };
type Item = { id: string; label: string; labelAr: string; count?: number; before?: string; note?: string; noteAr?: string };
type Stage = "idle" | "approved" | "verifying" | "paid";
type State = {
  applicationId: string | null; stage: Stage; approvedAt: string | null; openedAt: string | null;
  delivery: Logged[]; switchOn: Logged[]; payments: { "1": string | null; "2": string | null };
};
export type AppInfo = { id: string; university: string; title: string; status: string; isDemo: boolean };
export type Ctx = {
  getApp(id: string): Promise<AppInfo | undefined>;
  setStatus(id: string, status: "Approved" | "Verifying" | "Paid"): Promise<void>;
  siteOrigin: string;
};
export type Reply = { status: number; json?: unknown; pdf?: { bytes: Uint8Array; name: string } };

const delivery = script.delivery as Step[];
const switchOn = script.switchOn as Step[];
let state: State = structuredClone(initial) as State;
export const approvedCaseId = initial.applicationId as string;
export function resetVerification() { state = structuredClone(initial) as State; }

// Progress counts unique items from the approved scope, not scans: a retake or a replacement fills the
// same item. An item is verified by its latest result being green; red or amber keeps it open and blocks payment.
const checklist = scope.checklist as { delivery: Item[]; switchOn: Item[] };
function progress(items: Item[], results: Logged[]) {
  const rows = items.map(item => {
    const latest = results.filter(r => r.item === item.id).at(-1);
    const status = item.before ? "verified" : !latest ? "waiting" : latest.tone === "green" ? "verified" : latest.tone === "red" ? "blocked" : "check";
    return { ...item, count: item.count ?? 1, status, latest: latest?.n ?? null };
  });
  const sum = (list: typeof rows) => list.reduce((n, r) => n + r.count, 0);
  const verified = sum(rows.filter(r => r.status === "verified")), total = sum(rows);
  return { items: rows, results, verified, total, open: rows.filter(r => r.status === "blocked" || r.status === "check").length, done: verified === total };
}
const deliveryDone = () => progress(checklist.delivery, state.delivery).done;
const switchOnDone = () => progress(checklist.switchOn, state.switchOn).done;
const norm = (code: unknown) => typeof code === "string" ? code.trim().toUpperCase().replace(/\s+/g, "") : "";
const now = () => new Date().toISOString();

function view(app: AppInfo | undefined, siteOrigin: string) {
  return {
    code: scope.code,
    siteUrl: `${siteOrigin}/site?code=${scope.code}`,
    stage: state.stage,
    applicationId: state.applicationId,
    institution: app?.university ?? null,
    title: app?.title ?? null,
    approvedAt: state.approvedAt, openedAt: state.openedAt,
    scope: { confirmed: scope.confirmed, items: scope.items, approvedTotal: scope.approvedTotal, loanAmount: scope.loanAmount, payments: scope.payments, equipment: scope.equipment, currency: scope.currency, systemKw: scope.systemKw },
    delivery: progress(checklist.delivery, state.delivery),
    switchOn: progress(checklist.switchOn, state.switchOn),
    payments: state.payments,
    can: {
      release1: deliveryDone() && !state.payments["1"],
      release2: !!state.payments["1"] && switchOnDone() && !state.payments["2"],
      certificate: state.stage === "paid",
    },
  };
}

// Phone side gets only what the installer needs: no amounts, no bank notes.
function siteView(app: AppInfo | undefined) {
  const strip = ({ bank: _bank, ...rest }: Logged) => rest;
  return {
    code: scope.code, institution: app?.university ?? null, title: app?.title ?? null,
    equipment: scope.equipment, systemKw: scope.systemKw,
    step: !deliveryDone() ? "delivery" : !state.payments["1"] ? "waiting" : !switchOnDone() ? "switchOn" : "done",
    delivery: { ...progress(checklist.delivery, state.delivery), results: state.delivery.map(strip) },
    switchOn: { ...progress(checklist.switchOn, state.switchOn), results: state.switchOn.map(strip) },
  };
}

async function openCode(code: unknown, ctx: Ctx): Promise<Reply | AppInfo> {
  if (norm(code) !== scope.code || !state.applicationId) return { status: 404, json: { error: "Code not found. Check the code and try again.", errorAr: "الرمز غير موجود. تحقق منه وحاول مجدداً." } };
  if (state.stage === "paid") return { status: 410, json: { error: "This code has expired. The project is paid.", errorAr: "انتهت صلاحية هذا الرمز. تم الدفع للمشروع." } };
  const app = await ctx.getApp(state.applicationId);
  if (!app) return { status: 404, json: { error: "Code not found. Check the code and try again.", errorAr: "الرمز غير موجود. تحقق منه وحاول مجدداً." } };
  return app;
}
const isReply = (x: Reply | AppInfo): x is Reply => "status" in x && typeof x.status === "number";

export async function verificationApi(method: string, path: string, body: Record<string, unknown>, ctx: Ctx): Promise<Reply | null> {
  let m: RegExpMatchArray | null;

  if ((m = path.match(/^\/applications\/([^/]+)\/approve-scope$/)) && method === "POST") {
    const app = await ctx.getApp(decodeURIComponent(m[1]));
    if (!app?.isDemo) return { status: 404, json: { error: "Only the screened demo submission can be approved in this prototype." } };
    if (state.applicationId === app.id && state.stage !== "idle") return { status: 200, json: view(app, ctx.siteOrigin) };
    if (app.status !== "Evidence requested") return { status: 409, json: { error: "Finish screening before approving the scope." } };
    resetVerification();
    Object.assign(state, { applicationId: app.id, stage: "approved", approvedAt: now() });
    await ctx.setStatus(app.id, "Approved");
    return { status: 200, json: view({ ...app, status: "Approved" }, ctx.siteOrigin) };
  }

  if (path === "/verification" && method === "GET") {
    if (!state.applicationId) return { status: 200, json: null };
    return { status: 200, json: view(await ctx.getApp(state.applicationId), ctx.siteOrigin) };
  }

  if ((m = path.match(/^\/verification\/([^/]+)\/release$/)) && method === "POST") {
    const id = decodeURIComponent(m[1]);
    if (id !== state.applicationId) return { status: 404, json: { error: "No verification for this project." } };
    const stage = Number(body.stage);
    if (stage === 1 && !state.payments["1"]) {
      if (!deliveryDone()) return { status: 409, json: { error: "Delivery is not complete yet." } };
      state.payments["1"] = now();
    } else if (stage === 2 && !state.payments["2"]) {
      if (!state.payments["1"] || !switchOnDone()) return { status: 409, json: { error: "Switch-on is not complete yet." } };
      state.payments["2"] = now(); state.stage = "paid";
      await ctx.setStatus(id, "Paid");
    } else if (stage !== 1 && stage !== 2) return { status: 400, json: { error: "Choose payment 1 or 2." } };
    return { status: 200, json: view(await ctx.getApp(id), ctx.siteOrigin) };
  }

  if ((m = path.match(/^\/verification\/([^/]+)\/certificate\.pdf$/)) && method === "GET") {
    const id = decodeURIComponent(m[1]);
    if (id !== state.applicationId || state.stage !== "paid") return { status: 404, json: { error: "The certificate is ready once both payments are released." } };
    return { status: 200, pdf: { bytes: await certificate(await ctx.getApp(id)), name: `Tahaqqaq_certificate_${scope.code}.pdf` } };
  }

  if (path === "/site/open" && method === "POST" || (m = path.match(/^\/site\/([^/]+)$/)) && method === "GET") {
    const opened = await openCode(m ? decodeURIComponent(m[1]) : body.code, ctx);
    if (isReply(opened)) return opened;
    if (state.stage === "approved") {
      Object.assign(state, { stage: "verifying", openedAt: now() });
      await ctx.setStatus(opened.id, "Verifying");
    }
    return { status: 200, json: siteView(opened) };
  }

  if ((path === "/site/scan" || path === "/site/photo") && method === "POST") {
    const opened = await openCode(body.code, ctx);
    if (isReply(opened)) return opened;
    const photo = path === "/site/photo";
    if (photo && !state.payments["1"]) return { status: 409, json: { error: "Wait for the bank to release payment 1.", errorAr: "انتظر حتى يصرف البنك الدفعة الأولى." } };
    const list = photo ? state.switchOn : state.delivery;
    const steps = photo ? switchOn : delivery;
    const next = steps[list.length];
    // A green result on an item that was red or amber is the replacement or retake for it.
    const earlier = next && list.filter(r => r.item === next.item).at(-1);
    const replaces = next?.tone === "green" && earlier && earlier.tone !== "green" ? (earlier.serial ?? `#${earlier.n}`) : undefined;
    if (next) list.push({ ...next, n: list.length + 1, at: now(), replaces, scanned: typeof body.value === "string" ? body.value.slice(0, 80) : undefined });
    return { status: 200, json: { result: next ? list[list.length - 1] : null, allChecked: !next, site: siteView(opened) } };
  }
  return null;
}

const money = (n: number) => `JOD ${n.toLocaleString("en-US")}`;
const ascii = (s: string) => s.replace(/[^\x20-\x7e]/g, "-");
const stamp = (iso: string | null) => iso ? new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Amman" }) : "";

async function certificate(app: AppInfo | undefined) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const green = rgb(0.075, 0.29, 0.22);
  let y = 760;
  const text = (s: string, o: { size?: number; b?: boolean; x?: number; color?: ReturnType<typeof rgb> } = {}) => {
    page.drawText(ascii(s), { x: o.x ?? 50, y, size: o.size ?? 10.5, font: o.b ? bold : font, color: o.color ?? rgb(0.1, 0.12, 0.11) });
  };
  const row = (label: string, value: string) => { text(label, { color: rgb(0.4, 0.42, 0.4) }); text(value, { x: 230, b: true }); y -= 18; };

  page.drawRectangle({ x: 0, y: 803, width: 595, height: 39, color: green });
  page.drawText("SYNTHETIC DEMO - not a real certificate", { x: 50, y: 818, size: 10, font: bold, color: rgb(1, 1, 1) });
  text("Tahaqqaq", { size: 12, b: true, color: green }); y -= 34;
  text("Verification certificate", { size: 24, b: true }); y -= 22;
  text("The approved scope was delivered and switched on, and both payments were released.", { color: rgb(0.3, 0.32, 0.3) }); y -= 36;

  row("Institution", app?.university ?? "");
  row("Project", app?.title ?? "");
  row("Project code", scope.code);
  row("Approved scope", money(scope.approvedTotal));
  for (const item of scope.items) row(`  ${item.name}`, money(item.amount));
  row("Loan released", money(scope.loanAmount));
  y -= 14;

  text("Payments", { size: 13, b: true }); y -= 20;
  for (const p of scope.payments) row(p.label, `${money(p.amount)}  -  ${stamp(state.payments[String(p.stage) as "1" | "2"])}`);
  y -= 14;

  text("Delivery checks", { size: 13, b: true }); y -= 20;
  for (const i of checklist.delivery.filter(i => i.before)) { text(`-  VERIFIED  ${i.label}. ${i.note ?? ""}`, { size: 9.5 }); y -= 15; }
  for (const r of state.delivery) { text(`${r.n}. ${r.tone.toUpperCase()}  ${r.serial ?? ""}  ${r.bank}`, { size: 9.5 }); y -= 15; }
  y -= 14;
  text("Switch-on checks", { size: 13, b: true }); y -= 20;
  for (const r of state.switchOn) { text(`${r.n}. ${r.tone.toUpperCase()}  ${r.bank}`, { size: 9.5 }); y -= 15; }

  page.drawLine({ start: { x: 50, y: 90 }, end: { x: 545, y: 90 }, thickness: 0.5, color: rgb(0.8, 0.8, 0.78) });
  page.drawText(ascii(`Issued ${stamp(state.payments["2"])} (Amman). AI reads, rules decide, the bank approves.`), { x: 50, y: 72, size: 9, font, color: rgb(0.4, 0.42, 0.4) });
  page.drawText("Synthetic data for the AI Quest 2026 prototype. Scan results are scripted.", { x: 50, y: 58, size: 9, font, color: rgb(0.4, 0.42, 0.4) });
  return pdf.save();
}

// The QR must open on the installer's phone, so a localhost origin is swapped for this machine's LAN address.
export function siteOrigin(host: string | undefined, proto: string, lanPort?: number) {
  const name = (host ?? "localhost").split(":")[0];
  if (!/^(localhost|127\.0\.0\.1|\[::1\])$/.test(name)) return `${proto}://${host}`;
  // Windows lists virtual adapters (WSL, Hyper-V) too; home and hotspot Wi-Fi is usually 192.168.x or 10.x. SITE_HOST overrides.
  const rank = (ip: string) => ip.startsWith("192.168.") ? 0 : ip.startsWith("10.") ? 1 : 2;
  const lan = process.env.SITE_HOST ?? Object.values(networkInterfaces()).flat()
    .filter(i => i && i.family === "IPv4" && !i.internal).map(i => i!.address).sort((x, y) => rank(x) - rank(y))[0];
  const port = lanPort ?? (host?.split(":")[1] || "");
  return lan ? `${proto}://${lan}${port ? `:${port}` : ""}` : `${proto}://${host}`;
}

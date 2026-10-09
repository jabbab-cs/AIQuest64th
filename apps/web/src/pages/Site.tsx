import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleCheck, Clock, Loader2, OctagonX, TriangleAlert } from "lucide-react";
import { BrandMark } from "@/components/layout/Shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Viewfinder, grabFrame, useCamera, type CameraState } from "@/components/site/Camera";
import { cn } from "@/lib/utils";

type Lang = "ar" | "en";
type Tone = "green" | "amber" | "red";
type Step = { n: number; item: string; image?: string; tone: Tone; title: string; titleAr: string; detail: string; detailAr: string; serial?: string; replaces?: string };
type Item = { id: string; label: string; labelAr: string; count: number; before?: string; status: "verified" | "blocked" | "check" | "waiting" };
type Progress = { items: Item[]; results: Step[]; verified: number; total: number; open: number };
type SiteView = {
  code: string; institution: string | null; title: string | null; systemKw: number;
  step: "delivery" | "waiting" | "switchOn" | "done";
  delivery: Progress; switchOn: Progress;
};
type PostReply = { result: Step | null; allChecked: boolean; site: SiteView };
type ApiError = Error & { status?: number; errorAr?: string };

const copy = {
  en: {
    brand: "Tahaqqaq", switchTo: "العربية", switchLabel: "Switch to Arabic",
    entryTitle: "Open your project", entryLead: "Type the project code the bank gave you.",
    codeLabel: "Project code", open: "Open project", opening: "Opening…", codeShort: "Code",
    deliveryTitle: "Delivery check",
    verified: (n: number, t: number, open: number) => `${n} of ${t} items verified${open ? ` · ${open} to fix` : ""}`,
    next: "Next", retakeNow: "Retake now", later: "At the end", rescan: "Rescan", replace: "replacement panel", retake: "retake",
    autoHint: "Point the camera at the label. It scans by itself.",
    manualHint: "Point the camera at the label, then tap Scan.",
    scan: "Scan", checking: "Checking…", readingLabel: "Reading label…",
    replaces: "Replaces", retakeOf: "Retake accepted.",
    tone: { green: "Matched", amber: "Check", red: "Stop" },
    serial: "Serial", earlier: "Earlier results",
    waitingTitle: "Delivery complete.", waitingBody: "Waiting for the bank to release payment 1.",
    keepOpen: "This page moves on by itself. Keep it open.",
    switchTitle: "Switch-on check",
    photograph: "Photograph", takePhoto: "Take photo", reading: "Reading…",
    doneTitle: "Switch-on complete.", doneBody: "The bank will release payment 2.",
    expiredTitle: "This project is paid.", expiredBody: "The code has expired.", another: "Enter another code",
    camStarting: "Starting camera…",
    camInsecure: "The camera needs a secure (https) link. Ask the bank team for the https link.",
    camDenied: "Camera access is blocked. Tap the lock icon next to the web address, allow Camera, then reload this page.",
    camMissing: "No camera found on this phone.",
    fallbackScan: "Next scan (demo fallback)", fallbackPhoto: "Next photo (demo fallback)",
    failed: "Something went wrong. Try again.",
  },
  ar: {
    brand: "تحقّق", switchTo: "English", switchLabel: "Switch to English",
    entryTitle: "افتح مشروعك", entryLead: "اكتب رمز المشروع الذي أعطاك إياه البنك.",
    codeLabel: "رمز المشروع", open: "افتح المشروع", opening: "جارٍ الفتح…", codeShort: "الرمز",
    deliveryTitle: "فحص التسليم",
    verified: (n: number, t: number, open: number) => `تم التحقق من ${n} من ${t}${open ? ` · ${open} بحاجة لإصلاح` : ""}`,
    next: "التالي", retakeNow: "أعد التصوير الآن", later: "في النهاية", rescan: "أعد المسح", replace: "اللوح البديل", retake: "إعادة التصوير",
    autoHint: "وجّه الكاميرا نحو الملصق. يتم المسح تلقائياً.",
    manualHint: "وجّه الكاميرا نحو الملصق ثم اضغط «امسح».",
    scan: "امسح", checking: "جارٍ الفحص…", readingLabel: "جارٍ قراءة الملصق…",
    replaces: "بديل عن", retakeOf: "تم قبول الصورة الجديدة.",
    tone: { green: "مطابق", amber: "تحقّق", red: "توقّف" },
    serial: "الرقم التسلسلي", earlier: "النتائج السابقة",
    waitingTitle: "اكتمل التسليم.", waitingBody: "بانتظار أن يصرف البنك الدفعة الأولى.",
    keepOpen: "ستنتقل الصفحة تلقائياً. أبقِها مفتوحة.",
    switchTitle: "فحص التشغيل",
    photograph: "صوّر", takePhoto: "التقط صورة", reading: "جارٍ القراءة…",
    doneTitle: "اكتمل التشغيل.", doneBody: "سيصرف البنك الدفعة الثانية.",
    expiredTitle: "تم الدفع لهذا المشروع.", expiredBody: "انتهت صلاحية الرمز.", another: "أدخل رمزاً آخر",
    camStarting: "جارٍ تشغيل الكاميرا…",
    camInsecure: "تحتاج الكاميرا إلى رابط آمن (https). اطلب رابط https من فريق البنك.",
    camDenied: "الكاميرا محظورة. اضغط على رمز القفل بجانب عنوان الموقع، واسمح بالكاميرا، ثم أعد تحميل الصفحة.",
    camMissing: "لا توجد كاميرا على هذا الهاتف.",
    fallbackScan: "المسح التالي (بديل العرض)", fallbackPhoto: "الصورة التالية (بديل العرض)",
    failed: "حدث خطأ. حاول مجدداً.",
  },
};
type Copy = (typeof copy)["en"];

async function api<T>(path: string, body?: object): Promise<T> {
  const res = await fetch(`/api${path}`, body
    ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    : undefined);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(json.error ?? res.statusText), { status: res.status, errorAr: json.errorAr }) as ApiError;
  return json as T;
}

const errorText = (e: unknown, lang: Lang, t: Copy) => {
  const err = e as ApiError | null;
  if (!err) return null;
  if (!err.status) return t.failed;
  return (lang === "ar" ? err.errorAr : err.message) || t.failed;
};

// --- feedback: short beep + vibration, never the only signal ---
let audio: AudioContext | null = null;
function unlockAudio() {
  try { audio ??= new AudioContext(); void audio.resume(); } catch { /* no audio on this device */ }
}
function signal(tone: Tone) {
  navigator.vibrate?.(tone === "green" ? [60] : tone === "amber" ? [80, 60, 80] : [200, 80, 200]);
  try {
    unlockAudio();
    if (!audio) return;
    const beeps = tone === "green" ? [[1046, 0]] : [[tone === "amber" ? 440 : 300, 0], [tone === "amber" ? 440 : 300, 0.2]];
    for (const [freq, offset] of beeps) {
      const at = audio.currentTime + offset;
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.3, at + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.14);
      osc.connect(gain).connect(audio.destination);
      osc.start(at);
      osc.stop(at + 0.15);
    }
  } catch { /* ignore */ }
}

// --- barcode detection where the browser has it (Android Chrome); iPhone Safari gets the Scan button ---
type Detector = { detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]> };
type DetectorCtor = { new (): Detector; getSupportedFormats(): Promise<string[]> };
function useBarcodeDetector() {
  const [detector, setDetector] = useState<Detector | null | undefined>(undefined);
  useEffect(() => {
    const Ctor = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
    if (!Ctor) { setDetector(null); return; }
    Ctor.getSupportedFormats()
      .then((formats) => setDetector(formats.length ? new Ctor() : null))
      .catch(() => setDetector(null));
  }, []);
  return detector; // undefined while checking
}

const toneStyle: Record<Tone, { box: string; bar: string; Icon: typeof CircleCheck }> = {
  green: { box: "border-success-foreground/25 bg-success text-success-foreground", bar: "bg-success-foreground", Icon: CircleCheck },
  amber: { box: "border-warning-foreground/25 bg-warning text-warning-foreground", bar: "bg-warning-foreground", Icon: TriangleAlert },
  red: { box: "border-destructive-foreground/25 bg-destructive text-destructive-foreground", bar: "bg-destructive-foreground", Icon: OctagonX },
};

// API titles often start with the tone word ("Stop. Already financed"); drop it since the panel shows the word already.
const bare = (s: string) => s.replace(/[\u064B-\u0652.]/g, "").trim().toLowerCase();
function headline(title: string, word: string) {
  const [head, ...rest] = title.split(". ");
  if (bare(title) === bare(word)) return null;
  return rest.length && bare(head) === bare(word) ? rest.join(". ") : title;
}

const itemName = (items: Item[], id: string, lang: Lang) => { const i = items.find((x) => x.id === id); return i ? (lang === "ar" ? i.labelAr : i.label) : id; };

function ResultPanel({ step, items, lang, t }: { step: Step; items: Item[]; lang: Lang; t: Copy }) {
  const { box, Icon } = toneStyle[step.tone];
  const title = headline(lang === "ar" ? step.titleAr : step.title, t.tone[step.tone]);
  return (
    <div className={cn("rounded-lg border p-4", box)}>
      <div className="flex items-center gap-2.5">
        <Icon className="h-7 w-7 shrink-0" aria-hidden="true" />
        <span className="text-xl font-semibold">{t.tone[step.tone]}</span>
        <span className="ms-auto text-sm font-medium text-foreground/70">{itemName(items, step.item, lang)}</span>
      </div>
      {title && <p className="mt-2 text-[17px] font-semibold leading-snug text-foreground">{title}</p>}
      <p className="mt-1 text-[15px] leading-relaxed text-foreground/80">{lang === "ar" ? step.detailAr : step.detail}</p>
      {step.serial && (
        <p className="mt-2 text-[13px] text-foreground/70">
          {t.serial}: <span dir="ltr" className="font-mono text-foreground">{step.serial}</span>
        </p>
      )}
      {step.replaces && (
        <p className="mt-2 text-[13px] font-medium text-foreground/80">
          {step.replaces.startsWith("#") ? t.retakeOf : <>{t.replaces} <bdi className="font-mono">{step.replaces}</bdi></>}
        </p>
      )}
    </div>
  );
}

function EarlierList({ steps, items, lang, t }: { steps: Step[]; items: Item[]; lang: Lang; t: Copy }) {
  if (!steps.length) return null;
  return (
    <section aria-label={t.earlier}>
      <h3 className="mb-2 text-[13px] font-medium text-muted-foreground">{t.earlier}</h3>
      <ul className="divide-y rounded-lg border border-card-border bg-card">
        {[...steps].reverse().map((s) => {
          const { Icon, box } = toneStyle[s.tone];
          return (
            <li key={s.n} className="flex items-start gap-3 px-3 py-2.5">
              <span className={cn("mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium", box)}>
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />{t.tone[s.tone]}
              </span>
              <span className="min-w-0 flex-1 text-sm leading-snug">
                <span className="font-medium">{itemName(items, s.item, lang)}</span>
                {(() => { const h = headline(lang === "ar" ? s.titleAr : s.title, t.tone[s.tone]); return h && ` · ${h}`; })()}
                {s.serial && <span dir="ltr" className="mt-0.5 block truncate font-mono text-xs text-muted-foreground">{s.serial}</span>}
              </span>
              <span className="shrink-0 font-mono text-xs text-muted-foreground">{s.n}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// Progress as a queue, filled in the order things happen: items verified before today, then one segment per
// scan in its result colour, then one empty segment per item still needed. A failed scan leaves its item
// still needed, so the queue grows by one at the end; nothing hints at a failure before it happens.
// A 700 ms press on the label posts the next scan (demo fallback).
function queue({ items, results, total, verified }: Progress) {
  const before = items.filter((i) => i.before).reduce((n, i) => n + i.count, 0);
  return [...Array<string>(before).fill(toneStyle.green.bar), ...results.map((r) => toneStyle[r.tone].bar),
    ...Array<string>(total - verified).fill("bg-border")];
}
function Counter({ progress, label, fallbackLabel, onFallback }: {
  progress: Progress; label: string; fallbackLabel: string; onFallback: () => void;
}) {
  const timer = useRef<number | undefined>(undefined);
  const cancel = () => window.clearTimeout(timer.current);
  useEffect(() => cancel, []);
  return (
    <div>
      <button
        type="button"
        aria-label={fallbackLabel}
        data-testid="demo-fallback"
        className="-mx-1 block min-h-11 select-none rounded-md px-1 text-start text-sm font-medium text-muted-foreground [-webkit-touch-callout:none] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onPointerDown={() => { cancel(); timer.current = window.setTimeout(onFallback, 700); }}
        onPointerUp={cancel} onPointerLeave={cancel} onPointerCancel={cancel}
        onContextMenu={(e) => e.preventDefault()}
        onClick={(e) => { if (e.detail === 0) onFallback(); /* keyboard activation only */ }}
      >
        <span aria-hidden="true">{label}</span>
      </button>
      <span className="sr-only">{label}</span>
      <div className="mt-1 flex gap-[3px]" aria-hidden="true">
        {queue(progress).map((bar, i) => (
          <span key={i} className={cn("h-1.5 flex-1 rounded-full transition-colors duration-500", bar)} />
        ))}
      </div>
    </div>
  );
}

/** What to do next, from item statuses only. The list always moves forward: items that failed wait at the
 * end and come back once every other item is done. */
function NextHint({ progress, lang, t, verb }: { progress: Progress; lang: Lang; t: Copy; verb: string }) {
  const open = progress.items.filter((i) => i.status === "blocked" || i.status === "check");
  const waiting = progress.items.find((i) => i.status === "waiting");
  const name = (i: Item) => (lang === "ar" ? i.labelAr : i.label);
  const fix = (i: Item) => `${name(i)} (${i.id.startsWith("panels") ? t.replace : t.retake})`;
  const list = (items: Item[]) => items.map(fix).join(lang === "ar" ? "، " : ", ");
  // A bad photo is retaken on the spot; only items that need a supplier replacement wait at the end.
  const retake = open.find((i) => !i.id.startsWith("panels"));
  if (retake) return <p className="text-[15px] font-medium text-warning-foreground">{t.retakeNow}: {name(retake)}</p>;
  if (waiting) {
    return (
      <>
        <p className="text-[15px] font-medium">{t.next}: {verb} {name(waiting)}</p>
        {!!open.length && <p className="mt-0.5 text-sm text-muted-foreground">{t.later}: {list(open)}</p>}
      </>
    );
  }
  return open.length ? <p className="text-[15px] font-medium text-warning-foreground">{t.rescan}: {list(open)}</p> : null;
}

function cameraProblem(state: CameraState, t: Copy) {
  return state === "insecure" ? t.camInsecure : state === "denied" ? t.camDenied : state === "missing" ? t.camMissing : undefined;
}

type StepProps = { site: SiteView; lang: Lang; t: Copy; onSite: (s: SiteView) => void; onError: (e: unknown) => void };

// Stage realism: the API returns which site photo goes with each result (public/scan-previews/*.png). After the
// shutter, that photo replaces the live camera frame while the label or screen is "read", so whatever the phone
// is pointed at, the audience sees a real-looking capture. A missing file falls back to the actual camera frame.
const photoUrl = (name?: string) => name ? `${import.meta.env.BASE_URL}scan-previews/${name}` : null;
function loadPhoto(url: string | null) {
  return new Promise<string | null>((done) => {
    if (!url) return done(null);
    const img = new Image(); img.onload = () => done(url); img.onerror = () => done(null); img.src = url;
  });
}
const pause = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

/** Shutter, captured photo, "reading" bar, then the result. Shared by delivery scans and switch-on photos. */
function useCapture(videoRef: React.RefObject<HTMLVideoElement | null>, onSite: (s: SiteView) => void, onError: (e: unknown) => void) {
  const [frozen, setFrozen] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const busy = useRef(false);
  const capture = async (path: "/site/scan" | "/site/photo", body: object, readMs: number) => {
    if (busy.current) return;
    busy.current = true; setPending(true); setError(null);
    const frame = grabFrame(videoRef.current);
    setFlash(true); window.setTimeout(() => setFlash(false), 120);
    try {
      const r = await api<PostReply>(path, body);
      setFrozen((await loadPhoto(photoUrl(r.result?.image))) ?? frame);
      await pause(readMs);
      if (r.result) signal(r.result.tone);
      onSite(r.site);
    } catch (e) { setError(e); onError(e); }
    finally { busy.current = false; setPending(false); setFrozen(null); }
  };
  const overlay = (text: string) => (
    <>
      <div className={cn("pointer-events-none absolute inset-0 bg-white transition-opacity duration-300", flash ? "opacity-80" : "opacity-0")} />
      {pending && (
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-black/60 py-3 text-[15px] font-medium text-white">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />{text}
        </div>
      )}
    </>
  );
  return { capture, frozen, pending, error, busy, overlay };
}

function DeliveryStep({ site, lang, t, onSite, onError }: StepProps) {
  const { videoRef, state } = useCamera(true);
  const detector = useBarcodeDetector();
  const lockUntil = useRef(0);
  const { capture, frozen, pending, error, busy, overlay } = useCapture(videoRef, onSite, onError);
  const progress = site.delivery;
  const { results } = progress;

  const submit = async (value: string) => {
    await capture("/site/scan", { code: site.code, value }, 1300);
    lockUntil.current = Date.now() + 2500;
  };
  const submitRef = useRef(submit);
  submitRef.current = submit;

  useEffect(() => {
    if (state !== "live" || !detector) return;
    let stopped = false;
    const tick = async () => {
      const video = videoRef.current;
      if (video && video.readyState >= 2 && !busy.current && Date.now() > lockUntil.current) {
        try {
          const [hit] = await detector.detect(video);
          if (hit && !stopped) await submitRef.current(hit.rawValue);
        } catch { /* frame not ready */ }
      }
      if (!stopped) window.setTimeout(tick, 250);
    };
    void tick();
    return () => { stopped = true; };
  }, [state, detector, videoRef, busy]);

  const latest = results[results.length - 1];
  const live = state === "live";

  return (
    <>
      <div className="space-y-4">
        <div>
          <h2 className="font-serif text-[22px] font-semibold leading-tight">{t.deliveryTitle}</h2>
          <div className="mt-1"><NextHint progress={progress} lang={lang} t={t} verb={t.scan} /></div>
        </div>
        <Counter progress={progress} label={t.verified(progress.verified, progress.total, progress.open)}
          fallbackLabel={t.fallbackScan} onFallback={() => void submit("manual")} />
        <Viewfinder videoRef={videoRef} state={state} starting={t.camStarting} problem={cameraProblem(state, t)} frozen={frozen}
          overlay={overlay(t.readingLabel)} />
        <div aria-live="polite" className="space-y-2">
          {pending && <p className="sr-only">{t.readingLabel}</p>}
          {!!error && <p className="text-sm text-destructive-foreground" role="alert">{errorText(error, lang, t)}</p>}
          {latest && !pending && <ResultPanel key={latest.n} step={latest} items={progress.items} lang={lang} t={t} />}
        </div>
        <EarlierList steps={results.slice(0, -1)} items={progress.items} lang={lang} t={t} />
      </div>
      <ActionBar>
        {detector === null ? (
          <Button size="lg" className="h-14 w-full text-base" disabled={!live || pending} onClick={() => { unlockAudio(); void submit("manual"); }}>
            {pending ? t.checking : t.scan}
          </Button>
        ) : detector && live ? (
          <p className="py-3 text-center text-sm text-muted-foreground">{t.autoHint}</p>
        ) : null}
        {detector === null && live && <p className="mt-2 text-center text-xs text-muted-foreground">{t.manualHint}</p>}
      </ActionBar>
    </>
  );
}

function SwitchOnStep({ site, lang, t, onSite, onError }: StepProps) {
  const { videoRef, state } = useCamera(true);
  const { capture, frozen, pending, error, overlay } = useCapture(videoRef, onSite, onError);
  const progress = site.switchOn;
  const { results } = progress;
  const shoot = () => { unlockAudio(); void capture("/site/photo", { code: site.code }, 2000); };
  const latest = results[results.length - 1];

  return (
    <>
      <div className="space-y-4">
        <div>
          <h2 className="font-serif text-[22px] font-semibold leading-tight">{t.switchTitle}</h2>
          <div className="mt-1"><NextHint progress={progress} lang={lang} t={t} verb={t.photograph} /></div>
        </div>
        <Counter progress={progress} label={t.verified(progress.verified, progress.total, progress.open)}
          fallbackLabel={t.fallbackPhoto} onFallback={shoot} />
        <Viewfinder videoRef={videoRef} state={state} starting={t.camStarting} problem={cameraProblem(state, t)} frozen={frozen}
          overlay={overlay(t.reading)} />
        <div aria-live="polite" className="space-y-2">
          {pending && <p className="sr-only">{t.reading}</p>}
          {!!error && <p className="text-sm text-destructive-foreground" role="alert">{errorText(error, lang, t)}</p>}
          {latest && !pending && <ResultPanel key={latest.n} step={latest} items={progress.items} lang={lang} t={t} />}
        </div>
        <EarlierList steps={results.slice(0, -1)} items={progress.items} lang={lang} t={t} />
      </div>
      <ActionBar>
        <Button size="lg" className="h-14 w-full text-base" disabled={state !== "live" || pending} onClick={shoot}>
          {pending ? t.reading : t.takePhoto}
        </Button>
      </ActionBar>
    </>
  );
}

function Notice({ icon, title, body, note }: { icon: ReactNode; title: string; body: string; note?: string }) {
  return (
    <Card className="p-5" role="status">
      <div className="flex items-start gap-3">
        {icon}
        <div>
          <p className="text-lg font-semibold leading-snug">{title}</p>
          <p className="mt-1 text-[15px] leading-relaxed">{body}</p>
          {note && <p className="mt-3 text-sm text-muted-foreground">{note}</p>}
        </div>
      </div>
    </Card>
  );
}

function ActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 -mx-4 mt-6 border-t bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur supports-[backdrop-filter]:bg-background/85">
      {children}
    </div>
  );
}

function readLang(): Lang {
  try { return localStorage.getItem("tq-site-lang") === "en" ? "en" : "ar"; } catch { return "ar"; }
}

export default function Site() {
  const queryClient = useQueryClient();
  const [lang, setLang] = useState<Lang>(readLang);
  const t = copy[lang];
  const [input, setInput] = useState(() => new URLSearchParams(window.location.search).get("code") ?? "");
  const [code, setCode] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [entryError, setEntryError] = useState<unknown>(null);

  const site = useQuery({
    queryKey: ["site", code],
    queryFn: () => api<SiteView>(`/site/${encodeURIComponent(code!)}`),
    enabled: !!code && !expired,
    staleTime: 0,
    retry: false,
    refetchInterval: (q) => (q.state.status !== "error" && (q.state.data?.step === "waiting" || q.state.data?.step === "done") ? 2000 : false),
  });

  const handleError = (e: unknown) => {
    const status = (e as ApiError)?.status;
    if (status === 410) setExpired(true);
    if (status === 404) { setEntryError(e); setCode(null); }
  };
  useEffect(() => { if (site.error) handleError(site.error); }, [site.error]);

  const open = useMutation({
    mutationFn: (value: string) => api<SiteView>("/site/open", { code: value }),
    onSuccess: (data) => { queryClient.setQueryData(["site", data.code], data); setCode(data.code); setExpired(false); },
  });

  const toggleLang = () => {
    const next = lang === "ar" ? "en" : "ar";
    setLang(next);
    try { localStorage.setItem("tq-site-lang", next); } catch { /* per-viewer convenience only */ }
  };
  const onSite = (s: SiteView) => queryClient.setQueryData(["site", s.code], s);
  const reset = () => { setCode(null); setExpired(false); open.reset(); setEntryError(null); };
  const submitCode = (e: FormEvent) => { e.preventDefault(); unlockAudio(); setEntryError(null); if (input.trim()) open.mutate(input.trim()); };

  const data = code ? site.data : undefined;
  const shownError = open.error ?? entryError;
  const stepProps = data && { site: data, lang, t, onSite, onError: handleError };

  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} lang={lang}
      style={lang === "ar" ? { fontFamily: "'IBM Plex Sans Arabic', 'IBM Plex Sans', system-ui, sans-serif" } : undefined}
      className="min-h-[100dvh] overflow-x-hidden bg-background text-foreground">
      <div className="mx-auto flex min-h-[100dvh] max-w-[440px] flex-col sm:border-x sm:border-border">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/85">
          <span className="flex items-center gap-2">
            <BrandMark className="h-7 w-7" />
            <span className="text-[17px] font-semibold tracking-[-0.01em]">{t.brand}</span>
          </span>
          <Button variant="outline" size="sm" className="h-11 px-4 text-sm" onClick={toggleLang} aria-label={t.switchLabel}
            lang={lang === "ar" ? "en" : "ar"}>
            {t.switchTo}
          </Button>
        </header>

        <main className="flex flex-1 flex-col px-4 pt-4">
          {data && !expired && (
            <div className="mb-5 flex items-start justify-between gap-3 border-b pb-4">
              <div className="min-w-0">
                <p className="truncate text-[13px] text-muted-foreground">{data.institution}</p>
                <h1 className="text-[17px] font-semibold leading-snug">{data.title}</h1>
              </div>
              <span className="shrink-0 rounded-md border bg-card px-2 py-1 text-xs text-muted-foreground">
                {t.codeShort} <span dir="ltr" className="font-mono text-foreground">{data.code}</span>
              </span>
            </div>
          )}

          <div className="flex flex-1 flex-col justify-between">
            {expired ? (
              <>
                <Notice icon={<CircleCheck className="h-6 w-6 shrink-0 text-success-foreground" aria-hidden="true" />}
                  title={t.expiredTitle} body={t.expiredBody} />
                <ActionBar><Button variant="outline" size="lg" className="h-12 w-full" onClick={reset}>{t.another}</Button></ActionBar>
              </>
            ) : !code || !data ? (
              <form onSubmit={submitCode} className="flex flex-1 flex-col justify-between">
                <div>
                  <h1 className="font-serif text-[26px] font-semibold leading-tight">{t.entryTitle}</h1>
                  <p className="mt-1 text-[15px] text-muted-foreground">{t.entryLead}</p>
                  <label htmlFor="site-code" className="mt-6 block text-sm font-medium">{t.codeLabel}</label>
                  <Input id="site-code" dir="ltr" value={input} onChange={(e) => setInput(e.target.value.toUpperCase())}
                    placeholder="TQ-0000" autoComplete="off" autoCapitalize="characters" spellCheck={false}
                    aria-invalid={!!shownError} aria-describedby={shownError ? "site-code-error" : undefined}
                    className="mt-2 h-16 text-center font-mono text-[28px] tracking-[0.08em] md:text-[28px]" />
                  <div aria-live="polite">
                    {!!shownError && (
                      <p id="site-code-error" className="mt-3 flex items-start gap-2 rounded-md border border-destructive-foreground/25 bg-destructive p-3 text-sm text-destructive-foreground">
                        <OctagonX className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{errorText(shownError, lang, t)}
                      </p>
                    )}
                  </div>
                  {code && site.isLoading && <Loader2 className="mt-4 h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" />}
                </div>
                <ActionBar>
                  <Button type="submit" size="lg" className="h-14 w-full text-base" disabled={open.isPending || !input.trim()}>
                    {open.isPending ? t.opening : t.open}
                  </Button>
                </ActionBar>
              </form>
            ) : data.step === "delivery" ? (
              <DeliveryStep {...stepProps!} />
            ) : data.step === "switchOn" ? (
              <SwitchOnStep {...stepProps!} />
            ) : (
              <div className="space-y-4 pb-6">
                {data.step === "waiting" ? (
                  <Notice icon={<Clock className="h-6 w-6 shrink-0 text-warning-foreground" aria-hidden="true" />}
                    title={t.waitingTitle} body={t.waitingBody} note={t.keepOpen} />
                ) : (
                  <Notice icon={<CircleCheck className="h-6 w-6 shrink-0 text-success-foreground" aria-hidden="true" />}
                    title={t.doneTitle} body={t.doneBody} note={t.keepOpen} />
                )}
                <EarlierList steps={data.step === "waiting" ? data.delivery.results : data.switchOn.results}
                  items={data.step === "waiting" ? data.delivery.items : data.switchOn.items} lang={lang}
                  t={{ ...t, earlier: data.step === "waiting" ? t.deliveryTitle : t.switchTitle }} />
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

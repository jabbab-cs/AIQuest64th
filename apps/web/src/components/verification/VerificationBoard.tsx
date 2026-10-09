import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import QRCode from "qrcode";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, CheckCircle2, Circle, Copy, Download, Lock, MessageSquare, XOctagon } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { downloadPdf } from "@/lib/download-pdf";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/source-chip";
import { getGetApplicationQueryKey, getListApplicationsQueryKey } from "@tahaqqaq/api-client";

type Tone = "green" | "amber" | "red";
type Step = { n: number; at: string; bank?: string; item: string; image?: string; tone: Tone; title: string; detail: string; serial?: string; replaces?: string };
type Item = { id: string; label: string; count: number; before?: string; note?: string; status: "verified" | "blocked" | "check" | "waiting" };
type Stage = { items: Item[]; results: Step[]; verified: number; total: number; open: number; done: boolean };
type Verification = {
  code: string; siteUrl: string; stage: "approved" | "verifying" | "paid";
  applicationId: string; institution: string; title: string;
  scope: {
    confirmed?: string[];
    items: { name: string; amount: number }[]; approvedTotal: number; loanAmount: number;
    payments: { stage: 1 | 2; label: string; amount: number }[];
    equipment: { shipments: number; panels: number; panelsPerShipment: number; panelModel: string; supplier: string };
  };
  delivery: Stage;
  switchOn: Stage;
  payments: { "1": string | null; "2": string | null };
  can: { release1: boolean; release2: boolean; certificate: boolean };
};
type Role = "bank" | "institution";

const money = (n: number) => `JOD ${n.toLocaleString("en-US")}`;
const ammanTime = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Amman", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const when = (iso: string) => `${ammanTime.format(new Date(iso))} Amman time`;
const label = "text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground";

const toneStyle: Record<Tone, { word: string; icon: typeof Check; badge: "success" | "warning" | "destructive" }> = {
  green: { word: "Matched", icon: CheckCircle2, badge: "success" },
  amber: { word: "Check", icon: AlertTriangle, badge: "warning" },
  red: { word: "Blocked", icon: XOctagon, badge: "destructive" },
};

async function fetchVerification(): Promise<Verification | null> {
  const res = await fetch("/api/verification", { cache: "no-store" });
  if (!res.ok) throw new Error(`Could not load verification (error ${res.status}).`);
  return res.json();
}

export function VerificationBoard({ role, applicationId }: { role: Role; applicationId?: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["verification"],
    queryFn: fetchVerification,
    refetchInterval: (query) => (query.state.data && query.state.data.stage !== "paid" ? 2000 : false),
  });

  if (isLoading) return <p className="p-10 text-center text-sm text-muted-foreground">Loading verification...</p>;
  if (isError) return <p className="p-10 text-center text-sm text-muted-foreground">Verification could not be loaded. Refresh the page to try again.</p>;
  if (!data || (applicationId && data.applicationId !== applicationId)) {
    return (
      <div className="mx-auto max-w-[560px] px-4 py-16 text-center">
        <h1 className="font-serif text-[26px] font-semibold leading-tight">This project hasn&apos;t been approved yet</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {role === "bank"
            ? "Verification starts once the bank approves the scope from the report."
            : "You will get a project code for your installer once the bank approves the scope."}
        </p>
        <Button asChild variant="outline" className="mt-6 min-h-11">
          <Link href={role === "bank" ? `/bank/${applicationId}/report` : "/institution"}>
            {role === "bank" ? "Back to the report" : "Back to the portal"}
          </Link>
        </Button>
      </div>
    );
  }
  return <Board v={data} role={role} />;
}

/** One sentence a judge or reviewer can act on: what is verified, what is waiting, who moves next. */
function nextStep(v: Verification, isBank: boolean) {
  const [p1, p2] = v.scope.payments;
  const d = v.delivery, s = v.switchOn;
  if (v.stage === "approved") return isBank ? `Waiting for the installer to open project ${v.code} on site.` : `Send code ${v.code} to your installer to start the on-site checks.`;
  const open = (st: Stage) => st.open ? ` ${st.open} open ${st.open === 1 ? "issue blocks" : "issues block"} payment until replaced or retaken.` : "";
  if (!d.done) return `Installer is checking the delivery: ${d.verified} of ${d.total} items verified.${open(d) || " Payment 1 unlocks when every item is verified."}`;
  if (!v.payments["1"]) return isBank ? `Delivery verified. Release payment 1 (${money(p1.amount)}).` : "Delivery verified. Waiting for the bank to release payment 1.";
  if (!s.done) return `Payment 1 released. Installer is photographing the switch-on: ${s.verified} of ${s.total} items verified.${open(s)}`;
  if (!v.payments["2"]) return isBank ? `Switch-on verified. Release payment 2 (${money(p2.amount)}).` : "Switch-on verified. Waiting for the bank to release payment 2.";
  return null;
}

function Board({ v, role }: { v: Verification; role: Role }) {
  const paid = v.stage === "paid";
  const isBank = role === "bank";
  const next = nextStep(v, isBank);
  const queryClient = useQueryClient();
  // Keep the case header and inbox badges in step with the polled stage.
  useEffect(() => {
    void queryClient.invalidateQueries({ queryKey: getGetApplicationQueryKey(v.applicationId) });
    void queryClient.invalidateQueries({ queryKey: getListApplicationsQueryKey() });
  }, [v.stage, v.applicationId, queryClient]);

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-8 sm:py-8">
      <header className="pb-6">
        <p className={label}>{isBank ? "Loan release" : "On-site verification"}</p>
        <h1 className="mt-2 font-serif text-[28px] font-semibold leading-tight tracking-[-0.01em] sm:text-[34px]">{v.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span className="font-medium">{v.institution}</span>
          <StatusBadge status={{ approved: "Approved", verifying: "Verifying", paid: "Paid" }[v.stage]} />
        </div>
      </header>

      {next && (
        <div className="mb-6 rounded-lg border border-l-4 border-l-primary bg-card px-5 py-4" aria-live="polite">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-primary">Next step</p>
          <p className="mt-1 text-sm text-foreground">{next}</p>
        </div>
      )}

      {paid && (
        <div role="status" className="mb-6 flex flex-col gap-4 rounded-lg border border-success-foreground/20 bg-success p-5 text-success-foreground sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-3 text-[15px] font-medium leading-6">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            Paid. Both payments released. The project code has expired.
          </p>
          {v.can.certificate && <CertificateButton applicationId={v.applicationId} />}
        </div>
      )}

      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-6">
        <div className="order-2 space-y-5 lg:order-none">
          <ToFixCard v={v} />
          <DeliveryCard v={v} />
          <SwitchOnCard v={v} />
        </div>
        {/* On phone the aside dissolves (display: contents) so its cards can be ordered around the main column. */}
        <aside className="contents lg:sticky lg:top-6 lg:block lg:space-y-5">
          {isBank && <PaymentsCard v={v} role={role} className="order-1" />}
          <CodeCard v={v} role={role} className={isBank ? "order-3" : "order-1"} />
          {!isBank && <PaymentsCard v={v} role={role} className="order-3" />}
        </aside>
      </div>
    </div>
  );
}

function CodeCard({ v, role, className }: { v: Verification; role: Role; className?: string }) {
  const [svg, setSvg] = useState("");
  const [copied, setCopied] = useState(false);
  const expired = v.stage === "paid";

  useEffect(() => {
    QRCode.toString(v.siteUrl, { type: "svg", margin: 1 }).then(setSvg, () => setSvg(""));
  }, [v.siteUrl]);
  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(t);
  }, [copied]);

  const copy = async () => {
    try { await navigator.clipboard.writeText(v.code); setCopied(true); } catch { /* ponytail: no fallback; the code is on screen to read out */ }
  };
  const message = `Tahaqqaq project code ${v.code} for ${v.title}. Open ${v.siteUrl} on your phone and enter the code.`;

  return (
    <Card className={cn("border-border", className)}>
      <CardContent className="p-5">
        <p className={label}>Project code</p>
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className={cn("font-mono text-[30px] font-semibold tracking-[0.04em]", expired && "text-muted-foreground line-through")}>{v.code}</span>
          {!expired && (
            <Button variant="outline" size="sm" onClick={copy} className="min-h-11 shrink-0 sm:min-h-9" aria-label={copied ? "Code copied" : `Copy project code ${v.code}`}>
              {copied ? <Check className="mr-1.5 h-4 w-4" aria-hidden="true" /> : <Copy className="mr-1.5 h-4 w-4" aria-hidden="true" />}
              <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
            </Button>
          )}
        </div>
        {expired ? (
          <p className="mt-2 text-sm text-muted-foreground">Expired. The installer link no longer opens this project.</p>
        ) : (
          <>
            <div className="mt-4 flex items-center gap-4">
              <div
                className="h-[132px] w-[132px] shrink-0 rounded-md border bg-white p-1 [&>svg]:h-full [&>svg]:w-full"
                role="img"
                aria-label={`QR code for ${v.siteUrl}`}
                dangerouslySetInnerHTML={{ __html: svg }}
              />
              <p className="text-[13px] leading-5 text-muted-foreground">
                {role === "institution"
                  ? "Your installer scans this with a phone camera, or opens the link and types the code."
                  : "The installer opens this on site to scan delivery and switch-on."}
              </p>
            </div>
            {role === "institution" && (
              <div className="mt-5 border-t pt-4">
                <p className="text-sm font-semibold">Send to installer</p>
                <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
                  On site, the installer uses a phone to scan each delivered item, then photographs the switch-on. Results show up on this page as they happen.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button asChild variant="outline" className="min-h-11">
                    <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">WhatsApp</a>
                  </Button>
                  <Button asChild variant="outline" className="min-h-11">
                    <a href={`sms:?&body=${encodeURIComponent(message)}`}><MessageSquare className="mr-1.5 h-4 w-4" aria-hidden="true" />SMS</a>
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function PaymentsCard({ v, role, className }: { v: Verification; role: Role; className?: string }) {
  const { scope } = v;
  const isBank = role === "bank";
  const why = {
    1: "Available once every delivered item is verified",
    2: !v.payments["1"] ? "Available after payment 1" : "Available once every switch-on item is verified",
  };

  return (
    <Card className={cn("border-border", className)}>
      <CardContent className="p-5">
        <p className={label}>Approved scope</p>
        <ul className="mt-3 space-y-2 text-sm">
          {scope.items.map((item) => (
            <li key={item.name} className="flex justify-between gap-3"><span>{item.name}</span><span className="shrink-0 tabular-nums">{money(item.amount)}</span></li>
          ))}
        </ul>
        <dl className="mt-3 space-y-1 border-t pt-3 text-sm">
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Approved total</dt><dd className="font-semibold tabular-nums">{money(scope.approvedTotal)}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Loan</dt><dd className="font-semibold tabular-nums">{money(scope.loanAmount)}</dd></div>
        </dl>

        {!!scope.confirmed?.length && <>
          <p className={cn(label, "mt-6")}>Confirmed before approval</p>
          <ul className="mt-3 space-y-2 text-sm">
            {scope.confirmed.map((item) => (
              <li key={item} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" /><span>{item}</span></li>
            ))}
          </ul>
        </>}

        <p className={cn(label, "mt-6")}>Payments</p>
        <ol className="mt-3 space-y-3">
          {scope.payments.map((p) => {
            const released = v.payments[p.stage === 1 ? "1" : "2"];
            const ready = p.stage === 1 ? v.can.release1 : v.can.release2;
            return (
              <li key={p.stage} className="rounded-md border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{p.label}</p>
                    <p className="mt-0.5 text-[15px] font-semibold tabular-nums">{money(p.amount)}</p>
                  </div>
                  {released
                    ? <Badge variant="success"><Check className="mr-1 h-3 w-3" aria-hidden="true" />Released</Badge>
                    : ready ? <Badge variant="warning">Ready</Badge> : <Badge variant="secondary">Waiting</Badge>}
                </div>
                {released && <p className="mt-1.5 text-xs text-muted-foreground">Released {when(released)}</p>}
                {isBank && !released && (
                  <div className="mt-3">
                    <ReleaseButton v={v} stage={p.stage} amount={p.amount} enabled={ready} />
                    {!ready && <p className="mt-1.5 text-xs text-muted-foreground">{why[p.stage]}</p>}
                  </div>
                )}
              </li>
            );
          })}
        </ol>

        {isBank && v.stage !== "paid" && (
          <div className="mt-4">
            <CertificateButton applicationId={v.applicationId} disabled={!v.can.certificate} />
            {!v.can.certificate && <p className="mt-1.5 text-xs text-muted-foreground">Available once both payments are released</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ReleaseButton({ v, stage, amount, enabled }: { v: Verification; stage: 1 | 2; amount: number; enabled: boolean }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const release = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/verification/${encodeURIComponent(v.applicationId)}/release`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stage }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? `Release failed (error ${res.status}).`);
      return body as Verification;
    },
    onSuccess: (next) => {
      queryClient.setQueryData(["verification"], next);
      toast({ title: `Payment ${stage} released`, description: `${money(amount)} released.` });
    },
    onError: (err) => toast({ title: "Payment not released", description: (err as Error).message, variant: "destructive" }),
  });

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button className="min-h-11 w-full sm:min-h-10" disabled={!enabled || release.isPending}>
          {release.isPending ? "Releasing..." : `Release payment ${stage}`}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Release payment {stage}?</AlertDialogTitle>
          <AlertDialogDescription>
            {money(amount)} of the {money(v.scope.loanAmount)} loan will be released for {v.title}. This can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => release.mutate()}>Release {money(amount)}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function CertificateButton({ applicationId, disabled }: { applicationId: string; disabled?: boolean }) {
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const download = async () => {
    setBusy(true);
    try {
      await downloadPdf(`/api/verification/${encodeURIComponent(applicationId)}/certificate.pdf`, "Tahaqqaq_Certificate_TQ-4821.pdf");
    } catch (err) {
      toast({ title: "Certificate not downloaded", description: (err as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button variant="outline" onClick={download} disabled={disabled || busy} className="min-h-11 w-full bg-card sm:min-h-10 sm:w-auto">
      <Download className="mr-2 h-4 w-4" aria-hidden="true" />
      {busy ? "Preparing..." : "Download certificate"}
    </Button>
  );
}

/** Highlights the newest result for a few seconds when it arrives during polling (not on first load). */
function useFreshResult(results: Step[]) {
  const latest = results.at(-1)?.n ?? 0;
  const seen = useRef(latest);
  const [fresh, setFresh] = useState<number | null>(null);
  useEffect(() => {
    if (latest <= seen.current) return;
    seen.current = latest;
    setFresh(latest);
    const t = window.setTimeout(() => setFresh(null), 3000);
    return () => window.clearTimeout(t);
  }, [latest]);
  return fresh;
}

const itemStyle: Record<Item["status"], { icon: typeof Check; cls: string; word: string }> = {
  verified: { icon: CheckCircle2, cls: "text-success-foreground", word: "Verified" },
  blocked: { icon: XOctagon, cls: "text-destructive-foreground", word: "Blocked" },
  check: { icon: AlertTriangle, cls: "text-warning-foreground", word: "Needs action" },
  waiting: { icon: Circle, cls: "text-muted-foreground", word: "Waiting" },
};

/** The approved scope as a checklist: one row per item, so a retake or replacement never adds to the count. */
function Checklist({ items }: { items: Item[] }) {
  return (
    <ul className="mt-4 grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2">
      {items.map((item) => {
        const st = itemStyle[item.status];
        const Icon = st.icon;
        return (
          <li key={item.id} className="flex min-w-0 items-start gap-2">
            <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", st.cls)} aria-hidden="true" />
            <span className="min-w-0">
              <span className={cn(item.status === "waiting" && "text-muted-foreground")}>{item.label}</span>
              <span className="sr-only">: {st.word}</span>
              {item.note && <span className="block text-xs text-muted-foreground">{item.note}</span>}
              {(item.status === "blocked" || item.status === "check") && <span className={cn("block text-xs font-medium", st.cls)}>{st.word}</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** The photo the installer's phone captured for this result; opens full size. */
function SitePhoto({ step }: { step: Step }) {
  const [broken, setBroken] = useState(false);
  if (!step.image || broken) return null;
  const src = `${import.meta.env.BASE_URL}scan-previews/${step.image}`;
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className="h-20 w-16 shrink-0 overflow-hidden rounded-md border bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-24 sm:w-[72px]"
          aria-label={`Open site photo for result ${step.n}`}>
          <img src={src} alt="" loading="lazy" onError={() => setBroken(true)} className="h-full w-full object-cover" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-[min(92vw,520px)] gap-3 p-3 sm:p-4">
        <DialogTitle className="pe-8 text-base">Site photo #{step.n}{step.serial ? `: ${step.serial}` : ""}</DialogTitle>
        <DialogDescription className="sr-only">Photo captured by the installer&apos;s phone</DialogDescription>
        <img src={src} alt={`Site photo for result ${step.n}`} className="max-h-[75vh] w-full rounded-md object-contain" />
        <p className="text-xs text-muted-foreground">Captured on site {when(step.at)}</p>
      </DialogContent>
    </Dialog>
  );
}

function ResultList({ results, items, fresh }: { results: Step[]; items: Item[]; fresh: number | null }) {
  const name = (id: string) => items.find((i) => i.id === id)?.label ?? id;
  return (
    <ol className="mt-4 space-y-2">
      {[...results].reverse().map((step) => {
        const tone = toneStyle[step.tone];
        const Icon = tone.icon;
        // Titles repeat the tone ("Stop. Already financed"); the badge already says it.
        const title = step.title.replace(/^(Stop|Check|Matched)\.?\s*/, "");
        // A red or amber result stays open until a later green result on the same item.
        const fixedBy = step.tone !== "green" ? results.find((r) => r.n > step.n && r.item === step.item && r.tone === "green")?.n : undefined;
        return (
          <li
            key={step.n}
            className={cn(
              "flex gap-3 rounded-md border p-3 transition-colors duration-700",
              fresh === step.n ? "border-primary/40 bg-secondary" : "bg-card",
            )}
          >
            <SitePhoto step={step} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Badge variant={tone.badge}><Icon className="mr-1 h-3.5 w-3.5" aria-hidden="true" />{tone.word}</Badge>
                <span className="text-sm font-medium">{name(step.item)}</span>
                {fresh === step.n && <span className="text-xs font-medium text-primary">New</span>}
              </div>
              {step.serial && <p className="mt-1 break-all font-mono text-[13px]">{step.serial}</p>}
              {/* ponytail: both roles read the same plain title + detail; the API's bank notes use internal shorthand. */}
              {title && <p className="mt-1.5 text-sm font-medium leading-5">{title}</p>}
              <p className={cn("text-sm leading-5 text-muted-foreground", !title && "mt-1.5")}>{step.detail}</p>
              {step.replaces && (
                <p className="mt-1.5 text-xs font-medium text-primary">
                  {step.replaces.startsWith("#") ? `Retake of ${step.replaces}.` : `Replaces ${step.replaces}.`}
                </p>
              )}
              {step.tone !== "green" && (
                <p className={cn("mt-1.5 text-xs font-medium", fixedBy ? "text-primary" : "text-destructive-foreground")}>
                  {fixedBy ? `Fixed by #${fixedBy}. No longer blocks payment.` : "Open. Blocks payment until it is replaced or retaken."}
                </p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">#{step.n} · {when(step.at)}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function StageCard({ title, sub, stage, children }: { title: string; sub?: string; stage: Stage; children: React.ReactNode }) {
  const { verified, total, open } = stage;
  return (
    <Card className="border-border">
      <CardContent className="p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 className="text-lg font-semibold">{title}</h2>
          <span className="text-sm tabular-nums text-muted-foreground">
            {verified} of {total} verified{open > 0 && <span className="font-medium text-destructive-foreground"> · {open} open</span>}
          </span>
        </div>
        {sub && <p className="mt-1 text-sm text-muted-foreground">{sub}</p>}
        {/* Same queue as the installer's phone: fills in scan order, and each failed scan adds a segment at the end. */}
        <div className="mt-3 flex gap-[3px]" role="img" aria-label={`${title}: ${verified} of ${total} items verified`}>
          {[
            ...Array<string>(stage.items.filter((i) => i.before).reduce((n, i) => n + i.count, 0)).fill("bg-primary"),
            ...stage.results.map((r) => ({ green: "bg-primary", amber: "bg-warning-foreground", red: "bg-destructive-foreground" })[r.tone]),
            ...Array<string>(total - verified).fill("bg-secondary"),
          ].map((bar, i) => <span key={i} className={cn("h-1.5 flex-1 rounded-full transition-colors duration-500", bar)} />)}
        </div>
        <Checklist items={stage.items} />
        {children}
      </CardContent>
    </Card>
  );
}

/** Open issues in one place, so anyone coming back days later sees what still blocks payment and why. */
function ToFixCard({ v }: { v: Verification }) {
  const open = (["delivery", "switchOn"] as const).flatMap((key) => v[key].items
    .filter((i) => i.status === "blocked" || i.status === "check")
    .map((item) => ({ item, stage: key === "delivery" ? "Delivery" : "Switch-on", step: v[key].results.filter((r) => r.item === item.id).at(-1)! })));
  if (!open.length) return null;
  return (
    <Card className="border-destructive-foreground/30">
      <CardContent className="p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 className="text-lg font-semibold">To fix</h2>
          <span className="text-sm font-medium text-destructive-foreground">{open.length} open · payment blocked</span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Open items go to the end of the installer's list. They can reopen code {v.code} at any time, and a matching scan or photo clears the item here.
        </p>
        <ul className="mt-4 space-y-2">
          {open.map(({ item, stage, step }) => {
            const tone = toneStyle[step.tone];
            const Icon = tone.icon;
            return (
              <li key={item.id} className="flex gap-3 rounded-md border bg-card p-3">
                <SitePhoto step={step} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Badge variant={tone.badge}><Icon className="mr-1 h-3.5 w-3.5" aria-hidden="true" />{tone.word}</Badge>
                    <span className="text-sm font-medium">{item.label}</span>
                    <span className="text-xs text-muted-foreground">{stage}</span>
                  </div>
                  {step.serial && <p className="mt-1 break-all font-mono text-[13px]">{step.serial}</p>}
                  <p className="mt-1.5 text-sm leading-5">{step.bank ?? step.detail}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Open since {when(step.at)} · scan #{step.n}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

function DeliveryCard({ v }: { v: Verification }) {
  const stage = v.delivery;
  const fresh = useFreshResult(stage.results);
  const eq = v.scope.equipment;
  return (
    <StageCard title="Delivery" stage={stage}
      sub={`${eq.panels} ${eq.panelModel} panels in ${eq.shipments} shipments of ${eq.panelsPerShipment}, the inverter and the LED fittings. One label is scanned per item.`}>
      <div aria-live="polite">
        {stage.results.length === 0
          ? <p className="mt-4 rounded-md border border-dashed p-4 text-sm text-muted-foreground">Waiting for the installer to scan the first label.</p>
          : <ResultList results={stage.results} items={stage.items} fresh={fresh} />}
        {stage.done && <p className="mt-3 flex items-center gap-2 text-sm font-medium text-success-foreground"><CheckCircle2 className="h-4 w-4" aria-hidden="true" />Delivery verified</p>}
      </div>
    </StageCard>
  );
}

function SwitchOnCard({ v }: { v: Verification }) {
  const stage = v.switchOn;
  const fresh = useFreshResult(stage.results);
  const locked = !v.payments["1"];
  return (
    <StageCard title="Switch-on" stage={stage} sub="Photos of the inverter screen, the meter and the lighting.">
      <div aria-live="polite">
        {locked ? (
          <p className="mt-4 flex items-center gap-2 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            <Lock className="h-4 w-4 shrink-0" aria-hidden="true" />Starts after payment 1
          </p>
        ) : stage.results.length === 0 ? (
          <p className="mt-4 rounded-md border border-dashed p-4 text-sm text-muted-foreground">Waiting for the installer to send the first switch-on photo.</p>
        ) : (
          <ResultList results={stage.results} items={stage.items} fresh={fresh} />
        )}
        {stage.done && <p className="mt-3 flex items-center gap-2 text-sm font-medium text-success-foreground"><CheckCircle2 className="h-4 w-4" aria-hidden="true" />Switch-on verified</p>}
      </div>
    </StageCard>
  );
}

import { BankLayout } from "@/components/layout/Shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SourceChip } from "@/components/ui/source-chip";
import { Link, useRoute } from "wouter";
import { useGetApplication, useRecordEvidenceRequest, useListEvidenceRequests, getGetApplicationQueryKey, getListEvidenceRequestsQueryKey } from "@workspace/api-client-react";
import { sourceRegister } from "@workspace/greenroute-research";
import { caseDataForApplication, REFERENCE_CASE_DATA, APPROVED_CASE_ID } from "@/data/reference-data";
import { AlertCircle, ArrowRight, Check, ChevronDown, Download, FileText, LockKeyhole, Paperclip, Send, ShieldCheck, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { REFERENCE_CASE_COUNTS, REFERENCE_MISSING_EVIDENCE } from "@/data/case-counts";
import { RealScreeningWorkspace } from "@/components/bank/RealScreeningWorkspace";
import { downloadPdf } from "@/lib/download-pdf";

const money = (n: number) => `JOD ${Math.round(n).toLocaleString()}`;
const sections = [
  ["summary", "Summary"], ["scope", "Scope by upgrade"], ["evidence", "Evidence received"], ["checks", "Data checks"],
  ["compliance", "Compliance by layer"], ["analysis", "Project analysis"], ["requests", "Evidence requests"], ["limits", "Limits and sources"],
] as const;
const summaryPassages = new Set(["S03:16", "S09:132", "S09:136", "S11:7", "S12:29", "S12:3", "S17:4", "S17:5", "S18:5", "S18:8", "S13:"]);

function SectionHeading({ number, title, id }: { number: number; title: string; id: string }) {
  return <div id={id} className="scroll-mt-6 flex items-center gap-3 border-b border-[#E2DDD3] pb-3">
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#E2DDD3] text-xs font-bold text-foreground">{number}</span>
    <h2 className="text-[22px] font-semibold tracking-[-0.015em] text-foreground">{title}</h2>
  </div>;
}

function Outcome({ children, tone }: { children: string; tone: "good" | "warn" | "bad" }) {
  const colors = { good: "border-[#A8D5B9] bg-[#F3F1EC] text-[#134A38]", warn: "border-[#B7812A] bg-[#FBF1DC] text-[#8A5A12]", bad: "border-[#EFC2B8] bg-[#FBEAE6] text-[#C4553F]" };
  return <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] ${colors[tone]}`}>{children}</span>;
}

// Phase 1 ends here. Phase 2 is shown on a separate case that was confirmed and approved in advance.
function NextPhase() {
  return (
    <div className="mb-7 flex flex-col gap-3 rounded-lg border border-l-4 border-l-primary bg-card px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div><p className="text-[11px] font-semibold uppercase text-primary tracking-[0.06em]">After approval</p><p className="mt-1 text-sm text-foreground">This case still has evidence to collect. To see on-site verification and payments, open the approved case Solar and LED upgrade.</p></div>
      <Link href={`/bank/${APPROVED_CASE_ID}/verification`} className="inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-semibold text-primary hover:underline sm:min-h-0">Open approved case <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
    </div>
  );
}

export default function Report() {
  const [, params] = useRoute("/bank/:id/report");
  const id = params?.id;
  const { data: app, isLoading } = useGetApplication(id || "", { query: { enabled: !!id, queryKey: getGetApplicationQueryKey(id || "") } });
  const { data: requests = [], refetch } = useListEvidenceRequests(id || "", { query: { enabled: !!id, queryKey: getListEvidenceRequestsQueryKey(id || "") } });
  const record = useRecordEvidenceRequest();
  const { toast } = useToast();
  const [reviewer, setReviewer] = useState("");
  const [reason, setReason] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState("summary");
  const [appendixA, setAppendixA] = useState(false);
  const [appendixB, setAppendixB] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadingRequests, setDownloadingRequests] = useState(false);
  const [downloadError, setDownloadError] = useState<string>();

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setActive(visible.target.id);
    }, { rootMargin: "-12% 0px -70% 0px", threshold: [0, 0.25, 0.6] });
    sections.forEach(([section]) => { const node = document.getElementById(section); if (node) observer.observe(node); });
    return () => observer.disconnect();
  }, [app]);

  if (isLoading || !app) return <BankLayout applicationId={id}><div className="p-10 text-center text-muted-foreground">Loading report...</div></BankLayout>;
  if (!app.isReference) return <BankLayout applicationId={id}><RealScreeningWorkspace application={app} page="report" /></BankLayout>;
  const { result: caseData, inputs: referenceInputs } = caseDataForApplication(app);

  const submit = async () => {
    if (!reviewer || !reason) { toast({ title: "Missing fields", description: "Reviewer and reason are required.", variant: "destructive" }); return; }
    await record.mutateAsync({ id: id!, data: { reviewer, reason } });
    setReviewer(""); setReason(""); setOpen(false); refetch(); toast({ title: "Request recorded", description: "No email was sent." });
  };
  const downloadReport = async () => {
    if (downloading) return;
    setDownloadError(undefined);
    setDownloading(true);
    try {
      await downloadPdf(`/api/applications/${encodeURIComponent(app.id)}/memo.pdf`, `Tahaqqaq_Screening_Report_${app.id}.pdf`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "The report could not be downloaded. Please try again.";
      setDownloadError(message);
      toast({ title: "PDF unavailable", description: message, variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };
  const downloadRequestList = async () => {
    if (downloadingRequests) return;
    setDownloadError(undefined);
    setDownloadingRequests(true);
    try {
      await downloadPdf(`/api/applications/${encodeURIComponent(app.id)}/request-list.pdf`, `Tahaqqaq_Evidence_Request_List_${app.id}.pdf`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "The evidence request list could not be downloaded. Please try again.";
      setDownloadError(message);
      toast({ title: "PDF unavailable", description: message, variant: "destructive" });
    } finally {
      setDownloadingRequests(false);
    }
  };
  const source = (sourceId: string, page?: number) => <SourceChip sourceId={sourceId} page={page ? `p. ${page}` : undefined} />;
  const files = app.files || [];
  const fileGroups = [
    { label: "Used in screening", key: "screening", files: files.filter((f) => f.category === "screening"), count: REFERENCE_CASE_COUNTS.files.screening, tone: "text-[#134A38]" },
    { label: "Credit team", key: "credit", files: files.filter((f) => f.category === "credit"), count: REFERENCE_CASE_COUNTS.files.credit, tone: "text-[#2F5878]" },
    { label: "Set aside", key: "aside", files: files.filter((f) => f.category === "aside"), count: REFERENCE_CASE_COUNTS.files.setAside, tone: "text-[#5D6660]" },
  ];
  const upgradeCards = [
    ["Solar PV", referenceInputs.upgradeAmounts.solar, "good", "Goes forward once proof arrives", "Three proof gaps: recycling plan, grid approval and municipality permit."],
    ["LED lighting", referenceInputs.upgradeAmounts.led, "good", "Goes forward once proof arrives", "Line B efficiency label is still needed."],
    ["Library retrofit", referenceInputs.upgradeAmounts.library, "bad", "Sent back: falls short of the rule", `${referenceInputs.librarySavingPercent}% saving is below the ${referenceInputs.rules.energyEfficiencyMinimumPercent}% rule.`],
    ["Water fixtures", referenceInputs.upgradeAmounts.water, "warn", "Can't screen yet: data missing", "Water bills, tariff and fixture standard have not been provided."],
  ] as const;
  const checkText = (topic: string, value: unknown, used: boolean) => {
    const text = String(value);
    if (/yield/i.test(topic)) return `${Number(text).toLocaleString()} kWh/kWp a year`;
    if (/saving|reduction|coverage/i.test(topic)) return `${text}%`;
    if (/consumption|energy/i.test(topic)) return `${Number(text).toLocaleString()} kWh`;
    if (/tariff|price|cost/i.test(topic)) return `JOD ${Number(text).toLocaleString()} per kW`;
    return used ? text : text;
  };
  const missing = REFERENCE_MISSING_EVIDENCE;
  const layers = REFERENCE_CASE_DATA.compliance.layers;
  const layerName: Record<string, string> = { jngt: "Taxonomy", framework: "Bank framework", permits: "Permits and energy", bank: "Bank's own checks" };

  return <BankLayout applicationId={id}>
    <div className="mx-auto max-w-[1240px] px-4 py-5 sm:px-7 lg:px-9">
      <div className="mb-7 rounded-lg bg-[#0E3326] px-5 py-6 text-white sm:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div><p className="text-[11px] font-semibold uppercase text-[#A8D5B9] tracking-[0.06em]">Screening report</p><h1 className="font-serif font-semibold text-[30px] leading-tight tracking-[-0.01em] sm:text-[34px] mt-2">Request evidence before credit review</h1><p className="mt-2 text-sm text-[#D3CDC1]">Preliminary screening for the bank's reviewer, not a credit decision</p></div>
          <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
            <Button onClick={downloadReport} disabled={downloading || downloadingRequests} className="h-9 bg-white text-foreground hover:bg-[#F3F1EC]"><Download className="mr-2 h-4 w-4" />{downloading ? "Preparing PDF…" : "Download PDF"}</Button>
            <Button asChild variant="outline" className="h-9 border-[#8A918C] bg-transparent text-white hover:bg-white/10"><a href="#requests">Request list</a></Button>
            <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button variant="outline" className="h-9 border-[#8A918C] bg-transparent text-white hover:bg-white/10"><Send className="mr-2 h-4 w-4" />Record evidence request</Button></DialogTrigger>
              <DialogContent><DialogHeader><DialogTitle>Record evidence request</DialogTitle><DialogDescription>No email is sent; this logs the action locally.</DialogDescription></DialogHeader><Input placeholder="Reviewer name" value={reviewer} onChange={(e) => setReviewer(e.target.value)} /><Textarea placeholder="Reason / message" value={reason} onChange={(e) => setReason(e.target.value)} /><p className="text-xs text-muted-foreground"><AlertCircle className="mr-1 inline h-3 w-3" />Request only missing evidence.</p><DialogFooter><Button onClick={submit}>Record request</Button></DialogFooter></DialogContent>
            </Dialog>
          </div>
        </div>
        {downloadError && <p role="alert" className="mt-4 flex items-start gap-2 rounded-lg border border-[#C4553F] bg-[#FBEAE6] px-3 py-2 text-sm text-[#A33A27]"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{downloadError}</p>}
      </div>
      {app.isDemo && <NextPhase />}

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,860px)_220px]">
        <main className="rounded-lg bg-white p-5 sm:p-12">
          <section className="space-y-6"><SectionHeading number={1} title="Summary" id="summary" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ["Requested", money(caseData.requested), "4 upgrades"],
                ["Candidate scope", money(caseData.candidate), "Solar, LED · subject to proof"],
                ["Return or complete", money(caseData.returnCompleteScope), "Library, Water"],
                ["Annual savings", money(caseData.annualSavings), "Measured Jordanian references"],
                ["Coverage", `${caseData.coverage.savingsAt100.toFixed(1)}×`, `${caseData.coverage.savingsAt70.toFixed(1)}× at 70% · illustrative`],
                ["Impact", `${caseData.savingsMwh.toFixed(1)} MWh`, `${caseData.co2.toFixed(0)} tCO₂e a year`],
              ].map(([label, value, caption]) => <div key={label} className="rounded-xl bg-[#F3F1EC] px-4 py-4"><p className="text-[11px] font-semibold uppercase text-[#3A433E] tracking-[0.06em]">{label}</p><p className="mt-2 text-[22px] font-semibold tracking-[-0.015em] text-foreground">{value}</p><p className="mt-1 text-xs text-[#3A433E]">{caption}</p></div>)}
            </div>
            <div className="rounded-xl border-l-4 border-[#1D6346] bg-[#F3F1EC] px-5 py-4"><p className="text-xs font-semibold uppercase text-foreground tracking-[0.06em]">Next action</p><p className="mt-1 text-sm leading-6 text-[#3A433E]">Request the 8 missing documents, then have a specialist confirm candidate scope. The bank retains all eligibility and credit decisions.</p></div>
          </section>

          <section className="mt-14 space-y-6"><SectionHeading number={2} title="Scope by upgrade" id="scope" /><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{upgradeCards.map(([name, amount, tone, status, why]) => <div key={name} className="rounded-xl border border-[#E2DDD3] p-4"><p className="text-xs font-semibold uppercase text-[#3A433E] tracking-[0.06em]">{name}</p><p className="mt-2 text-xl font-semibold text-foreground">{money(amount)}</p><div className="mt-3"><Outcome tone={tone}>{status}</Outcome></div><p className="mt-3 text-xs leading-5 text-[#5D6660]">{why}</p></div>)}</div></section>

          <section className="mt-14 space-y-6"><SectionHeading number={3} title="Evidence received" id="evidence" /><p className="text-xs text-[#3A433E]">{REFERENCE_CASE_COUNTS.files.total} files: {REFERENCE_CASE_COUNTS.files.screening} screening / {REFERENCE_CASE_COUNTS.files.credit} credit / {REFERENCE_CASE_COUNTS.files.setAside} set aside.</p><div className="grid gap-4 md:grid-cols-3">{fileGroups.map((group) => <div key={group.key} className="rounded-xl border border-[#E2DDD3] bg-[#fbfdfb] p-3"><div className="flex items-center justify-between border-b border-[#EFECE5] pb-3"><p className={`text-sm font-semibold ${group.tone}`}>{group.label}</p><span className="rounded-md bg-[#EFECE5] px-2 py-0.5 text-xs font-bold text-[#3A433E]">{group.count}</span></div><div className="divide-y divide-[#EFECE5]">{group.files.map((file) => <div key={file.id} className="flex items-start gap-2 py-3"><FileText className="mt-0.5 h-4 w-4 shrink-0 text-[#5D6660]" /><div className="min-w-0"><p className="truncate text-xs font-medium text-foreground" title={file.name}>{file.name}</p>{file.quality && <span className="mt-1 inline-block rounded-md bg-[#EFECE5] px-1.5 py-0.5 text-[11px] text-[#3A433E]">{file.quality}</span>}</div></div>)}</div></div>)}</div></section>

          <section className="mt-14 space-y-6"><SectionHeading number={4} title="Data checks" id="checks" /><p className="text-xs text-[#3A433E]">{REFERENCE_CASE_COUNTS.findings.total} findings: {REFERENCE_CASE_COUNTS.findings.corrected} corrected, {REFERENCE_CASE_COUNTS.findings.conflict} conflict, {REFERENCE_CASE_COUNTS.findings.standIn} stand-in and {REFERENCE_CASE_COUNTS.findings.cannotCheck} cannot check. A matching benchmark is not a finding.</p><div className="overflow-x-auto rounded-xl border border-[#E2DDD3]"><table className="w-full min-w-[690px] text-left text-xs"><thead className="bg-[#F3F1EC] text-[11px] uppercase text-[#3A433E] tracking-[0.06em]"><tr><th className="px-4 py-3">Check</th><th className="px-4 py-3">Submitted</th><th className="px-4 py-3">Checked</th><th className="px-4 py-3">Result</th><th className="px-4 py-3">Source</th></tr></thead><tbody>{caseData.checks.map((c) => <tr key={c.id} className="border-t border-[#EFECE5]"><td className="px-4 py-3 font-medium text-[#2B3530]">{c.topic}</td><td className="px-4 py-3 text-[#3A433E]">{checkText(c.topic, c.submitted, false)}</td><td className="px-4 py-3 text-[#3A433E]">{checkText(c.topic, c.used, true)}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-[11px] font-bold ${/not|short|missing/i.test(c.result) ?"bg-[#FBEAE6] text-[#C4553F]" : "bg-[#F3F1EC] text-[#134A38]"}`}>{c.result}</span></td><td className="px-4 py-3">{c.sources.length ? <div className="flex flex-wrap gap-1">{c.sources.map((s) => <span key={`${s.sourceId}-${s.page}`}>{source(s.sourceId, s.page)}</span>)}</div> : <span className="text-[#8A918C]">Arithmetic</span>}</td></tr>)}</tbody></table></div></section>

          <section className="mt-14 space-y-6"><SectionHeading number={5} title="Compliance by layer" id="compliance" /><div className="grid gap-4 md:grid-cols-2">{layers.map((layer) => { const counts = ["Met", "Proof missing", "Not met", "Bank review"].map((outcome) => [outcome, layer.criteria.filter((c: any) => c.outcome === outcome).length] as const).filter(([, count]) => count); return <div key={layer.id} className="rounded-xl border border-[#E2DDD3] p-4"><div className="flex items-start justify-between gap-3"><h3 className="font-semibold text-foreground">{layerName[layer.id]}</h3><ShieldCheck className="h-4 w-4 text-[#5D6660]" /></div><div className="mt-3 flex flex-wrap gap-1.5">{counts.map(([label, count]) => <span key={label} className="rounded-md bg-[#F3F1EC] px-2 py-1 text-[11px] font-semibold text-[#3A433E]">{count} {label.toLowerCase()}</span>)}</div><p className="mt-4 text-xs leading-5 text-[#5D6660]">{layer.description}</p><div className="mt-2 space-y-1 text-xs text-[#3A433E]">{layer.criteria.slice(0, 2).map((c: any) => <p key={c.id}><span className="font-semibold">{c.label}:</span> {c.reason}</p>)}</div></div>; })}</div></section>

          <section className="mt-14 space-y-6"><SectionHeading number={6} title="Project analysis" id="analysis" /><div className="grid gap-5 md:grid-cols-[1fr_230px]"><div className="rounded-xl border border-[#E2DDD3] p-5"><div className="mb-5"><h3 className="font-semibold text-foreground">Project stress test</h3><p className="mt-1 text-xs text-[#5D6660]">Estimated savings coverage against an illustrative {money(caseData.loan.annuityPayment)} annual payment.</p></div>{[["100%", caseData.coverage.savingsAt100, caseData.annualSavings, "bg-[#1D6346]"], ["85%", caseData.coverage.savingsAt85, caseData.annualSavings * .85, "bg-[#2C7A57]"], ["70%", caseData.coverage.savingsAt70, caseData.annualSavings * .7, "bg-[#B7812A]"]].map(([label, coverage, savings, color]) => <div key={label} className="mb-5 last:mb-0"><div className="mb-2 flex justify-between text-xs"><span className="font-semibold text-[#2B3530]">{label} of estimate</span><span className="text-[#5D6660]">{Number(coverage).toFixed(1)}× coverage</span></div><div className="h-2 overflow-hidden rounded-full bg-[#EFECE5]"><div className={`h-full ${color}`} style={{ width: String(label) }} /></div><p className="mt-1 text-right text-[11px] text-[#5D6660]">{money(Number(savings))} savings</p></div>)}</div><div className="rounded-xl border border-[#D3CDC1] bg-[#F3F1EC] p-5"><p className="text-[11px] font-semibold uppercase text-[#5D6660] tracking-[0.06em]">Illustrative loan</p><p className="mt-3 text-2xl font-semibold text-foreground">{money(referenceInputs.loan.principalPercent * caseData.candidate)}</p><dl className="mt-4 space-y-2 text-xs text-[#3A433E]"><div className="flex justify-between"><dt>Assumed rate</dt><dd className="font-semibold">8%</dd></div><div className="flex justify-between"><dt>Term</dt><dd className="font-semibold">5 years</dd></div><div className="flex justify-between"><dt>Annual payment</dt><dd className="font-semibold">{money(caseData.loan.annuityPayment)}</dd></div></dl><p className="mt-5 border-t border-[#E2DDD3] pt-3 text-[11px] italic text-[#5D6660]">Not bank terms.</p></div></div><p className="text-xs leading-5 text-[#5D6660]">Candidate annual savings are calculated from the corrected solar benchmark and LED average, multiplied by the educational tariff ({referenceInputs.tariffJodPerKwh} JOD/kWh). Impact uses {referenceInputs.gridFactorTco2PerMwh} tCO₂e/MWh. These are project estimates, not institutional DSCR or a lending decision.</p></section>

          <section className="mt-14 space-y-6"><SectionHeading number={7} title="Evidence requests" id="requests" /><div className="grid gap-4 md:grid-cols-2"><div className="rounded-xl border border-[#E2DDD3] p-4 md:col-span-2"><h3 className="font-semibold text-foreground">Request now <span className="text-[#5D6660]">({REFERENCE_CASE_COUNTS.evidence.missing})</span></h3><div className="mt-3 grid gap-2 sm:grid-cols-2">{missing.map(([item, holder]) => <div key={item} className="flex gap-2 rounded-lg bg-[#F3F1EC] p-3 text-xs"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#1D6346]" /><div><p className="font-medium text-[#2B3530]">{item}</p><p className="mt-1 text-[#5D6660]">{holder}</p></div></div>)}</div></div><div className="rounded-xl border border-[#EBD3A3] bg-[#FBF1DC] p-4"><h3 className="font-semibold text-[#8A5A12]">Before payout <span className="text-xs font-normal">(2)</span></h3><p className="mt-3 text-xs leading-6 text-[#3A433E]">Grid-connection approval; municipality permit and electrical-safety sign-off.</p></div><div className="rounded-xl border border-[#C9D8E5] bg-[#E8EFF5] p-4"><h3 className="font-semibold text-[#2F5878]">Credit team <span className="text-xs font-normal">(4)</span></h3><p className="mt-3 text-xs leading-6 text-[#5D6660]">Legal identity; 3 years audited statements; debt schedule; governance.</p></div><div className="rounded-xl border border-[#E2DDD3] bg-[#F3F1EC] p-4 md:col-span-2"><h3 className="font-semibold text-[#5D6660]">Received, awaiting confirmation <span className="text-xs font-normal">({REFERENCE_CASE_COUNTS.evidence.toConfirm})</span></h3><p className="mt-2 text-xs text-[#8A918C]">{REFERENCE_CASE_COUNTS.evidence.toConfirm} received files are pending analyst confirmation. Do not request them again.</p></div></div><div className="flex flex-wrap items-center gap-3"><Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button><Send className="mr-2 h-4 w-4" />Record request</Button></DialogTrigger></Dialog><Button variant="link" className="h-auto px-0 text-xs font-semibold text-[#1D6346]" disabled={downloading || downloadingRequests} onClick={() => void downloadRequestList()}>{downloadingRequests ? "Preparing request list…" : "Download complete request list"} <Download className="ml-1 h-3 w-3" /></Button></div>{requests.length > 0 && <Card><CardHeader><CardTitle className="text-base">Local request history</CardTitle></CardHeader><CardContent>{requests.map((r) => <div key={r.id} className="border-t py-3 text-sm"><span className="text-muted-foreground">{format(new Date(r.createdAt), "MMM d, yyyy h:mm a")} · </span><strong>{r.reviewer}</strong><p>{r.reason}</p></div>)}</CardContent></Card>}</section>

          <section className="mt-14 space-y-6"><SectionHeading number={8} title="Limits and sources" id="limits" /><div className="grid gap-2 text-xs text-[#3A433E] sm:grid-cols-2"><p><AlertCircle className="mr-2 inline h-4 w-4 text-[#B7812A]" />Bills, baselines, labels, permits and audited financials are incomplete.</p><p><LockKeyhole className="mr-2 inline h-4 w-4 text-[#5D6660]" />Assumptions are intermediate screening inputs, not proof.</p><p><Paperclip className="mr-2 inline h-4 w-4 text-[#5D6660]" />Project estimates do not establish borrower repayment capacity.</p><p><X className="mr-2 inline h-4 w-4 text-[#C4553F]" />Preliminary screening does not make a lending decision.</p></div><div className="grid gap-3 sm:grid-cols-2">{Object.values(sourceRegister).map((s) => <div key={s.id} className="rounded-xl border border-[#E2DDD3] p-4"><span className="rounded bg-[#EFECE5] px-2 py-1 text-[11px] font-bold text-foreground">{s.id}</span><h3 className="mt-3 text-sm font-semibold text-[#2B3530]">{s.title}</h3><p className="mt-1 text-xs text-[#5D6660]">{s.publisher} · {s.date}</p></div>)}</div></section>

          <section className="mt-14 border-t border-[#E2DDD3] pt-5"><button onClick={() => setAppendixA(!appendixA)} className="flex w-full items-center justify-between text-left text-sm font-semibold text-foreground"><span>Appendix A · Show quoted passages</span><ChevronDown className={`h-4 w-4 transition-transform ${appendixA ? "rotate-180" : ""}`} /></button>{appendixA && <div className="mt-5 space-y-4">{Object.values(sourceRegister).flatMap((s) => s.passages.map((p, i) => { const summary = summaryPassages.has(`${s.id}:${p.page || ""}`); return <div key={`${s.id}-${i}`} className="border-l-2 border-[#8A918C] pl-4 text-sm text-[#3A433E]"><p>{summary ? p.quote.replace(/^Summary:\s*/i, "") : `“${p.quote}”`}</p><p className="mt-1 text-xs text-[#5D6660]">{summary ? "Summary" : "Quoted passage"} · {s.id}{p.page ? ` p.${p.page}` : p.range ? ` (${p.range})` : ""}</p></div>; }))}</div>}</section>
          <section className="mt-5 border-t border-[#E2DDD3] pt-5"><button onClick={() => setAppendixB(!appendixB)} className="flex w-full items-center justify-between text-left text-sm font-semibold text-foreground"><span>Appendix B · Show record of changes</span><ChevronDown className={`h-4 w-4 transition-transform ${appendixB ? "rotate-180" : ""}`} /></button>{appendixB && <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-[#3A433E]"><li>Reference inputs and source register loaded from the research library.</li><li>Supplier claims corrected or labelled as stand-ins during screening.</li><li>Evidence request history is retained locally and is not an email workflow.</li></ul>}</section>
        </main>
        <aside className="hidden lg:block"><div className="sticky top-6 rounded-xl border border-[#E2DDD3] bg-white p-4"><p className="text-xs font-semibold uppercase text-[#3A433E] tracking-[0.06em]">In this report</p><nav className="mt-4 space-y-1">{sections.map(([section, label], i) => <a key={section} href={`#${section}`} className={`block rounded-md px-2 py-2 text-xs transition-colors ${active === section ?"bg-[#EFECE5] font-semibold text-[#134A38]" : "text-[#5D6660] hover:bg-[#F3F1EC] hover:text-[#134A38]"}`}>{i + 1}. {label}</a>)}</nav><div className="mt-4 border-t border-[#EFECE5] pt-3 text-[11px] leading-4 text-[#8A918C]">Appendices are available below the report sections.</div></div></aside>
      </div>
      <footer className="px-2 py-8 text-xs text-[#5D6660]">Synthetic reference case, not a real record. Preliminary screening, not a lending decision.</footer>
    </div>
  </BankLayout>;
}
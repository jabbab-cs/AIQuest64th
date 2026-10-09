import { BankLayout } from "@/components/layout/Shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Link, useRoute } from "wouter";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useGetApplication, getGetApplicationQueryKey, useRecordEvidenceRequest } from "@tahaqqaq/api-client";
import { StatusBadge } from "@/components/ui/source-chip";
import { Activity, ArrowRight, Check, CircleAlert, FileText, Send, X } from "lucide-react";
import { caseDataForApplication } from "@/data/reference-data";
import { REFERENCE_CASE_COUNTS } from "@/data/case-counts";
import { useToast } from "@/hooks/use-toast";
import { RealScreeningWorkspace } from "@/components/bank/RealScreeningWorkspace";

const screeningSteps = [
  "Files received (16)",
  "Duplicates and unreadable files set aside",
  "Claims checked against sources",
  "Rules checked in 4 layers",
  "Savings and route calculated",
];

export default function Overview() {
  const [, params] = useRoute("/bank/:id/overview");
  const id = params?.id;
  const { data: app, isLoading } = useGetApplication(id || "", {
    query: { enabled: !!id, queryKey: getGetApplicationQueryKey(id || "") }
  });
  const queryClient = useQueryClient();
  const recordEvidenceRequest = useRecordEvidenceRequest();
  const { toast } = useToast();
  const [requestOpen, setRequestOpen] = useState(false);
  const [reviewer, setReviewer] = useState("");
  const [reason, setReason] = useState("");
  const [screening, setScreening] = useState(app?.isDemo && app.status === "New");
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!app?.isDemo || app.status !== "New") { setScreening(false); return; }
    setScreening(true);
    setStep(0);
    const timer = window.setInterval(() => setStep(value => Math.min(value + 1, screeningSteps.length)), 700);
    const finish = window.setTimeout(async () => {
      window.clearInterval(timer);
      await fetch(`/api/applications/${app.id}/complete-screening`, { method: "POST" });
      await queryClient.invalidateQueries();
      setScreening(false);
    }, 3900);
    return () => { window.clearInterval(timer); window.clearTimeout(finish); };
  }, [app?.id, app?.isDemo, app?.status, queryClient]);

  if (isLoading || !app) {
    return (
      <BankLayout applicationId={id}>
        <div className="p-10 text-center text-muted-foreground">Loading overview...</div>
      </BankLayout>
    );
  }
  if (screening) return (
    <BankLayout applicationId={id}>
      <div className="mx-auto max-w-[760px] p-8 md:p-16">
        <Card className="border-primary/20"><CardContent className="p-8 md:p-12">
          <div className="mb-2 text-[11px] font-semibold uppercase text-primary tracking-[0.06em]">Screening in progress</div>
          <h1 className="font-serif font-semibold text-[30px] leading-tight tracking-[-0.01em] sm:text-[34px] mb-2">Checking the evidence</h1>
          <p className="mb-8 text-sm text-muted-foreground">Tahaqqaq is comparing this submission with the supplied sources and bank rules.</p>
          <div className="space-y-4">
            {screeningSteps.map((label, index) => (
              <div key={label} className={`flex items-center gap-3 text-sm ${index < step ? "text-primary" : "text-muted-foreground"}`}>
                <span className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs font-bold ${index < step ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
                  {index < step ? "✓" : index + 1}
                </span>{label}
              </div>
            ))}
          </div>
        </CardContent></Card>
      </div>
    </BankLayout>
  );

  if (app.isReference) {
    const data = caseDataForApplication(app);
    const m = data.metrics;
    const money = (value: number) => `JOD ${Math.round(value).toLocaleString()}`;
    const counts = REFERENCE_CASE_COUNTS;
    const sendEvidenceRequest = async () => {
      if (!reviewer || !reason) {
        toast({ title: "Missing fields", description: "Reviewer and reason are required.", variant: "destructive" });
        return;
      }
      await recordEvidenceRequest.mutateAsync({ id: app.id, data: { reviewer, reason } });
      setReviewer("");
      setReason("");
      setRequestOpen(false);
      toast({ title: "Request recorded", description: "No email was sent." });
    };
    return (
      <BankLayout applicationId={id}>
        <div className="mx-auto max-w-[1200px] space-y-5 px-4 py-6 sm:px-8 sm:py-8">
          <div className="flex items-center justify-between pb-1">
            <div>
              <h1 className="font-serif font-semibold text-[30px] leading-tight tracking-[-0.01em] sm:text-[34px] mb-2 text-foreground">{app.title}</h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <span className="font-medium">{app.university}{app.institutionType && <span className="font-normal"> · {app.institutionType}</span>}</span>
                {app.location && <><span>•</span><span>{app.location}</span></>}
                <span>•</span>
                <StatusBadge status={app.status} />
              </div>
            </div>
          </div>
          
          <Card className="overflow-hidden border-none bg-[#0E3326] text-white">
            <CardContent className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-12">
              <div>
                <p className="text-[11px] font-semibold uppercase text-[#A8D5B9] tracking-[0.06em]">Screening verdict</p>
                <h2 className="mt-3 font-serif text-3xl font-semibold leading-tight tracking-[-0.015em] sm:text-[40px]">Not ready for credit review yet</h2>
                <p className="mt-4 max-w-2xl text-sm leading-6 text-[#E2DDD3]">Solar and LED ({money(m.candidateScope)}) can go forward once {counts.evidence.missing} missing documents arrive. Library and water ({money(m.returnCompleteScope)}) go back to the institution.</p>
                <p className="mt-7 text-xs leading-5 text-[#D3CDC1]">Preliminary screening. Credit scoring and the final green decision stay with the bank.</p>
                <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
                  <DialogTrigger asChild>
                    <Button className="mt-5 bg-[#EFECE5] text-foreground hover:bg-white"><Send className="mr-2 h-4 w-4" />Send evidence request to institution</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Record evidence request</DialogTitle><DialogDescription>No email is sent; this logs the action locally.</DialogDescription></DialogHeader>
                    <Input placeholder="Reviewer name" value={reviewer} onChange={(event) => setReviewer(event.target.value)} />
                    <Textarea placeholder="Reason / message" value={reason} onChange={(event) => setReason(event.target.value)} />
                    <DialogFooter><Button onClick={sendEvidenceRequest} disabled={recordEvidenceRequest.isPending}>Record request</Button></DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="space-y-3 self-center">
                <div className="flex gap-3 rounded-lg border border-[#5D6660]/45 bg-white/[0.07] p-3 text-sm"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[#A8D5B9]" /><span>Goes forward: Solar PV, LED lighting · {money(m.candidateScope)}</span></div>
                <div className="flex gap-3 rounded-lg border border-[#5D6660]/45 bg-white/[0.07] p-3 text-sm"><X className="mt-0.5 h-4 w-4 shrink-0 text-[#EFC2B8]" /><span>Sent back: Library retrofit (saves 14%, the rule needs 20%)</span></div>
                <div className="flex gap-3 rounded-lg border border-[#5D6660]/45 bg-white/[0.07] p-3 text-sm"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#B7812A]" /><span>Can&apos;t screen yet: Water fixtures (no bills)</span></div>
              </div>
            </CardContent>
          </Card>
          <div className="grid gap-3 md:grid-cols-3">
            <WhyCard href={`/bank/${id}/files`} title="Is the file complete?" answer={<><strong className="text-[#C4553F]">No.</strong> {counts.evidence.missing} documents missing, {counts.evidence.toConfirm} received files to confirm.</>} link="Files" />
            <WhyCard href={`/bank/${id}/data-checks`} title="Are the numbers credible?" answer={<><strong className="text-[#8A5A12]">Partly.</strong> 2 supplier claims corrected (solar yield 1,800 → 1,639; LED saving 70% → 50%), 1 chart conflict, 2 claims can&apos;t be checked yet.</>} link="Data checks" />
            <WhyCard href={`/bank/${id}/compliance`} title="Does it meet the rules?" answer={<><strong className="text-[#8A5A12]">Not yet.</strong> The library misses the 20% rule; {counts.evidence.proofGaps} proofs are missing across {counts.evidence.ruleLayers} rule layers.</>} link="Compliance" />
          </div>
          <Card className="border-[#E2DDD3] bg-[#F3F1EC]">
            <CardContent className="flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm leading-6 text-[#2B3530]">If the proof arrives: savings of {money(m.estimatedSavings)} a year cover an illustrative {money(m.basePayment)} payment {data.result.coverage.savingsAt100.toFixed(1)} times ({data.result.coverage.savingsAt70.toFixed(1)} times if savings fall 30%). Project economics only, not the institution&apos;s repayment capacity.</p>
              <Link href={`/bank/${id}/analysis`} className="shrink-0 text-sm font-semibold text-primary hover:underline">See analysis <ArrowRight className="inline h-4 w-4" /></Link>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="p-5 sm:p-6">
              <p className="text-[11px] font-semibold uppercase text-muted-foreground tracking-[0.06em]">Next steps</p>
              <ol className="mt-4 grid gap-4 md:grid-cols-3">
                <li className="flex gap-3 text-sm leading-5"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#EFECE5] text-xs font-bold text-primary">1</span><span>Request the {counts.evidence.missing} missing documents (list by holder in Files).</span></li>
                <li className="flex gap-3 text-sm leading-5"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#EFECE5] text-xs font-bold text-primary">2</span><span>Confirm the {counts.evidence.toConfirm} received files.</span></li>
                <li className="flex gap-3 text-sm leading-5"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#EFECE5] text-xs font-bold text-primary">3</span><span>Specialist reviews the candidate scope of {money(m.candidateScope)}.</span></li>
              </ol>
            </CardContent>
          </Card>
        </div>
      </BankLayout>
    );
  }

  return <BankLayout applicationId={id}><RealScreeningWorkspace application={app} page="overview" /></BankLayout>;
}

function WhyCard({ href, title, answer, link }: { href: string; title: string; answer: React.ReactNode; link: string }) {
  return <Link href={href} className="group block h-full">
    <Card className="h-full border-border transition-all hover:border-primary/40">
      <CardContent className="p-5">
        <p className="text-xs font-semibold uppercase text-muted-foreground tracking-[0.06em]">{title}</p>
        <p className="mt-3 text-sm leading-6 text-foreground">{answer}</p>
        <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary">{link} <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" /></span>
      </CardContent>
    </Card>
  </Link>;
}

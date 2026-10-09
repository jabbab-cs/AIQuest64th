import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { PublicTopBar } from "@/components/layout/Shell";
import {
  ArrowDownRight,
  ArrowRight,
  Check,
  FileSearch,
  GitBranch,
  Grid2X2,
  Network,
  ScanText,
} from "lucide-react";

const processMoves = [
  ["01", "Receive the application", "One place for the project description, forecasts, studies, quotations and approvals.", ArrowDownRight, false],
  ["02", "Make sense of the file", "Sort received evidence, expose missing or unusable files and trace important figures.", Grid2X2, true],
  ["03", "Screen what matters", "Check relevant taxonomy criteria, bank framework rules, permits and project economics.", Network, false],
  ["04", "Give the reviewer a route", "Show findings and next request before the bank starts credit scoring.", ArrowRight, false],
] as const;

const aiMoves = [
  ["Reads every file", "Says what each PDF is, which requirement it answers and whether it really does: a receipt is not an approval, and a 2019 bill is not a baseline.", "The quoted sentence must be found on the page.", ScanText],
  ["Maps each upgrade", "Suggests the green-taxonomy activity and the proof each upgrade needs, shown next to our own mapping as agrees or differs.", "Unknown activities and rules are thrown out.", GitBranch],
  ["Drafts the recommendation", "Writes a short case for the reviewer: what supports the file, what risks it, and what would change the result.", "It can disagree with the rules, but it never changes the route.", FileSearch],
] as const;

const futureModels = [
  ["Savings that really arrive", "Learns how much of a promised saving actually shows up, by upgrade type. Jordan's earlier efficiency plans delivered 40% and 46% of their targets, so this is the number lenders need."],
  ["Document sorting in-house", "A small model trained on analysts' corrections, so a bank can run it on its own servers."],
  ["Files likely to need rework", "Flags files that may need another round, so analysts start there. It ranks work; it never decides."],
] as const;

const eyebrow = "text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground";
const tag = "rounded border border-border bg-card px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground";

export default function Landing() {
  return (
    <div className="flex min-h-screen flex-col bg-background" data-testid="page-landing">
      <PublicTopBar />
      <main className="flex-1">
        <section className="border-b">
          <div className="mx-auto max-w-[1240px] px-6 py-16 md:py-24">
            <div className="grid items-center gap-12 lg:grid-cols-[1fr_minmax(0,520px)] lg:gap-16">
              <div>
                <p className={`flex flex-wrap items-center gap-2 ${eyebrow}`}>AI-ASSISTED PRE-CREDIT GREEN FINANCE SCREENING <span className={tag}>CONCEPT</span></p>
                <h1 className="mt-5 max-w-[640px] font-serif text-[44px] font-semibold leading-[1.04] tracking-[-0.02em] text-foreground md:text-[60px]" data-testid="text-hero-heading">From scattered files to a decision-ready review.</h1>
                <p className="mt-6 max-w-[560px] text-[17px] leading-[1.65] text-muted-foreground">Tahaqqaq gives green-loan teams a clear first pass on projects from any private institution (a university, school, hospital, hotel, factory or company): the evidence, the checks, the gaps and the next action. Once the bank approves, the installer verifies delivery and switch-on with a phone, and the loan is released in two payments.</p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Link href="/bank" data-testid="link-bank-workspace"><Button size="lg" className="h-11 w-full px-5 text-sm font-semibold sm:w-auto">Open bank workspace <ArrowRight className="h-4 w-4" /></Button></Link>
                  <Link href="/institution" data-testid="link-institution-portal"><Button variant="outline" size="lg" className="h-11 w-full px-5 text-sm font-semibold sm:w-auto">Submit a project <ArrowRight className="h-4 w-4" /></Button></Link>
                </div>
                <p className="mt-3 flex flex-wrap items-center gap-x-1.5 text-[13px] text-muted-foreground"><span>Installing equipment for an approved project?</span><Link href="/site" className="inline-flex min-h-11 items-center font-semibold text-primary underline-offset-4 hover:underline" data-testid="link-installer">I&apos;m the installer</Link></p>
                <ol className="mt-8 flex flex-wrap items-center gap-x-2 gap-y-2 text-[13px] font-medium text-foreground" data-testid="list-hero-workflow">
                  {["AI reads", "Rules check", "Code calculates", "The bank decides", "Site checks release payment"].map((item, index) => <li key={item} className="flex items-center gap-2"><span className="rounded-md border bg-card px-2.5 py-1">{item}</span>{index < 4 && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/60" aria-hidden="true" />}</li>)}
                </ol>
                <p className="mt-6 max-w-[560px] border-l-2 border-brass/60 pl-3 text-[13px] leading-[1.55] text-muted-foreground">Screening prepares the case. Bank staff make the credit and final green decisions. AI reading is planned; new uploads are not automatically screened.</p>
              </div>

              <div className="rounded-xl border bg-secondary/60 p-4 sm:p-6" data-testid="illustration-evidence-constellation">
                <div className="rounded-lg border bg-card">
                  <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
                    <div>
                      <p className={eyebrow}>SCREENING FILE</p>
                      <p className="mt-1 font-serif text-[24px] font-semibold leading-tight text-foreground">Evidence connected.</p>
                    </div>
                    <div className="pt-1 text-right">
                      <div className="flex justify-end gap-1" aria-hidden="true"><span className="h-1.5 w-6 rounded-full bg-accent" /><span className="h-1.5 w-6 rounded-full bg-brass" /><span className="h-1.5 w-6 rounded-full bg-accent" /></div>
                      <p className="mt-2 text-[12px] text-muted-foreground">Sources · rules · findings</p>
                    </div>
                  </div>
                  <dl className="grid grid-cols-2">
                    {[
                      ["SOLAR FORECAST", "1,800", "kWh/kWp/year", "border-r border-b"],
                      ["FEASIBILITY", "JOD 553k", "project cost", "border-b"],
                      ["AI READ · GRID FILE", "Receipt, not approval", "Sentence found on page 1 ✓", "border-r"],
                      ["REVIEW ROUTE", "Request evidence", "Before credit review", ""],
                    ].map(([label, value, caption, border]) => (
                      <div key={label} className={`px-5 py-4 ${border}`}>
                        <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{label}</dt>
                        <dd className="mt-2 text-[18px] font-semibold leading-tight text-foreground">{value}</dd>
                        <dd className="mt-1 text-[12px] text-muted-foreground">{caption}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b py-16 md:py-24">
          <div className="mx-auto max-w-[1240px] px-6">
            <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><p className={eyebrow}>THE PRODUCT PIPELINE</p><h2 className="mt-3 font-serif text-[30px] font-semibold leading-tight tracking-[-0.01em] text-foreground md:text-[36px]">Four clear moves. One traceable case.</h2></div><p className="max-w-[300px] text-[14px] leading-[1.55] text-muted-foreground">Each handoff keeps the source and the uncertainty visible, so specialists can focus on exceptions.</p></div>
            <ol className="grid grid-cols-1 border-t md:grid-cols-2 lg:grid-cols-4">{processMoves.map(([number, title, description, Icon, pale]) => <li key={number} className={`border-b px-1 py-6 md:px-5 lg:border-b-0 lg:border-r lg:last:border-r-0 lg:first:pl-0 ${pale ? "lg:bg-secondary/50" : ""}`} data-testid={`card-process-${number}`}><div className="flex items-center justify-between"><span className="font-mono text-[13px] text-muted-foreground">{number}</span><Icon className="h-4 w-4 text-accent" aria-hidden="true" /></div><h3 className="mt-8 text-[17px] font-semibold text-foreground">{title}</h3><p className="mt-2 text-[14px] leading-[1.6] text-muted-foreground">{description}</p></li>)}</ol>
          </div>
        </section>

        <section className="border-b bg-secondary/40 py-16 md:py-24">
          <div className="mx-auto max-w-[1240px] px-6">
            <div className="mb-10 max-w-[720px]"><div className="flex items-center gap-2"><p className={eyebrow}>AI IN THE WORKFLOW</p><span className={tag}>Planned concept</span></div><h2 className="mt-3 font-serif text-[30px] font-semibold leading-tight tracking-[-0.01em] text-foreground md:text-[40px]">AI reads the pile. Code checks every word.</h2><p className="mt-4 text-[16px] leading-[1.6] text-muted-foreground">A language model does the reading an analyst would do. Nothing it suggests counts until code has found it in the document and a person has confirmed it.</p></div>
            <div className="grid gap-4 md:grid-cols-3">{aiMoves.map(([title, description, footer, Icon]) => <article key={title} className="flex flex-col rounded-lg border bg-card p-6" data-testid={`card-ai-${title.toLowerCase().replaceAll(" ", "-")}`}><Icon className="h-5 w-5 text-accent" aria-hidden="true" /><h3 className="mt-6 text-[18px] font-semibold text-foreground">{title}</h3><p className="mt-2 text-[14px] leading-[1.6] text-muted-foreground">{description}</p><div className="mt-auto flex gap-2 border-t pt-4 text-[13px] font-medium leading-[1.45] text-foreground" style={{ marginTop: "auto" }}><Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" /><span>{footer}</span></div></article>)}</div>
            <ol className="mt-4 grid gap-px overflow-hidden rounded-lg border border-[#0E3326] bg-white/10 md:grid-cols-4" data-testid="panel-ai-handovers">{[["AI reads", "language model"], ["Rules check compliance", "quoted sources"], ["Code calculates the money", "exact arithmetic"], ["The bank decides", "credit and E&S teams"]].map(([label, caption], index) => <li key={label} className="flex items-center justify-between gap-3 bg-[#0E3326] px-5 py-4 text-white"><div><p className="text-[14px] font-semibold">{label}</p><p className="mt-0.5 text-[12px] text-white/60">{caption}</p></div>{index < 3 && <ArrowRight className="hidden h-4 w-4 shrink-0 text-white/40 md:block" aria-hidden="true" />}</li>)}</ol>
          </div>
        </section>

        <section className="py-16 md:py-20">
          <div className="mx-auto max-w-[1240px] px-6"><div className="mb-10"><p className={eyebrow}>NEXT: MODELS TRAINED ON REAL OUTCOMES</p><h2 className="mt-3 font-serif text-[30px] font-semibold leading-tight tracking-[-0.01em] text-foreground md:text-[40px]">What the data teaches next.</h2></div><div className="grid gap-4 md:grid-cols-3">{futureModels.map(([title, description]) => <article key={title} className="rounded-lg border bg-card p-6" data-testid={`card-future-${title.toLowerCase().replaceAll(" ", "-")}`}><span className={tag}>Next</span><h3 className="mt-5 text-[17px] font-semibold text-foreground">{title}</h3><p className="mt-2 text-[14px] leading-[1.6] text-muted-foreground">{description}</p></article>)}</div><p className="mt-5 text-[13px] text-muted-foreground">Trained only on permissioned, labelled cases, and tested against simple rules before we claim it helps.</p></div>
        </section>

        <section className="pb-16 md:pb-20"><div className="mx-auto max-w-[1240px] px-6"><div className="grid gap-6 rounded-xl bg-[#0E3326] p-6 md:grid-cols-[1fr_1.4fr] md:items-center md:p-10"><div><p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#A8D5B9]">TWO SIDES. ONE APPLICATION.</p><h2 className="mt-3 font-serif text-[28px] font-semibold leading-tight text-white md:text-[32px]">A simpler submission. A sharper first review.</h2></div><div className="grid gap-3 sm:grid-cols-2"><Link href="/institution" data-testid="link-closing-institution" className="group flex items-center justify-between gap-3 rounded-lg border border-white/15 px-4 py-4 text-white transition-colors hover:bg-white/[0.06]"><span><span className="block text-[14px] font-semibold">For institutions</span><span className="mt-1 block text-[13px] text-white/65">Describe the project and send its files.</span></span><ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" /></Link><Link href="/bank" data-testid="link-closing-bank" className="group flex items-center justify-between gap-3 rounded-lg border border-white/15 px-4 py-4 text-white transition-colors hover:bg-white/[0.06]"><span><span className="block text-[14px] font-semibold">For bank teams</span><span className="mt-1 block text-[13px] text-white/65">See every application, then review the case.</span></span><ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" /></Link></div></div></div></section>
      </main>
    </div>
  );
}

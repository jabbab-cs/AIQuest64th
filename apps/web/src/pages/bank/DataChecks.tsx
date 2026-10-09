import { BankLayout } from "@/components/layout/Shell";
import { Card, CardContent } from "@/components/ui/card";
import { useRoute } from "wouter";
import { useGetApplication, getGetApplicationQueryKey } from "@tahaqqaq/api-client";
import { SourceChip } from "@/components/ui/source-chip";
import { Activity, ArrowRight, ArrowUpDown, CircleHelp, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { caseDataForApplication } from "@/data/reference-data";
import { REFERENCE_CASE_COUNTS } from "@/data/case-counts";
import { RealScreeningWorkspace } from "@/components/bank/RealScreeningWorkspace";

type Source = { sourceId: string; page?: string; quote?: string };

function EvidenceSources({ sources }: { sources: Source[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {sources.map((source, index) => (
        <SourceChip
          key={`${source.sourceId}-${source.page || index}`}
          sourceId={source.sourceId}
          page={source.page}
          quote={source.quote}
        />
      ))}
    </div>
  );
}

function FindingCard({
  title,
  status,
  submitted,
  checked,
  narrative,
  sources,
  cannotCheck = false,
}: {
  title: string;
  status: "corrected" | "conflict" | "stand in" | "cannot check";
  submitted: string;
  checked: string;
  narrative: string;
  sources: Source[];
  cannotCheck?: boolean;
}) {
  return (
    <Card className="overflow-hidden border-[#E2DDD3] bg-white">
      <CardContent className="p-4 sm:p-5">
        <div className="mb-3 flex items-start justify-between gap-3"> <div className={`flex h-7 w-7 items-center justify-center rounded-md ${cannotCheck ?"bg-[#FBF1DC] text-[#8A5A12]" : "bg-[#FBF1DC] text-[#B7812A]"}`}>
            {cannotCheck ? <CircleHelp className="h-4 w-4" /> : <ArrowUpDown className="h-4 w-4" />}
          </div>
          <span className="rounded-md bg-[#FBF1DC] px-2 py-1 text-[11px] font-bold lowercase leading-none text-[#8A5A12]">
            {status}
          </span>
        </div>
        <h3 className="text-[13px] font-bold tracking-[-0.015em] text-foreground">{title}</h3>
        <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="min-w-0 rounded-md bg-[#F3F1EC] px-3 py-2.5">
            <div className="text-[11px] font-semibold uppercase text-[#5D6660] tracking-[0.06em]">Submitted</div>
            <div className="mt-1 break-words text-[12px] font-bold text-[#2B3530]" data-testid={`value-submitted-${title}`}>
              {submitted === "—" ? <Minus className="h-4 w-4 text-[#8A918C]" /> : submitted}
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-[#D3CDC1]" />
          <div className="min-w-0 rounded-md bg-[#F3F1EC] px-3 py-2.5">
            <div className="text-[11px] font-semibold uppercase text-[#5D6660] tracking-[0.06em]">Checked</div>
            <div className="mt-1 break-words text-[12px] font-bold text-foreground" data-testid={`value-checked-${title}`}>
              {checked === "—" ? <Minus className="h-4 w-4 text-[#8A918C]" /> : checked}
            </div>
          </div>
        </div>
        <p className="mt-3 min-h-[42px] text-[11px] leading-[1.45] text-[#5D6660]">{narrative}</p>
        <div className="mt-1">
          <EvidenceSources sources={sources} />
        </div>
      </CardContent>
    </Card>
  );
}

export default function DataChecks() {
  const [, params] = useRoute("/bank/:id/data-checks");
  const id = params?.id;
  const { data: app, isLoading } = useGetApplication(id || "", {
    query: { enabled: !!id, queryKey: getGetApplicationQueryKey(id || "") },
  });

  if (isLoading || !app) {
    return (
      <BankLayout applicationId={id}>
        <div className="p-10 text-center text-muted-foreground">Loading checks...</div>
      </BankLayout>
    );
  }

  if (!app.isReference) {
    return <BankLayout applicationId={id}><RealScreeningWorkspace application={app} page="checks" /></BankLayout>;
  }

  const { result, inputs, metrics } = caseDataForApplication(app);
  const solarSources = [{ sourceId: "S10", page: "p. 1" }];
  const campusSources = [{ sourceId: "S10", page: "p. 1" }, { sourceId: "S17", page: "p. 5" }];
  const cards = [
    {
      title: "Solar output per kW a year", status: "corrected" as const,
      submitted: `${inputs.solar.claimedYieldKwhPerKwp.toLocaleString()} kWh/kWp/year`,
      checked: `${result.solarYield.toLocaleString()} kWh/kWp/year`,
      narrative: `The supplier claims ${inputs.solar.claimedYieldKwhPerKwp.toLocaleString()} kWh per kWp a year: ${result.solarYieldPercentAbove.toFixed(1)}% above the Jordanian plant benchmark. The case uses ${result.solarYield.toLocaleString()}.`,
      sources: solarSources,
    },
    {
      title: "LED saving", status: "corrected" as const,
      submitted: (inputs.led.claimedSavingPercent / 100).toFixed(2),
      checked: (result.ledSavingPercent / 100).toFixed(2),
      narrative: `The supplier claims ${inputs.led.claimedSavingPercent}% saving, above the national LED programme's average of ${result.ledSavingPercent}%. The case uses the average.`,
      sources: [{ sourceId: "S12", page: "p. 91" }],
    },
    {
      title: "Lighting share of campus electricity", status: "conflict" as const,
      submitted: (inputs.lightingSharePrintedPercent / 100).toFixed(3),
      checked: (inputs.lightingShareNumerator / inputs.lightingShareDenominator).toFixed(2),
      narrative: `Figure 1 prints ${inputs.lightingSharePrintedPercent}% lighting, but its slice arithmetic is ${inputs.lightingShareNumerator}% of the pie. The check uses the arithmetic share; confirm it against the university's own sub-metering.`,
      sources: [{ sourceId: "S10", page: "p. 1" }],
    },
    {
      title: "Campus electricity use and price", status: "stand in" as const,
      submitted: "—",
      checked: `${(inputs.campusElectricityMwh * 1000).toLocaleString()} kWh`,
      narrative: `Until bills arrive, the published campus profile stands in and the file says so. Reliable data is missing, so this is a reasonable intermediate assumption; the solar-price publication is still pending.`,
      sources: [...campusSources, { sourceId: "S13" }],
    },
    {
      title: "Library saving, whole building", status: "cannot check" as const,
      submitted: (inputs.librarySavingPercent / 100).toFixed(2),
      checked: "—",
      narrative: `The file claims ${inputs.librarySavingPercent}% for the library, but the whole-building energy baseline and adjusted bills needed to test the ${inputs.rules.energyEfficiencyMinimumPercent}% rule are missing.`,
      sources: [],
      cannotCheck: true,
    },
    {
      title: "Water saving", status: "cannot check" as const,
      submitted: (inputs.waterSavingPercent / 100).toFixed(2),
      checked: "—",
      narrative: `The file claims ${inputs.waterSavingPercent}% water saving, but fixture standards, product labels and a measured baseline were not supplied. The claim cannot be checked yet.`,
      sources: [],
      cannotCheck: true,
    },
  ];

  return (
    <BankLayout applicationId={id}>
      <div className="mx-auto max-w-[1200px] px-4 py-6 sm:p-8">
        <div className="mb-6">
          <h1 className="font-serif font-semibold text-[30px] leading-tight tracking-[-0.01em] sm:text-[34px] text-foreground">Data checks</h1>
          <p className="text-[11px] text-[#5D6660]" data-testid="text-university">{app.university}</p>
        </div>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[17px] font-bold tracking-[-0.015em] text-foreground">Focus on the differences.</h2>
            <p className="mt-1 text-[11px] text-[#5D6660]">Source-linked checks show where a claim differs or cannot yet be verified.</p>
          </div>
          <Badge className="rounded-md bg-[#FBF1DC] px-2.5 py-1 text-[11px] font-bold text-[#8A5A12] hover:bg-[#FBF1DC]">{REFERENCE_CASE_COUNTS.findings.total} findings · {REFERENCE_CASE_COUNTS.findings.corrected} corrected · {REFERENCE_CASE_COUNTS.findings.conflict} conflict · {REFERENCE_CASE_COUNTS.findings.standIn} stand-in · {REFERENCE_CASE_COUNTS.findings.cannotCheck} cannot check</Badge>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {cards.map((card) => <FindingCard key={card.title} {...card} />)}
        </div>

        <Card className="mt-5 border-[#E2DDD3]">
          <CardContent className="p-0">
            <div className="border-b bg-secondary/30 px-5 py-4"><h3 className="text-sm font-semibold">Values read from submitted PDFs</h3></div>
            <div className="space-y-4 p-5">
              <div className="flex flex-col justify-between gap-4 rounded-lg border border-border bg-white p-4 sm:flex-row sm:items-center">
                <div><div className="mb-1 flex items-center gap-2"><span className="text-lg font-semibold">{result.solarYieldClaim.toLocaleString()} kWh/kWp/year</span><Badge variant="outline" className="text-[11px] font-normal uppercase tracking-[0.06em]">Unconfirmed</Badge></div><div className="text-sm text-muted-foreground">Solar forecast yield</div></div>
                <SourceChip sourceId="Solar_generation_forecast_2026.pdf" title="Solar supplier forecast" />
              </div>
              <div className="flex flex-col justify-between gap-4 rounded-lg border border-border bg-white p-4 sm:flex-row sm:items-center">
                <div><div className="mb-1 flex items-center gap-2"><span className="text-lg font-semibold">JOD {metrics.totalRequested.toLocaleString()}</span><Badge variant="outline" className="text-[11px] font-normal uppercase tracking-[0.06em]">Unconfirmed</Badge></div><div className="text-sm text-muted-foreground">Feasibility study total</div></div>
                <SourceChip sourceId="Campus_energy_feasibility_study.pdf" page="Page 1" title="Feasibility study" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </BankLayout>
  );
}
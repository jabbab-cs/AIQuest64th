import { BankLayout } from "@/components/layout/Shell";
import { Card, CardContent } from "@/components/ui/card";
import { useRoute } from "wouter";
import { useGetApplication, getGetApplicationQueryKey } from "@workspace/api-client-react";
import { caseDataForApplication } from "@/data/reference-data";
import { Activity, Leaf, Zap, BarChart3, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SourceChip } from "@/components/ui/source-chip";
import { RealScreeningWorkspace } from "@/components/bank/RealScreeningWorkspace";

export default function Analysis() {
  const [, params] = useRoute("/bank/:id/analysis");
  const id = params?.id;
  const { data: app, isLoading } = useGetApplication(id || "", {
    query: { enabled: !!id, queryKey: getGetApplicationQueryKey(id || "") }
  });

  if (isLoading || !app) {
    return (
      <BankLayout applicationId={id}>
        <div className="p-10 text-center text-muted-foreground">Loading analysis...</div>
      </BankLayout>
    );
  }

  if (!app.isReference) {
    return <BankLayout applicationId={id}><RealScreeningWorkspace application={app} page="analysis" /></BankLayout>;
  }

  const { metrics: m, result } = caseDataForApplication(app);
  const formatJod = (value: number) => `JOD ${Math.round(value).toLocaleString()}`;

  return (
    <BankLayout applicationId={id}>
      <div className="mx-auto max-w-[1200px] space-y-8 px-4 py-8 sm:px-8">
        <div className="">
          <h1 className="font-serif font-semibold text-[30px] leading-tight tracking-[-0.01em] sm:text-[34px] text-foreground">Separate the project case from borrower risk.</h1>
        </div>
        
        {/* Top Figures */}
        <div className="grid grid-cols-1 overflow-hidden rounded-lg border bg-card md:grid-cols-3">
          <div className="border-b p-5 md:border-b-0 md:border-r">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Requested Amount</div>
            <div className="text-[26px] font-semibold leading-none text-foreground">{formatJod(m.totalRequested)}</div>
            <div className="mt-2 text-xs text-muted-foreground">Submitted scope</div>
          </div>
          <div className="relative border-b bg-success/50 p-5 md:border-b-0 md:border-r">
            <div className="absolute inset-x-0 top-0 h-[3px] bg-primary" aria-hidden="true"></div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-primary">Candidate Scope</div>
            <div className="text-[26px] font-semibold leading-none text-primary">{formatJod(m.candidateScope)}</div>
            <div className="mt-2 text-[11px] uppercase tracking-[0.06em] text-muted-foreground">Solar + LED only</div>
          </div>
          <div className="p-5">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Estimated Annual Savings</div>
            <div className="text-[26px] font-semibold leading-none text-foreground">{formatJod(m.estimatedSavings)}</div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.06em] text-muted-foreground">Based on JOD {m.tariff.toFixed(3)} tariff <SourceChip sourceId="S11" page="p. 7" /></div>
          </div>
        </div>

        {/* Main Analysis Split */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Project Stress Test */}
          <Card className="border-border h-full">
            <div className="border-b p-5">
              <h3 className="font-semibold text-lg">Project stress test</h3>
              <p className="text-xs text-muted-foreground mt-1">Estimated savings coverage against an illustrative {formatJod(m.basePayment)} annual payment.</p>
            </div>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">100% of estimate</span>
                    <span className="text-muted-foreground">{result.coverage.savingsAt100.toFixed(1)}× coverage</span>
                </div>
                 <div className="w-full rounded-full h-2.5 overflow-hidden flex" style={{ backgroundColor: "#EFECE5" }}>
                   <div className="h-full" style={{ width: '100%', backgroundColor: "#1D6346" }}></div>
                </div>
                 <div className="text-xs text-right text-muted-foreground">{formatJod(m.estimatedSavings)} savings</div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">85% of estimate</span>
                    <span className="text-muted-foreground">{result.coverage.savingsAt85.toFixed(1)}× coverage</span>
                </div>
                 <div className="w-full rounded-full h-2.5 overflow-hidden flex" style={{ backgroundColor: "#EFECE5" }}>
                   <div className="h-full" style={{ width: '85%', backgroundColor: "#1D6346" }}></div>
                </div>
                 <div className="text-xs text-right text-muted-foreground">{formatJod(m.estimatedSavings * 0.85)} savings</div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">70% of estimate</span>
                    <span className="text-muted-foreground">{result.coverage.savingsAt70.toFixed(1)}× coverage</span>
                </div>
                 <div className="w-full rounded-full h-2.5 overflow-hidden flex" style={{ backgroundColor: "#EFECE5" }}>
                   <div className="h-full" style={{ width: '70%', backgroundColor: "#B7812A" }}></div>
                </div>
                 <div className="text-xs text-right text-muted-foreground">{formatJod(m.estimatedSavings * 0.7)} savings</div>
              </div>
              
              <div className="p-4 bg-primary/5 rounded-lg border border-primary/20 text-sm text-foreground/80 mt-6">
                 Illustrative, not bank terms. This is a project-savings comparison, not an institutional debt-service coverage ratio (DSCR). Break-even is {result.breakEvenPercent.toFixed(0)}% of the estimate.
              </div>
            </CardContent>
          </Card>
          
          {/* Institution & Market */}
          <Card className="border-border h-full">
            <div className="p-5 border-b border-border bg-secondary/30 flex justify-between items-center">
              <div>
                <h3 className="font-semibold text-lg">Institution & market</h3>
                <p className="text-xs text-muted-foreground mt-1">Credit team to test separately.</p>
              </div>
              <Badge variant="warning" className="bg-warning/20 text-warning-foreground border-warning/50">Not assessable yet</Badge>
            </div>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-start gap-4 p-4 rounded-lg border border-warning/30 bg-warning/5">
                <AlertCircle className="h-5 w-5 text-warning-foreground shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-sm text-foreground">Institution cash flow</h4>
                  <p className="text-xs text-muted-foreground mt-1">Audited history needed. A management forecast cannot establish a five-year revenue path.</p>
                </div>
              </div>
              
              <div className="flex items-start gap-4 p-4 rounded-lg border border-warning/30 bg-warning/5">
                <AlertCircle className="h-5 w-5 text-warning-foreground shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-sm text-foreground">Debt obligations</h4>
                  <p className="text-xs text-muted-foreground mt-1">Full schedule needed to determine existing service burden.</p>
                </div>
              </div>
              
              <div className="flex items-start gap-4 p-4 rounded-lg border border-warning/30 bg-warning/5">
                <AlertCircle className="h-5 w-5 text-warning-foreground shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-sm text-foreground">Market trend</h4>
                  <p className="text-xs text-muted-foreground mt-1">No verified trend data provided for student enrollment or fee collection.</p>
                </div>
              </div>
              
               <div className="mt-4 p-3 border border-warning/30 rounded-md bg-warning/20 text-sm font-medium text-foreground">
                Credit staff must test institution and market evidence separately.
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Environmental Impact */}
        <Card className="overflow-hidden">
          <CardContent className="p-6 flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
            <div>
              <h3 className="mb-1 text-lg font-semibold text-foreground">Candidate Environmental Impact</h3>
              <p className="text-sm text-muted-foreground">Estimated from JNGT eligible solar and LED components</p>
            </div>
            
            <div className="flex gap-6">
              <div className="text-center px-6 border-r">
                <div className="flex justify-center mb-2"><Zap className="h-5 w-5 text-success-foreground" /></div>
                 <div className="font-serif text-[30px] font-semibold leading-none text-foreground">{m.impactMWh.toFixed(1)}</div>
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.06em]">MWh/year offset</div>
              </div>
              <div className="text-center px-6">
                <div className="flex justify-center mb-2"><Leaf className="h-5 w-5 text-success-foreground" /></div>
                 <div className="font-serif text-[30px] font-semibold leading-none text-foreground">{m.impactCO2.toFixed(0)}</div>
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.06em]">tCO₂e/year avoided</div>
              </div>
            </div>
          </CardContent>
          <div className="border-t bg-secondary/50 px-6 py-2.5 text-center text-xs text-muted-foreground">
             These are estimates requiring post-installation verification for final reporting. <SourceChip sourceId="S12" page="p. 29" />
          </div>
        </Card>
      </div>
    </BankLayout>
  );
}

import { BankLayout } from "@/components/layout/Shell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRoute } from "wouter";
import { useGetApplication, getGetApplicationQueryKey } from "@tahaqqaq/api-client";
import { ShieldCheck, CheckCircle2, AlertCircle, XCircle, FileText } from "lucide-react";
import { REFERENCE_CASE_DATA, caseDataForApplication } from "@/data/reference-data";
import { useState } from "react";
import { SourceChip } from "@/components/ui/source-chip";
import { REFERENCE_CASE_COUNTS } from "@/data/case-counts";
import { RealScreeningWorkspace } from "@/components/bank/RealScreeningWorkspace";

export default function Compliance() {
  const [, params] = useRoute("/bank/:id/compliance");
  const id = params?.id;
  const { data: app, isLoading } = useGetApplication(id || "", {
    query: { enabled: !!id, queryKey: getGetApplicationQueryKey(id || "") }
  });

  const [selectedLayer, setSelectedLayer] = useState("jngt");

  if (isLoading || !app) {
    return (
      <BankLayout applicationId={id}>
        <div className="p-10 text-center text-muted-foreground">Loading compliance...</div>
      </BankLayout>
    );
  }

  if (!app.isReference) {
    return <BankLayout applicationId={id}><RealScreeningWorkspace application={app} page="compliance" /></BankLayout>;
  }

  const { layers } = REFERENCE_CASE_DATA.compliance;
  const { inputs } = caseDataForApplication(app);
  const money = (value: number) => `JOD ${Math.round(value).toLocaleString()}`;
  const activeLayerData = layers.find(l => l.id === selectedLayer) || layers[0];

  const getOutcomeStyle = (outcome: string) => {
    switch(outcome) {
      case "Met": return { border: "border-success", bg: "bg-success/10", badgeBg: "bg-success", text: "text-success-foreground", icon: <CheckCircle2 className="h-4 w-4 text-success-foreground" /> };
      case "Proof missing": return { border: "border-warning", bg: "bg-warning/10", badgeBg: "bg-warning", text: "text-warning-foreground", icon: <AlertCircle className="h-4 w-4 text-warning-foreground" /> };
      case "Not met": return { border: "border-destructive", bg: "bg-destructive/10", badgeBg: "bg-destructive", text: "text-destructive-foreground", icon: <XCircle className="h-4 w-4 text-destructive-foreground" /> };
      case "Bank review": return { border: "border-info", bg: "bg-info/10", badgeBg: "bg-info", text: "text-info-foreground", icon: <FileText className="h-4 w-4 text-info-foreground" /> };
      default: return { border: "border-border", bg: "bg-white", badgeBg: "bg-secondary", text: "text-foreground", icon: null };
    }
  };

  return (
    <BankLayout applicationId={id}>
      <div className="mx-auto max-w-[1200px] space-y-8 px-4 py-8 sm:px-8">
        <div className=" flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-serif font-semibold text-[30px] leading-tight tracking-[-0.01em] sm:text-[34px] text-foreground">Relevant rules. Visible outcomes.</h1>
          <Badge variant="destructive">{REFERENCE_CASE_COUNTS.compliance.notMet} criteria not met</Badge>
        </div>
        
        {/* Upgrade Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="border border-border border-l-4 border-l-[#1D6346] bg-white">
            <CardContent className="p-4">
              <div className="text-xs font-semibold text-muted-foreground uppercase mb-1 tracking-[0.06em]">SOLAR PV</div>
                <div className="font-semibold">{money(inputs.upgradeAmounts.solar)}</div>
               <div className="text-xs text-warning-foreground mt-1 flex items-center gap-1"><AlertCircle className="h-3 w-3 shrink-0"/> 3 proof gaps: recycling plan, grid approval, municipality permit · goes forward once proof arrives</div>
            </CardContent>
          </Card>
          <Card className="border border-border border-l-4 border-l-[#1D6346] bg-white">
            <CardContent className="p-4">
              <div className="text-xs font-semibold text-muted-foreground uppercase mb-1 tracking-[0.06em]">LED LIGHTING</div>
                <div className="font-semibold">{money(inputs.upgradeAmounts.led)}</div>
               <div className="text-xs text-warning-foreground mt-1 flex items-center gap-1"><AlertCircle className="h-3 w-3 shrink-0"/> 1 proof gap · line B label; goes forward once proof arrives</div>
            </CardContent>
          </Card>
          <Card className="border border-border border-l-4 border-l-[#C4553F] bg-white">
            <CardContent className="p-4">
              <div className="text-xs font-semibold text-muted-foreground uppercase mb-1 tracking-[0.06em]">LIBRARY HVAC</div>
                <div className="font-semibold">{money(inputs.upgradeAmounts.library)}</div>
               <div className="text-xs text-destructive-foreground mt-1 flex items-center gap-1"><XCircle className="h-3 w-3"/> Not met · {inputs.librarySavingPercent}% against {inputs.rules.energyEfficiencyMinimumPercent}% rule · sent back</div>
            </CardContent>
          </Card>
          <Card className="border border-border border-l-4 border-l-[#B7812A] bg-white">
            <CardContent className="p-4">
              <div className="text-xs font-semibold text-muted-foreground uppercase mb-1 tracking-[0.06em]">WATER FIXTURES</div>
                <div className="font-semibold">{money(inputs.upgradeAmounts.water)}</div>
               <div className="text-xs text-warning-foreground mt-1 flex items-center gap-1"><AlertCircle className="h-3 w-3 shrink-0"/> 3 proof gaps: water bills, water tariff, fixture standard · can&apos;t screen yet</div>
            </CardContent>
          </Card>
        </div>

        {/* Layer Selection */}
        <div className="flex flex-col gap-6">
          <div className="grid md:grid-cols-4 gap-2"> {layers.map((layer) => ( <button key={layer.id} onClick={() => setSelectedLayer(layer.id)} className={`text-left p-4 rounded-xl border transition-all ${ selectedLayer === layer.id ?"border-primary ring-1 ring-primary bg-primary/5" 
                    : "border-border hover:border-primary/30 hover:bg-secondary/20"
                }`}
              >
                <div className={`font-semibold text-sm mb-1 ${selectedLayer === layer.id ? "text-primary" : "text-foreground"}`}>
                  {layer.name}
                </div>
                {selectedLayer === layer.id && (
                  <div className="text-[11px] text-muted-foreground leading-tight">
                    {layer.description}
                  </div>
                )}
              </button>
            ))}
          </div>
          
          {/* Criteria Grid */}
          <Card className="border-border">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-6 pb-4 border-b">
                {activeLayerData.name} criteria
              </h3>
              
              <div className="grid md:grid-cols-2 gap-4"> {activeLayerData.criteria.map((c: any) => { const style = getOutcomeStyle(c.outcome); return ( <div key={c.id} className={`p-4 rounded-lg border ${style.border} ${style.bg} flex flex-col`}> <div className="flex justify-between items-start mb-3">
                        <h4 className="font-medium text-sm pr-4">{c.label}</h4>
                         <div className={`flex items-center gap-1.5 px-2 py-1 rounded border ${style.badgeBg}  ${style.border} shrink-0`}>
                          {style.icon}
                          <span className={`text-[11px] font-semibold uppercase tracking-[0.06em] ${style.text}`}>
                            {c.outcome}
                          </span>
                        </div>
                      </div>
                      
                      <p className="text-sm text-foreground/80 mb-4 flex-1">
                        {c.reason}
                      </p>
                      
                      <div className="mt-auto pt-3 border-t border-black/5">
                        <SourceChip sourceId={c.source} page={c.page} quote={c.quote} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </BankLayout>
  );
}

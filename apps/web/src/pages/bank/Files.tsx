import { BankLayout } from "@/components/layout/Shell";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useRoute } from "wouter";
import { useGetApplication, getGetApplicationQueryKey } from "@tahaqqaq/api-client";
import { FileText, ExternalLink, Download, AlertCircle, CheckCircle2, XCircle, Search } from "lucide-react";
import { useState } from "react";
import { REFERENCE_CASE_COUNTS, REFERENCE_MISSING_EVIDENCE } from "@/data/case-counts";
import { RealScreeningWorkspace } from "@/components/bank/RealScreeningWorkspace";

export default function Files() {
  const [, params] = useRoute("/bank/:id/files");
  const id = params?.id;
  const { data: app, isLoading } = useGetApplication(id || "", {
    query: { enabled: !!id, queryKey: getGetApplicationQueryKey(id || "") }
  });

  const [search, setSearch] = useState("");

  if (isLoading || !app) {
    return (
      <BankLayout applicationId={id}>
        <div className="p-10 text-center text-muted-foreground">Loading files...</div>
      </BankLayout>
    );
  }

  const isRef = app.isReference;
  if (!isRef) {
    return <BankLayout applicationId={id}><RealScreeningWorkspace application={app} page="files" /></BankLayout>;
  }
  const counts = REFERENCE_CASE_COUNTS;
  const allFiles = app.files || [];
  
  const filteredFiles = allFiles.filter(f => f.name.toLowerCase().includes(search.toLowerCase()));
  
  const screeningFiles = filteredFiles.filter(f => f.category === "screening" || (!isRef && f.category === "received"));
  const creditFiles = filteredFiles.filter(f => f.category === "credit");
  const asideFiles = filteredFiles.filter(f => f.category === "aside");

  const getQualityIcon = (quality: string) => {
    switch(quality) {
      case "good": return <CheckCircle2 className="h-3 w-3 text-success-foreground" />;
      case "duplicate": return <ExternalLink className="h-3 w-3 text-warning-foreground" />;
      case "stale": return <AlertCircle className="h-3 w-3 text-warning-foreground" />;
      case "unreadable": return <XCircle className="h-3 w-3 text-destructive-foreground" />;
      default: return null;
    }
  };

  const getQualityBadge = (quality: string) => {
    if (!quality) return null;
    const q = quality.toLowerCase();
    if (q.includes('good')) return null;
    if (q.includes('duplicate')) return <Badge variant="warning" className="flex gap-1 py-0 px-1.5 text-[11px]"><ExternalLink className="h-2.5 w-2.5" /> Duplicate</Badge>;
    if (q.includes('stale')) return <Badge variant="warning" className="flex gap-1 py-0 px-1.5 text-[11px]"><AlertCircle className="h-2.5 w-2.5" /> Stale</Badge>;
    if (q.includes('unreadable')) return <Badge variant="destructive" className="flex gap-1 py-0 px-1.5 text-[11px]"><XCircle className="h-2.5 w-2.5" /> Unreadable</Badge>;
    if (q.includes('unrelated')) return <Badge variant="secondary" className="flex gap-1 py-0 px-1.5 text-[11px]">Unrelated</Badge>;
    return null;
  };

  return (
    <BankLayout applicationId={id}>
      <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="font-serif font-semibold text-[30px] leading-tight tracking-[-0.01em] sm:text-[34px] text-foreground">All received evidence, sorted by use.</h1>
            <p className="text-sm text-muted-foreground mt-1">{allFiles.length} files attached to {app.title}</p>
          </div>
          
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input 
              type="search"
              placeholder="Filter files..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-transparent pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
        </div>
        
        <Tabs defaultValue={isRef ? "screening" : "received"} className="w-full">
          <TabsList className="mb-6 bg-secondary/50">
            {isRef ? (
              <>
                <TabsTrigger value="screening" className="data-[state=active]:bg-white">
                  Screening <Badge variant="secondary" className="ml-2 bg-black/5">{counts.files.screening}</Badge>
                </TabsTrigger>
                <TabsTrigger value="credit" className="data-[state=active]:bg-white">
                  Credit team <Badge variant="secondary" className="ml-2 bg-black/5">{counts.files.credit}</Badge>
                </TabsTrigger>
                <TabsTrigger value="aside" className="data-[state=active]:bg-white">
                  Set aside <Badge variant="secondary" className="ml-2 bg-black/5">{counts.files.setAside}</Badge>
                </TabsTrigger>
              </>
            ) : (
              <TabsTrigger value="received" className="data-[state=active]:bg-white">
                Received <Badge variant="secondary" className="ml-2 bg-black/5">{allFiles.length}</Badge>
              </TabsTrigger>
            )}
          </TabsList>
          
          <TabsContent value={isRef ? "screening" : "received"} className="m-0 focus-visible:outline-none focus-visible:ring-0">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {screeningFiles.map(file => (
                <FileCard key={file.id} file={file} isRef={isRef} />
              ))}
              {screeningFiles.length === 0 && (
                <div className="col-span-full py-12 text-center text-muted-foreground border border-dashed rounded-lg">
                  No files match this filter
                </div>
              )}
            </div>
          </TabsContent>
          
          {isRef && (
            <>
              <TabsContent value="credit" className="m-0 focus-visible:outline-none focus-visible:ring-0">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {creditFiles.map(file => (
                    <FileCard key={file.id} file={file} isRef={isRef} />
                  ))}
                </div>
              </TabsContent>
              
              <TabsContent value="aside" className="m-0 focus-visible:outline-none focus-visible:ring-0">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {asideFiles.map(file => (
                    <FileCard key={file.id} file={file} isRef={isRef} />
                  ))}
                </div>
              </TabsContent>
            </>
          )}
        </Tabs>
        {isRef && (
          <Card className="mt-6">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">Still needed for screening</h3>
                 <Badge variant="warning">{counts.evidence.missing} missing · {counts.evidence.toConfirm} to confirm</Badge>
              </div>
               <p className="text-xs text-muted-foreground mt-1 mb-4">Open evidence requirements before technical screening can be completed.</p>
               <div className="grid sm:grid-cols-2 gap-2 mb-3">
                  {REFERENCE_MISSING_EVIDENCE.map(([item, group]) => (
                   <div key={item} className="rounded-lg bg-secondary/30 p-3 text-xs">
                     <div className="font-medium text-foreground">{item}</div>
                     <div className="mt-1 text-muted-foreground">{group}</div>
                   </div>
                ))}
              </div>
                <p className="text-xs text-muted-foreground mb-2">{counts.evidence.toConfirm} received files are waiting for an analyst&apos;s confirmation. They are not requested again.</p>
               <div className="grid md:grid-cols-2 gap-3 mt-5 border-t pt-4">
                 <div className="rounded-lg border border-warning/30 bg-warning/10 p-4">
                   <h4 className="text-sm font-semibold text-foreground">Needed before payout</h4>
                   <ul className="mt-2 space-y-1.5 text-xs text-foreground">
                     <li>• Grid-connection approval <span className="text-muted-foreground">(distribution company)</span></li>
                     <li>• Municipality permit plus electrical-safety sign-off</li>
                   </ul>
                 </div>
                 <div className="rounded-lg border border-info/30 bg-info/10 p-4">
                   <h4 className="text-sm font-semibold text-foreground">Credit team needs</h4>
                   <ul className="mt-2 space-y-1.5 text-xs text-foreground">
                     <li>• Legal identity</li>
                     <li>• 3 years of audited statements</li>
                     <li>• Debt schedule</li>
                     <li>• Governance</li>
                   </ul>
                 </div>
               </div>
              <a href={`/api/applications/${encodeURIComponent(app.id)}/request-list.pdf`} className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1">
                Download complete request list <Download className="h-3 w-3" />
              </a>
            </CardContent>
          </Card>
        )}
      </div>
    </BankLayout>
  );
}

function FileCard({ file, isRef }: { file: any, isRef: boolean }) {
  const [open, setOpen] = useState(false);
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Card className="hover:border-primary/50 cursor-pointer transition-colors group">
          <CardContent className="p-4 flex items-start gap-3">
            <div className="h-10 w-10 rounded bg-secondary/50 flex items-center justify-center flex-shrink-0 text-muted-foreground group-hover:text-primary transition-colors">
              <FileText className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2 mb-1">
                <h4 className="font-semibold text-sm truncate text-foreground" title={file.name}>{file.name}</h4>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                {file.pages && (
                  <span className="text-[11px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                    {file.pages} page{file.pages > 1 ? 's' : ''}
                  </span>
                )}
                {file.quality && (
                  <Badge
                    variant={/unreadable|unrelated/i.test(file.quality) ? "destructive" : /duplicate|stale|missing|pending/i.test(file.quality) ? "warning" : "secondary"}
                    className="py-0 h-4 px-1.5 text-[11px]"
                  >
                    {file.quality}
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] h-[80vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b shrink-0 bg-white">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5 text-primary" />
            <span className="truncate">{file.name}</span>
          </DialogTitle>
          <div className="flex items-center justify-between mt-2">
            <div className="flex gap-2">
              <Badge variant="outline" className="font-normal">{file.category}</Badge>
              {file.pages && <Badge variant="outline" className="font-normal">{file.pages} pages</Badge>}
              <Badge variant="outline" className="font-normal">{(file.size / 1024).toFixed(0)} KB</Badge>
            </div>
            <Button size="sm" variant="outline" className="h-8" asChild>
              <a href={file.url} target="_blank" rel="noopener noreferrer">
                Open original PDF <ExternalLink className="h-3 w-3 ml-2" />
              </a>
            </Button>
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto p-6 bg-secondary/10 relative">
          {isRef && (
            <div className="absolute top-4 right-4 text-[11px] font-semibold text-primary/20 transform rotate-12 border-2 border-primary/20 px-2 py-1 uppercase select-none pointer-events-none tracking-[0.06em]">
              SYNTHETIC DEMO DOCUMENT
            </div>
          )}
          
          <div className="bg-white border rounded-md p-6 min-h-full">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-4 border-b pb-2 tracking-[0.06em]">Extracted Text Content</h4>
            <div className="whitespace-pre-wrap text-sm text-foreground/80 font-mono leading-relaxed">
              {file.text || "No text could be extracted from this document."}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

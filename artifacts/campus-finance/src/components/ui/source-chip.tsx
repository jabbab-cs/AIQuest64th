import { useEffect, useState } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogTrigger
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Check, FileText, ExternalLink, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { REFERENCE_SOURCES } from "@/data/reference-data";

const summaryOnly = new Set(["S03:16", "S09:132", "S09:136", "S11:7", "S12:29", "S12:3", "S17:4", "S17:5", "S18:5", "S18:8", "S13:"]);

export function SourceChip({ 
  sourceId, 
  page, 
  quote, 
  title,
  originalUrl,
}: { 
  sourceId: string; 
  page?: string; 
  quote?: string;
  title?: string;
  originalUrl?: string;
}) {
  const [open, setOpen] = useState(false);
  const source = REFERENCE_SOURCES[sourceId as keyof typeof REFERENCE_SOURCES];
  const isDocument = !source;
  
  const passage = page
    ? source?.passages.find((item) => (item.page === parseInt(page.replace(/\D/g, ""), 10) || item.range === page) && (!quote || item.quote === quote))
    : source?.passages[0];
  const passageIndex = passage ? source?.passages.indexOf(passage) ?? -1 : -1;
  const registeredQuote = passage?.quote;
  const passagePage = passage?.page ? `p. ${passage.page}` : passage?.range;
  const displayLabel = `${sourceId}${page || passagePage ? `, ${page || passagePage}` : ''}`;
  const isSummary = summaryOnly.has(`${sourceId}:${passage?.page ?? ""}`);
  const pageNumber = passage?.page || parseInt(page?.replace(/\D/g, "") || "", 10) || undefined;
  const publicUrl = source?.url ? `${source.url}${pageNumber ? `#page=${pageNumber}` : ""}` : "";
  const [evidence, setEvidence] = useState<{ status: "preparing" | "available" | "unavailable"; matched: boolean; imageUrl?: string } | null>(null);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    if (!open || !publicUrl || passageIndex < 0) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    setEvidence(null);
    setImageFailed(false);
    const load = async () => {
      try {
        const response = await fetch(`/api/source-evidence/${encodeURIComponent(sourceId)}/${passageIndex}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Evidence image unavailable");
        const data = await response.json() as { status: "preparing" | "available" | "unavailable"; matched: boolean; imageUrl?: string };
        if (cancelled) return;
        setEvidence(data);
        if (data.status === "preparing") timer = setTimeout(load, 2500);
      } catch {
        if (!cancelled) setEvidence({ status: "unavailable", matched: false });
      }
    };
    void load();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [open, publicUrl, passageIndex, sourceId]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80 transition-colors border border-border mt-1">
          <FileText className="h-3 w-3" />
          {displayLabel}
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[900px]">
        <DialogHeader>
          <span className="text-[11px] font-semibold uppercase text-muted-foreground tracking-[0.06em]">Source evidence</span>
          <DialogTitle className="pr-5 text-xl">
            {isDocument ? (title || sourceId) : `${sourceId} · ${source.title}`}
          </DialogTitle>
          <DialogDescription>
            {isDocument ? "Submitted document reference" : `${source.publisher} · ${source.date}${pageNumber ? ` · Page ${pageNumber}` : ""}`}
          </DialogDescription>
        </DialogHeader>
        
        <div className="rounded-md border-l-4 border-[#1D6346] bg-[#F3F1EC] px-5 py-4">
          {registeredQuote || quote ? (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-[0.06em]">{isSummary ? "Summary" : "Quoted passage"}</h4>
              <blockquote className="text-base leading-relaxed text-foreground">
                {isSummary ? registeredQuote || quote : `“${registeredQuote || quote}”`}
              </blockquote>
            </div>
          ) : (
            <p className="text-sm text-foreground italic">
              {isDocument ? "Relevant document text is not available in this view." : "No passage is registered for this page. Open the original document to review it."}
            </p>
          )}
        </div>
        
        {!isDocument && (
          <div className="space-y-3">
            {publicUrl && (
              <>
                {evidence?.status === "available" && evidence.imageUrl && !imageFailed ? (
                  <div className="max-h-[54vh] overflow-auto rounded-md border border-border bg-white">
                    <img src={evidence.imageUrl} alt={`Page ${pageNumber || ""} of ${source.title}; pale yellow highlights mark matched text when available`} className="h-auto w-full" onError={() => setImageFailed(true)} />
                  </div>
                ) : (
                  <div className="rounded-md border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
                    {passageIndex >= 0 && !imageFailed && (!evidence || evidence.status === "preparing") ? "Preparing source page image…" : "Page image unavailable"}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  {evidence?.status === "available" && evidence.matched && !imageFailed
                    ? "Quote matched on the source page"
                    : "Summary: check against the source"}
                </p>
                <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                  Open the original document <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </>
            )}
            {!publicUrl && (
              <p className="text-xs text-muted-foreground">
                {sourceId === "S13" ? "Original publication link unavailable; citation pending. Quote only." : "Local copy, not redistributed. Quote only."}
              </p>
            )}
          </div>
        )}
        {isDocument && originalUrl && <a href={originalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">Open original document <ExternalLink className="h-3.5 w-3.5" /></a>}
        {isDocument && /^S\d+$/i.test(sourceId) && <p className="text-xs text-muted-foreground">Local copy, not redistributed.</p>}
      </DialogContent>
    </Dialog>
  );
}

// Shared status badge for inbox, case headers and the institution portal.
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  if (status === "New") return <Badge variant="success" className={className}>New</Badge>;
  if (status === "Qualified") return <Badge variant="success" className={className}>Qualified for credit review</Badge>;
  if (status === "Rejected") return <Badge variant="destructive" className={className}>Rejected</Badge>;
  if (/evidence requested/i.test(status)) return <Badge variant="warning" className={className}>Evidence requested</Badge>;
  if (status === "Approved") return <Badge variant="outline" className={cn("gap-1 border-primary/40 text-primary", className)}><Check className="h-3 w-3" aria-hidden="true" />Scope approved</Badge>;
  if (status === "Verifying") return <Badge variant="secondary" className={cn("gap-1", className)}><ShieldCheck className="h-3 w-3" aria-hidden="true" />Verifying on site</Badge>;
  if (status === "Paid") return <Badge variant="success" className={cn("gap-1", className)}><Check className="h-3 w-3" aria-hidden="true" />Paid</Badge>;
  return <Badge variant="warning" className={className}>Pending</Badge>;
}

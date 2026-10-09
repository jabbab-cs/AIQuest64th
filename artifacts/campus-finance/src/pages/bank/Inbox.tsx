import { APPROVED_CASE_ID } from "@/data/reference-data";
import { BankLayout } from "@/components/layout/Shell";
import { Link } from "wouter";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/source-chip";
import { FileText, Search, ArrowRight } from "lucide-react";
import { useState } from "react";
import { useListApplications } from "@workspace/api-client-react";
import { format } from "date-fns";

export default function BankInbox() {
  const { data: applications = [], isLoading } = useListApplications();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"All" | "New" | "Pending" | "Qualified" | "Rejected" | "Screened">("All");

  const sortedApplications = [...applications].sort((a, b) => Number(!!b.isDemo) - Number(!!a.isDemo) || +new Date(b.createdAt) - +new Date(a.createdAt));
  const filteredApps = sortedApplications.filter(app => {
    const matchesSearch = app.title.toLowerCase().includes(search.toLowerCase()) || 
                          app.university.toLowerCase().includes(search.toLowerCase());
    const screeningStatus = !app.isReference && /screened|evidence requested/i.test(app.status) ? "Screened" : app.status;
    const matchesFilter = filter === "All" || screeningStatus === filter;
    return matchesSearch && matchesFilter;
  });

  const pendingCount = applications.filter(a => a.status === "Pending").length;
  const qualifiedCount = applications.filter(a => a.status === "Qualified").length;
  const rejectedCount = applications.filter(a => a.status === "Rejected").length;

  return (
    <BankLayout>
      <div className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-8">
        <div className="mb-6">
          <h1 className="font-serif font-semibold text-[30px] leading-tight tracking-[-0.01em] sm:text-[34px] text-foreground">
            Every project. One clear next step.
          </h1>
        </div>
        
        {/* Stats Row */}
        <div className="mb-6 grid grid-cols-2 overflow-hidden rounded-lg border bg-card md:grid-cols-4">
          {([
            ["All", "ALL APPLICATIONS", applications.length],
            ["Pending", "PENDING REVIEW", pendingCount],
            ["Qualified", "QUALIFIED FOR CREDIT REVIEW", qualifiedCount],
            ["Rejected", "REJECTED", rejectedCount],
          ] as const).map(([key, label, count], index) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              aria-pressed={filter === key}
              className={`relative p-4 text-left transition-colors ${index % 2 ? "" : "border-r"} ${index < 2 ? "border-b md:border-b-0" : ""} ${index === 1 ? "md:border-r" : ""} ${index === 2 ? "md:border-r" : ""} ${filter === key ? "bg-secondary/70" : "hover:bg-secondary/40"}`}
            >
              {filter === key && <span className="absolute inset-x-0 top-0 h-[2px] bg-primary" aria-hidden="true" />}
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{label}</div>
              <div className="font-serif text-[30px] font-semibold leading-none text-foreground">{count}</div>
            </button>
          ))}
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <div className="flex flex-wrap gap-2">
            {(["All", "New", "Pending", "Screened", "Qualified", "Rejected"] as const).map(f => (
              <Button
                key={f}
                variant={filter === f ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter(f)}
                className="h-11 rounded-md text-xs sm:h-8"
              >
                {f}
              </Button>
            ))}
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input 
              placeholder="Search projects..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 pl-8 text-xs sm:h-8"
            />
          </div>
        </div>
        
        {/* List */}
        <div className="space-y-2">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading applications...</div>
          ) : filteredApps.length === 0 ? (
            <Card className="bg-secondary/20 border-dashed">
              <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
                <h3 className="text-lg font-medium text-foreground">No applications found</h3>
                <p className="text-sm text-muted-foreground mt-1">Try changing your filters or search term.</p>
              </CardContent>
            </Card>
          ) : (
            filteredApps.map(app => (
              <Link key={app.id} href={`/bank/${app.id}/${app.id === APPROVED_CASE_ID ? "verification" : "overview"}`}>
                <Card className="group cursor-pointer transition-colors hover:border-primary/40 hover:bg-card">
                  <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="mt-0.5 flex-shrink-0">
                        <div className="flex h-9 w-9 items-center justify-center rounded-md border bg-secondary/60 text-muted-foreground">
                          <FileText className="h-4 w-4" />
                        </div>
                      </div>
                      <div>
                        <div className="mb-0.5 text-[12px] font-medium text-muted-foreground">{app.university}{app.institutionType && <span className="font-normal"> · {app.institutionType}</span>}</div>
                        <h3 className="text-base font-semibold text-foreground group-hover:text-primary transition-colors">
                          {app.title}
                        </h3>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {app.files.length} files
                          </span>
                          <span>•</span>
                          <span>{format(new Date(app.createdAt), 'MMM d, yyyy')}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 self-end sm:self-center">
                       {!app.isReference && /screened|evidence requested/i.test(app.status) && (
                         <Badge variant="warning" className="text-xs py-0.5">Screened: evidence requested</Badge>
                       )}
                       {(app.isReference || /^(Approved|Verifying|Paid)$/.test(app.status)) && (
                        <StatusBadge status={app.status} className="text-xs py-0.5" />
                      )}
                      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all hidden sm:block" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))
          )}
        </div>
      </div>
    </BankLayout>
  );
}

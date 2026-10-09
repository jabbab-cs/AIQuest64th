import { APPROVED_CASE_ID } from "@/data/reference-data";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { ShieldCheck, FileText, Activity, LayoutDashboard, CheckCircle2, ChevronRight, BarChart3, RotateCcw, BadgeCheck } from "lucide-react";
import { StatusBadge } from "@/components/ui/source-chip";
import { useGetApplication, getGetApplicationQueryKey } from "@tahaqqaq/api-client";

export function BrandMark({ className }: { className?: string; inverted?: boolean }) {
  // Transparent mark, no tile, on every background.
  return (
    <span className={cn("inline-flex h-8 w-8 shrink-0 items-center justify-center", className)}>
      <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" className="h-full w-full object-contain" />
    </span>
  );
}

function Wordmark({ inverted = false, className }: { inverted?: boolean; className?: string }) {
  return (
    <span className={cn("flex items-baseline gap-2", className)}>
      <span className={cn("text-[17px] font-semibold tracking-[-0.01em]", inverted ? "text-sidebar-foreground" : "text-foreground")}>Tahaqqaq</span>
      <span lang="ar" dir="rtl" className={cn("text-[13px] font-medium", inverted ? "text-sidebar-foreground/55" : "text-muted-foreground")}>تحقّق</span>
    </span>
  );
}

export function PublicTopBar() {
  const [location] = useLocation();

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5 transition-opacity hover:opacity-80" aria-label="Tahaqqaq — go to home page" data-testid="link-brand-home">
          <BrandMark />
          <Wordmark className="hidden sm:flex" />
        </Link>

        <nav className="flex items-center gap-0.5 text-[13px] font-medium sm:gap-1 sm:text-sm">
          {[["/institution", "Institution portal", "Institution"], ["/institution/verification", "Verification", "Verification"], ["/bank", "Bank workspace", "Bank"]].map(([href, label, short]) => (
            <Link key={href} href={href}>
              <span className={cn(
                "flex min-h-11 cursor-pointer items-center rounded-md px-2.5 transition-colors sm:min-h-9 sm:px-3",
                (href === "/institution" ? location === href : location.startsWith(href)) ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
              )}>
                <span className="sm:hidden">{short}</span>
                <span className="hidden sm:inline">{label}</span>
              </span>
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

export function BankLayout({ children, applicationId }: { children: React.ReactNode, applicationId?: string }) {
  const [location] = useLocation();
  const queryClient = useQueryClient();
  const basePath = applicationId ? `/bank/${applicationId}` : `/bank`;

  const navItems = [
    { href: `${basePath}/overview`, label: "Overview", icon: LayoutDashboard },
    { href: `${basePath}/files`, label: "Files", icon: FileText },
    { href: `${basePath}/data-checks`, label: "Data checks", icon: Activity },
    { href: `${basePath}/compliance`, label: "Compliance", icon: ShieldCheck },
    { href: `${basePath}/analysis`, label: "Project analysis", icon: BarChart3 },
    { href: `${basePath}/report`, label: "Report", icon: CheckCircle2 },
  ];

  // Attempt to load application title if a case is chosen
  const { data: app } = useGetApplication(applicationId || "", {
    query: { enabled: !!applicationId, queryKey: getGetApplicationQueryKey(applicationId || "") }
  });
  if (app && /^(Approved|Verifying|Paid)$/.test(app.status)) navItems.push({ href: `${basePath}/verification`, label: "Verification", icon: BadgeCheck });
  // The approved showcase case has no Phase 1 screening pages; it is all about on-site verification.
  if (applicationId === APPROVED_CASE_ID) navItems.splice(0, navItems.length, { href: `${basePath}/verification`, label: "Verification", icon: BadgeCheck });
  async function resetDemo() {
    await fetch("/api/demo/reset", { method: "POST" });
    await queryClient.invalidateQueries();
    window.location.href = "/bank";
  }

  const navLink = (active: boolean) => cn(
    "relative flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
    active
      ? "bg-white/[0.07] text-sidebar-foreground before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[2px] before:rounded-full before:bg-brass"
      : "text-sidebar-foreground/65 hover:bg-white/[0.04] hover:text-sidebar-foreground"
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Persistent Left Sidebar */}
      <aside className="sticky top-0 z-50 hidden h-screen w-[240px] flex-shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <Link href="/" className="flex h-16 shrink-0 items-center gap-2.5 border-b border-sidebar-border px-5 transition-opacity hover:opacity-80" aria-label="Tahaqqaq — go to home page" data-testid="link-bank-brand-home">
          <BrandMark inverted />
          <Wordmark inverted />
        </Link>

        <div className="flex-1 overflow-y-auto px-3 py-5">
          <div className="mb-2 px-3 text-[11px] font-medium text-sidebar-foreground/45">Workspace</div>
          <Link href="/bank">
            <span className={cn(navLink(!applicationId), "mb-6")}>
              <LayoutDashboard className="h-4 w-4" />
              Applications
            </span>
          </Link>

          {applicationId && (
            <>
              <div className="mb-2 px-3 text-[11px] font-medium text-sidebar-foreground/45">Chosen case</div>
              <nav className="space-y-0.5">
                {navItems.map((item) => (
                  <Link key={item.href} href={item.href}>
                    <span className={navLink(location === item.href)}>
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </span>
                  </Link>
                ))}
              </nav>
            </>
          )}
        </div>
        <button type="button" onClick={resetDemo} className="mx-3 mb-4 flex items-center gap-2 rounded-md px-3 py-2 text-left text-xs text-sidebar-foreground/50 transition-colors hover:bg-white/[0.04] hover:text-sidebar-foreground">
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          Reset demo
        </button>
      </aside>

      {/* Main Area */}
      <div className="flex h-screen min-w-0 flex-1 flex-col overflow-hidden">
        {/* Main Area Top Bar */}
        <header className="sticky top-0 z-40 shrink-0 border-b bg-card">
          <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
            <div className="flex min-w-0 items-center text-sm font-medium">
              <Link href="/" className="mr-3 md:hidden" aria-label="Tahaqqaq — go to home page"><BrandMark className="h-7 w-7" /></Link>
              <Link href="/bank">
                <span className="cursor-pointer text-muted-foreground transition-colors hover:text-foreground">
                  Applications
                </span>
              </Link>
              {applicationId && (
                <>
                  <ChevronRight className="mx-2 h-4 w-4 shrink-0 text-muted-foreground/50" />
                  <span className="truncate text-foreground">
                    {app ? app.title : "Case Details"}
                  </span>
                  {app && <StatusBadge status={app.status} className="ml-3 hidden shrink-0 sm:inline-flex" />}
                </>
              )}
            </div>

            <nav className="shrink-0">
              <Link href="/institution">
                <span className="flex min-h-11 cursor-pointer items-center rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground sm:min-h-9">
                  <span className="sm:hidden">Institution</span>
                  <span className="hidden sm:inline">Institution portal</span>
                </span>
              </Link>
            </nav>
          </div>
          {applicationId && (
            <nav className="flex items-center gap-1 overflow-x-auto border-t px-3 py-1 md:hidden" aria-label="Chosen case">
              {app && <StatusBadge status={app.status} className="mr-1 shrink-0 sm:hidden" />}
              {navItems.map((item) => (
                <Link key={item.href} href={item.href}>
                  <span className={cn(
                    "flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-[13px] font-medium",
                    location === item.href ? "bg-secondary text-foreground" : "text-muted-foreground"
                  )}>
                    <item.icon className="h-3.5 w-3.5" />
                    {item.label}
                  </span>
                </Link>
              ))}
            </nav>
          )}
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

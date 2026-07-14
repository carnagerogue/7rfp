import {
  FileText,
  User,
  BookOpenCheck,
  Settings as SettingsIcon,
  RefreshCw,
  Building2,
  DollarSign,
} from "lucide-react";

// Curated, on-brand preview of a populated "RFP Ready" workspace.
// Pure presentational mock (no data) used as the landing hero visual — it stays
// crisp at any size and always tracks the current Nucleos theme tokens.
const STATS = [
  { label: "Active RFPs", value: "7" },
  { label: "GO — Pursue", value: "3" },
  { label: "Pipeline", value: "$68M" },
];

const NAV_ICONS = [FileText, User, BookOpenCheck, SettingsIcon];

const RFPS = [
  {
    id: "NUC-0042",
    title: "Statewide Inmate Education & Tablet Learning Platform",
    agency: "California Dept. of Corrections (CDCR)",
    value: "$8M – $12M IDIQ",
    due: "Due Jun 9",
    priority: 5,
    rec: "GO — Pursue",
    recClass: "bg-emerald-500/15 text-emerald-700",
  },
  {
    id: "NUC-0041",
    title: "Reentry Workforce Development LMS",
    agency: "Texas Workforce Commission",
    value: "$2.4M ceiling",
    due: "Due May 28",
    priority: 4,
    rec: "GO — Pursue",
    recClass: "bg-emerald-500/15 text-emerald-700",
  },
  {
    id: "NUC-0039",
    title: "Enterprise M365 Migration + Managed Services",
    agency: "Maricopa County, AZ",
    value: "$5M / 5 yrs",
    due: "Due Jun 12",
    priority: 4,
    rec: "GO — Stretch",
    recClass: "bg-amber-500/15 text-amber-700",
  },
];

function priorityClass(p: number) {
  if (p >= 5) return "bg-emerald-500/15 text-emerald-700";
  if (p === 4) return "bg-lime-500/15 text-lime-700";
  if (p === 3) return "bg-amber-500/15 text-amber-700";
  return "bg-slate-400/20 text-slate-600";
}

export function AppPreview() {
  return (
    <div className="select-none bg-background text-left text-foreground">
      {/* Browser chrome */}
      <div className="flex items-center gap-1.5 border-b border-border bg-muted/40 px-3 py-2">
        <span className="h-2 w-2 rounded-full bg-red-400/70" />
        <span className="h-2 w-2 rounded-full bg-amber-400/70" />
        <span className="h-2 w-2 rounded-full bg-emerald-400/70" />
        <span className="ml-2 text-[9px] text-muted-foreground">app.nucleos.com/rfps</span>
      </div>

      <div className="flex">
        {/* Sidebar rail */}
        <div className="hidden w-12 shrink-0 flex-col items-center gap-3.5 border-r border-border bg-sidebar py-3 sm:flex">
          <div className="relative flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
            <span className="text-[11px] font-bold text-primary-foreground">A</span>
            <span className="absolute right-1 top-1 h-1 w-1 rounded-full bg-[hsl(var(--teal))]" />
          </div>
          {NAV_ICONS.map((Icon, i) => (
            <div
              key={i}
              className={`flex h-7 w-7 items-center justify-center rounded-md ${
                i === 0 ? "bg-accent text-accent-foreground" : "text-muted-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
            </div>
          ))}
        </div>

        {/* Main column */}
        <div className="min-w-0 flex-1">
          {/* Top bar */}
          <div className="flex h-10 items-center justify-between border-b border-border px-4">
            <span className="text-xs font-semibold">RFP Ready</span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground">Nucleos</span>
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                N
              </span>
            </div>
          </div>

          <div className="space-y-3 p-3">
            {/* Stat tiles */}
            <div className="grid grid-cols-3 gap-2">
              {STATS.map((s) => (
                <div key={s.label} className="rounded-lg border border-border bg-card px-2.5 py-2">
                  <p className="text-sm font-bold leading-none text-foreground">{s.value}</p>
                  <p className="mt-1 text-[9px] leading-none text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Scan banner */}
            <div className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[hsl(var(--teal-tint))] text-[hsl(var(--teal-deep))]">
                  <RefreshCw className="h-3 w-3" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium leading-tight">Last scan: 2 days ago</p>
                  <p className="text-[10px] leading-tight text-emerald-600">6 new opportunities added</p>
                </div>
              </div>
              <div className="shrink-0 rounded-full bg-primary px-2.5 py-1 text-[10px] font-medium text-primary-foreground">
                Run scan now
              </div>
            </div>

            {/* Priority chips */}
            <div className="flex items-center gap-1.5 text-[10px] font-medium">
              <span className="mr-0.5 text-muted-foreground">Priority</span>
              <span className="rounded-full bg-primary px-2 py-0.5 text-primary-foreground">All 7</span>
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-700">Hot 2</span>
              <span className="rounded-full bg-lime-500/15 px-2 py-0.5 text-lime-700">High 3</span>
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-700">Med 2</span>
            </div>

            {/* RFP rows */}
            <div className="space-y-2">
              {RFPS.map((r) => (
                <div key={r.id} className="rounded-xl border border-border bg-card px-3 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[9px] text-muted-foreground">{r.id}</span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${priorityClass(r.priority)}`}
                        >
                          P{r.priority}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-[11px] font-semibold leading-tight">{r.title}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-[10px] leading-tight text-muted-foreground">
                        <Building2 className="h-2.5 w-2.5 shrink-0" /> {r.agency}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold ${r.recClass}`}
                    >
                      {r.rec}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <DollarSign className="h-2.5 w-2.5" />
                      {r.value}
                    </span>
                    <span className="text-border">·</span>
                    <span>{r.due}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

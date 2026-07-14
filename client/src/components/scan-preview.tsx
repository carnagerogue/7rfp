import { Search, Globe, Check } from "lucide-react";

// On-brand preview of the discovery scan surface — the companion visual to
// <AppPreview/>. Emphasizes sourced, qualified opportunities (not the pipeline).
const SOURCES = ["SAM.gov", "Cal eProcure", "BidNet", "HigherGov"];

const FOUND = [
  {
    title: "Statewide Inmate Education & Tablet Program",
    src: "sam.gov",
    match: "96%",
    tag: "GO",
    tagClass: "bg-emerald-500/15 text-emerald-700",
  },
  {
    title: "Reentry Workforce Development Services",
    src: "bidnetdirect.com",
    match: "91%",
    tag: "GO",
    tagClass: "bg-emerald-500/15 text-emerald-700",
  },
  {
    title: "County Jail Education & LMS Pilot",
    src: "highergov.com",
    match: "88%",
    tag: "WATCH",
    tagClass: "bg-sky-500/15 text-sky-700",
  },
  {
    title: "Juvenile Detention Digital Learning",
    src: "caleprocure.ca.gov",
    match: "84%",
    tag: "WATCH",
    tagClass: "bg-sky-500/15 text-sky-700",
  },
];

export function ScanPreview() {
  return (
    <div className="select-none bg-background text-left text-foreground">
      {/* Browser chrome */}
      <div className="flex items-center gap-1.5 border-b border-border bg-muted/40 px-3 py-2">
        <span className="h-2 w-2 rounded-full bg-red-400/70" />
        <span className="h-2 w-2 rounded-full bg-amber-400/70" />
        <span className="h-2 w-2 rounded-full bg-emerald-400/70" />
        <span className="ml-2 text-[9px] text-muted-foreground">app.nucleos.com/discovery</span>
      </div>

      <div className="space-y-3 p-3.5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[hsl(var(--teal-tint))] text-[hsl(var(--teal-deep))]">
              <Search className="h-3 w-3" />
            </div>
            <span className="text-xs font-semibold">Discovery scan</span>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
            <Check className="h-2.5 w-2.5" /> Scan complete · 6 found
          </span>
        </div>

        {/* Source chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground">Sources</span>
          {SOURCES.map((s) => (
            <span
              key={s}
              className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-medium text-foreground/80"
            >
              {s}
            </span>
          ))}
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
            +4
          </span>
        </div>

        {/* Discovered opportunities */}
        <div className="space-y-2">
          {FOUND.map((f) => (
            <div
              key={f.title}
              className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-semibold leading-tight">{f.title}</p>
                <p className="mt-0.5 flex items-center gap-1 text-[10px] leading-tight text-muted-foreground">
                  <Globe className="h-2.5 w-2.5 shrink-0" /> {f.src}
                </p>
              </div>
              <span className="shrink-0 text-[10px] font-medium text-[hsl(var(--teal-deep))]">
                {f.match} match
              </span>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold ${f.tagClass}`}
              >
                {f.tag}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

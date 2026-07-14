import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import AppShell from "./app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Slider } from "@/components/ui/slider";
import type { Rfp, Profile } from "@shared/schema";
import { computePriority, DEFAULT_WEIGHTS } from "@shared/schema";
import { Plus, FileText, Trash2, ExternalLink, Loader2, RefreshCw, Sliders, ArrowUpDown, ChevronUp, ChevronDown, Search, X, MessageSquare } from "lucide-react";

type RfpWithComments = Rfp & { commentCount: number; unreadCount: number };

function formatRelative(iso?: string | null): string {
  if (!iso) return "Never";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "Never";
  const diff = Date.now() - t;
  if (diff < 60_000) return "just now";
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
}

const REC_OPTIONS = [
  "GO — Pursue",
  "GO — Stretch",
  "WATCH — RFI",
  "WATCH — Recompete",
  "NO-GO",
];

function recBadgeClass(rec?: string | null) {
  if (!rec) return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200";
  if (rec.startsWith("GO — Pursue"))
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
  if (rec.startsWith("GO — Stretch"))
    return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
  if (rec.startsWith("WATCH — RFI"))
    return "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300";
  if (rec.startsWith("WATCH — Recompete"))
    return "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300";
  if (rec.startsWith("NO-GO"))
    return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300";
  return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200";
}

const REC_LEGEND: { code: string; label: string; full: string }[] = [
  { code: "GO", label: "Pursue", full: "GO — Pursue" },
  { code: "GS", label: "Stretch", full: "GO — Stretch" },
  { code: "WP", label: "Watch (RFI)", full: "WATCH — RFI" },
  { code: "WR", label: "Watch (Recompete)", full: "WATCH — Recompete" },
  { code: "NG", label: "No-Go", full: "NO-GO" },
];

// Heat colors for 1-5 priority — red(1) to green(5)
function priorityHeatClass(p: number): string {
  if (p >= 5) return "bg-emerald-600 text-white dark:bg-emerald-500";
  if (p === 4) return "bg-lime-500 text-white dark:bg-lime-500";
  if (p === 3) return "bg-amber-400 text-amber-950 dark:bg-amber-500";
  if (p === 2) return "bg-orange-500 text-white dark:bg-orange-500";
  return "bg-blue-600 text-white dark:bg-blue-500";
}

function priorityLabel(p: number): string {
  if (p >= 5) return "Hot";
  if (p === 4) return "High";
  if (p === 3) return "Med";
  if (p === 2) return "Low";
  return "Cold";
}

function statusPillClass(status: string) {
  switch (status) {
    case "drafting":
      return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
    case "reviewed":
      return "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300";
    case "downloaded":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
    default:
      return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200";
  }
}

function statusDotClass(status: string) {
  switch (status) {
    case "drafting":
      return "bg-amber-500";
    case "reviewed":
      return "bg-purple-500";
    case "downloaded":
      return "bg-emerald-500";
    default:
      return "bg-slate-400";
  }
}

function recShortCode(rec?: string | null): string {
  if (!rec) return "—";
  if (rec.startsWith("GO — Pursue")) return "GO";
  if (rec.startsWith("GO — Stretch")) return "GS";
  if (rec.startsWith("WATCH — RFI")) return "WP";
  if (rec.startsWith("WATCH — Recompete")) return "WR";
  if (rec.startsWith("WATCH")) return "WP";
  if (rec.startsWith("NO-GO")) return "NG";
  return rec.slice(0, 2).toUpperCase();
}

export default function RfpsPage() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [scoreEdit, setScoreEdit] = useState<Rfp | null>(null);
  const [weightOpen, setWeightOpen] = useState(false);
  const [sortByPriority, setSortByPriority] = useState(true);
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<number | null>(null);
  const [form, setForm] = useState({
    title: "",
    agency: "",
    dueDateText: "",
    valueText: "",
    url: "",
    recommendation: "GO — Pursue",
    notes: "",
  });

  const { data: profileData } = useQuery<{ profile: Profile | null }>({
    queryKey: ["/api/profile"],
  });
  const profile = profileData?.profile;
  const weights = {
    weightFit: profile?.weightFit ?? DEFAULT_WEIGHTS.weightFit,
    weightWin: profile?.weightWin ?? DEFAULT_WEIGHTS.weightWin,
    weightEffort: profile?.weightEffort ?? DEFAULT_WEIGHTS.weightEffort,
    weightValue: profile?.weightValue ?? DEFAULT_WEIGHTS.weightValue,
  };

  const { data, isLoading } = useQuery<{ rfps: RfpWithComments[]; commentTotal: number; unreadTotal: number }>({
    queryKey: ["/api/rfps"],
  });
  const rawRfps: RfpWithComments[] = data?.rfps ?? [];
  const q = search.trim().toLowerCase();
  // Pre-compute priority counts (over the search-filtered list, but BEFORE applying the
  // priority filter — so the chip badges always reflect the matching universe).
  const searchFiltered = q
    ? rawRfps.filter((r) => {
        const id = (r.trackingId || "").toLowerCase();
        const title = (r.title || "").toLowerCase();
        const agency = (r.agency || "").toLowerCase();
        return id.includes(q) || title.includes(q) || agency.includes(q);
      })
    : rawRfps;
  const priorityCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of searchFiltered) {
    const p = computePriority(r, weights);
    priorityCounts[p] = (priorityCounts[p] ?? 0) + 1;
  }
  const filteredRfps = priorityFilter
    ? searchFiltered.filter((r) => computePriority(r, weights) === priorityFilter)
    : searchFiltered;
  const rfps = sortByPriority
    ? [...filteredRfps].sort((a, b) => computePriority(b, weights) - computePriority(a, weights))
    : filteredRfps;

  const updateRfpMut = useMutation({
    mutationFn: async (input: { id: number; data: Partial<Rfp> }) => {
      const res = await apiRequest("PUT", `/api/rfps/${input.id}`, input.data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rfps"] });
      setScoreEdit(null);
    },
    onError: (err: any) => {
      toast({ title: "Failed to update RFP", description: err.message, variant: "destructive" });
    },
  });

  const updateWeightsMut = useMutation({
    mutationFn: async (w: typeof weights & { trackingPrefix?: string }) => {
      const res = await apiRequest("PUT", "/api/profile", w);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      setWeightOpen(false);
      toast({ title: "Priority weights updated" });
    },
  });

  const scanMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/scan/run", {});
      return (await res.json()) as { added: number; lastScanAt: string; mode: "live" | "demo" };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/rfps"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      toast({
        title: `Scan complete — added ${result.added} new opportunit${result.added === 1 ? "y" : "ies"}`,
        description:
          result.mode === "demo"
            ? "Live discovery is unavailable in this environment, so we added demo opportunities instead."
            : undefined,
      });
    },
    onError: (err: any) => {
      toast({
        title: "Scan failed — try again later",
        description: err?.message,
        variant: "destructive",
      });
    },
  });

  const createMut = useMutation({
    mutationFn: async (input: typeof form) => {
      const res = await apiRequest("POST", "/api/rfps", input);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rfps"] });
      setOpen(false);
      setForm({
        title: "",
        agency: "",
        dueDateText: "",
        valueText: "",
        url: "",
        recommendation: "GO — Pursue",
        notes: "",
      });
      toast({ title: "RFP added" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to add RFP", description: err.message, variant: "destructive" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/rfps/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rfps"] });
      toast({ title: "RFP deleted" });
    },
  });

  return (
    <AppShell title="RFP Ready">
      <div className="w-full max-w-screen-2xl mx-auto px-2 sm:px-4">
        {/* Discovery panel */}
        <Card
          className="p-4 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
          data-testid="panel-discovery"
        >
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <RefreshCw className="h-4 w-4" />
            </div>
            <div className="text-sm leading-relaxed">
              <p className="font-medium" data-testid="text-last-scan">
                Last scan: {formatRelative(profile?.lastScanAt)}
              </p>
              {profile && (profile.lastScanCount ?? 0) > 0 ? (
                <p className="text-muted-foreground" data-testid="text-last-scan-count">
                  Found {profile.lastScanCount} new opportunit{profile.lastScanCount === 1 ? "y" : "ies"} last scan.
                </p>
              ) : (
                <p className="text-muted-foreground">
                  Run discovery on demand after configuring sources on your Company Profile.
                </p>
              )}
            </div>
          </div>
          <Button
            onClick={() => scanMut.mutate()}
            disabled={scanMut.isPending}
            data-testid="button-run-scan"
          >
            {scanMut.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                Scanning…
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-1.5" />
                Run scan now
              </>
            )}
          </Button>
        </Card>

        {(data?.unreadTotal ?? 0) > 0 ? (
          <div
            className="mb-3 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40 px-3 py-2 text-sm"
            data-testid="banner-team-notes-unread"
          >
            <MessageSquare className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
            <span className="text-red-800 dark:text-red-200">
              <strong>Team Notes</strong> — {data?.unreadTotal} new comment{data?.unreadTotal === 1 ? "" : "s"} across your RFPs.
            </span>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="relative w-full sm:max-w-xs">
            <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Search ID, title, or agency…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-8 h-9"
              data-testid="input-search-rfps"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
                data-testid="button-clear-search"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Link href="/app/launch">
              <Button size="sm" data-testid="button-launch-rfp-wizard">
                <FileText className="h-3.5 w-3.5 mr-1.5" />
                Launch response wizard
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortByPriority((s) => !s)}
              data-testid="button-sort-priority"
              title={sortByPriority ? "Sorted by priority" : "Sorted by added date"}
            >
              <ArrowUpDown className="h-3.5 w-3.5 mr-1.5" />
              {sortByPriority ? "Priority" : "Added"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setWeightOpen(true)}
              data-testid="button-weights"
              title="Adjust priority weights"
            >
              <Sliders className="h-3.5 w-3.5 mr-1.5" />
              Weights
            </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-rfp">
                <Plus className="h-4 w-4 mr-1.5" />
                Add RFP
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Add an RFP</DialogTitle>
                <DialogDescription>Add an opportunity manually. Verify dates, value, and source before qualification.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="rfp-title">Title *</Label>
                  <Input
                    id="rfp-title"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    data-testid="input-rfp-title"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="rfp-agency">Agency</Label>
                    <Input
                      id="rfp-agency"
                      value={form.agency}
                      onChange={(e) => setForm({ ...form, agency: e.target.value })}
                      data-testid="input-rfp-agency"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="rfp-due">Due date</Label>
                    <Input
                      id="rfp-due"
                      placeholder="e.g. 2026-06-15"
                      value={form.dueDateText}
                      onChange={(e) => setForm({ ...form, dueDateText: e.target.value })}
                      data-testid="input-rfp-due"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="rfp-value">Estimated value</Label>
                    <Input
                      id="rfp-value"
                      placeholder="e.g. $1.5M"
                      value={form.valueText}
                      onChange={(e) => setForm({ ...form, valueText: e.target.value })}
                      data-testid="input-rfp-value"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label id="rfp-recommendation-label">Recommendation</Label>
                    <Select
                      value={form.recommendation}
                      onValueChange={(v) => setForm({ ...form, recommendation: v })}
                    >
                      <SelectTrigger aria-labelledby="rfp-recommendation-label" data-testid="select-rfp-rec">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {REC_OPTIONS.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rfp-url">URL</Label>
                  <Input
                    id="rfp-url"
                    placeholder="https://sam.gov/..."
                    value={form.url}
                    onChange={(e) => setForm({ ...form, url: e.target.value })}
                    data-testid="input-rfp-url"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rfp-notes">Notes</Label>
                  <Textarea
                    id="rfp-notes"
                    rows={3}
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    data-testid="input-rfp-notes"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => createMut.mutate(form)}
                  disabled={!form.title || createMut.isPending}
                  data-testid="button-save-rfp"
                >
                  {createMut.isPending ? "Adding..." : "Add RFP"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        {/* Priority filter chips */}
        <div className="flex flex-wrap items-center gap-1.5 mb-3" data-testid="priority-filter-bar">
          <span className="text-xs text-muted-foreground mr-1">Filter by priority:</span>
          <button
            type="button"
            onClick={() => setPriorityFilter(null)}
            className={`h-7 px-2.5 rounded-md text-xs font-medium border ${priorityFilter === null ? "bg-foreground text-background border-foreground" : "bg-background text-foreground border-border hover:bg-muted"}`}
            data-testid="filter-priority-all"
          >
            All ({searchFiltered.length})
          </button>
          {[5, 4, 3, 2, 1].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setPriorityFilter(priorityFilter === n ? null : n)}
              className={`h-7 inline-flex items-center gap-1.5 px-2 rounded-md text-xs font-medium border ${priorityFilter === n ? "ring-2 ring-offset-1 ring-violet-500 border-transparent" : "border-border hover:bg-muted"}`}
              data-testid={`filter-priority-${n}`}
              title={`Show only ${priorityLabel(n)} priority`}
            >
              <span className={`inline-flex items-center justify-center h-5 w-6 rounded text-xs font-semibold ${priorityHeatClass(n)}`}>{n}</span>
              <span>{priorityLabel(n)}</span>
              <span className="text-muted-foreground">({priorityCounts[n] ?? 0})</span>
            </button>
          ))}
        </div>

        <Card className="overflow-hidden">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : rfps.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-base font-medium mb-1">No RFPs yet</p>
              <p className="text-sm text-muted-foreground mb-5">
                Add your first to get started.
              </p>
              <Button onClick={() => setOpen(true)} data-testid="button-add-first-rfp">
                <Plus className="h-4 w-4 mr-1.5" />
                Add RFP
              </Button>
            </div>
          ) : (
            <div className="flex justify-center">
            <Table className="text-sm w-auto">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px] px-2 text-center">Priority</TableHead>
                  <TableHead className="w-[88px] px-2">ID</TableHead>
                  <TableHead className="px-2">Title / Agency</TableHead>
                  <TableHead className="w-[140px] px-2">Due / Value</TableHead>
                  <TableHead className="w-[140px] px-2 text-center">Recommendation</TableHead>
                  <TableHead className="text-right w-[120px] pl-2 pr-3">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rfps.map((rfp) => {
                  const p = computePriority(rfp, weights);
                  return (
                  <TableRow key={rfp.id} data-testid={`row-rfp-${rfp.id}`}>
                    <TableCell className="px-2 text-center">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setScoreEdit(rfp)}
                          className={`inline-flex items-center justify-center h-7 w-8 rounded-md text-sm font-semibold ${priorityHeatClass(p)} ${rfp.priorityOverride ? "ring-2 ring-offset-1 ring-violet-400" : ""}`}
                          title={`${priorityLabel(p)}${rfp.priorityOverride ? " (manual override)" : ""} — click to edit`}
                          data-testid={`priority-${rfp.id}`}
                        >
                          {p}
                        </button>
                        <div className="flex flex-col">
                          <button
                            type="button"
                            onClick={() => updateRfpMut.mutate({ id: rfp.id, data: { priorityOverride: Math.min(5, p + 1) } })}
                            disabled={p >= 5 || updateRfpMut.isPending}
                            className="h-3.5 w-4 inline-flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30"
                            title="Bump priority up"
                            aria-label="Increase priority"
                            data-testid={`priority-up-${rfp.id}`}
                          >
                            <ChevronUp className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => updateRfpMut.mutate({ id: rfp.id, data: { priorityOverride: Math.max(1, p - 1) } })}
                            disabled={p <= 1 || updateRfpMut.isPending}
                            className="h-3.5 w-4 inline-flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30"
                            title="Bump priority down"
                            aria-label="Decrease priority"
                            data-testid={`priority-down-${rfp.id}`}
                          >
                            <ChevronDown className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground px-2 whitespace-nowrap">
                      {rfp.trackingId || "—"}
                    </TableCell>
                    <TableCell className="px-2 max-w-[460px]" data-testid={`text-title-${rfp.id}`}>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className={`inline-block h-2 w-2 rounded-full shrink-0 ${statusDotClass(rfp.status)}`}
                            title={`Status: ${rfp.status}`}
                            aria-label={`Status: ${rfp.status}`}
                          />
                          <span className="font-medium truncate">{rfp.title}</span>
                        </div>
                        <span className="text-xs text-muted-foreground truncate pl-3.5 block">
                          {rfp.agency || "—"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="px-2 whitespace-nowrap">
                      <div className="flex flex-col text-xs leading-tight">
                        <span className="text-foreground">{rfp.dueDateText || "—"}</span>
                        <span className="text-muted-foreground truncate">{rfp.valueText || "—"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="px-2 text-center">
                      {rfp.recommendation ? (
                        <Badge
                          variant="outline"
                          className={`border-0 px-1.5 font-mono text-xs ${recBadgeClass(rfp.recommendation)}`}
                          title={rfp.recommendation}
                        >
                          {recShortCode(rfp.recommendation)}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right pl-2 pr-3">
                      <div className="inline-flex items-center gap-0.5">
                        {rfp.url ? (
                          <a
                            href={rfp.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            data-testid={`link-source-${rfp.id}`}
                          >
                            <Button size="icon" variant="ghost" title="Open original RFP posting" className="h-8 w-8">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          </a>
                        ) : null}
                        <Link href={`/app/rfps/${rfp.id}#notes`}>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 relative"
                            title={
                              rfp.unreadCount > 0
                                ? `Team Notes — ${rfp.unreadCount} new of ${rfp.commentCount}`
                                : rfp.commentCount > 0
                                ? `Team Notes — ${rfp.commentCount} comment${rfp.commentCount === 1 ? "" : "s"}`
                                : "Team Notes — start a thread"
                            }
                            aria-label="Open Team Notes"
                            data-testid={`button-team-notes-${rfp.id}`}
                          >
                            <MessageSquare
                              className={`h-3.5 w-3.5 ${rfp.commentCount > 0 ? "text-foreground" : "text-muted-foreground"}`}
                            />
                            {rfp.commentCount > 0 ? (
                              <span
                                className={`absolute -top-0.5 -right-0.5 inline-flex items-center justify-center rounded-full text-[9px] leading-none font-semibold min-w-[14px] h-[14px] px-1 ${
                                  rfp.unreadCount > 0
                                    ? "bg-red-600 text-white"
                                    : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                                }`}
                              >
                                {rfp.unreadCount > 0 ? rfp.unreadCount : rfp.commentCount}
                              </span>
                            ) : null}
                          </Button>
                        </Link>
                        <Link href={`/app/rfps/${rfp.id}`}>
                          <Button size="sm" variant="outline" data-testid={`button-open-${rfp.id}`} className="h-8 px-2">
                            Open
                          </Button>
                        </Link>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            if (confirm("Delete this RFP and its draft proposal?"))
                              deleteMut.mutate(rfp.id);
                          }}
                          data-testid={`button-delete-${rfp.id}`}
                          aria-label="Delete"
                          className="h-8 w-8"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
          )}
          {rfps.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Recommendation key:</span>
              {REC_LEGEND.map((item) => (
                <span key={item.code} className="inline-flex items-center gap-1.5" title={item.full}>
                  <Badge
                    variant="outline"
                    className={`border-0 px-1.5 font-mono text-[10px] ${recBadgeClass(item.full)}`}
                  >
                    {item.code}
                  </Badge>
                  <span>{item.label}</span>
                </span>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Priority edit dialog */}
      <Dialog open={!!scoreEdit} onOpenChange={(o) => !o && setScoreEdit(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Priority — {scoreEdit?.trackingId || scoreEdit?.title}
            </DialogTitle>
            <DialogDescription>Score strategic fit or set a deliberate priority override.</DialogDescription>
          </DialogHeader>
          {scoreEdit && (
            <ScoreEditor
              rfp={scoreEdit}
              weights={weights}
              onSave={(payload) =>
                updateRfpMut.mutate({ id: scoreEdit.id, data: payload })
              }
              onClear={() =>
                updateRfpMut.mutate({ id: scoreEdit.id, data: { priorityOverride: null } })
              }
              saving={updateRfpMut.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Weights dialog */}
      <Dialog open={weightOpen} onOpenChange={setWeightOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Priority weights</DialogTitle>
            <DialogDescription>Adjust how fit, value, urgency, and win probability affect pipeline priority.</DialogDescription>
          </DialogHeader>
          <WeightsEditor
            initial={weights}
            initialPrefix={profile?.trackingPrefix || "RFP"}
            onSave={(payload) => updateWeightsMut.mutate(payload)}
            saving={updateWeightsMut.isPending}
          />
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

// ---------- Score editor ----------
function ScoreEditor(props: {
  rfp: Rfp;
  weights: { weightFit: number; weightWin: number; weightEffort: number; weightValue: number };
  onSave: (data: Partial<Rfp>) => void;
  onClear: () => void;
  saving: boolean;
}) {
  const { rfp, weights, onSave, onClear, saving } = props;
  const [fit, setFit] = useState(rfp.scoreFit ?? 3);
  const [win, setWin] = useState(rfp.scoreWin ?? 3);
  const [effort, setEffort] = useState(rfp.scoreEffort ?? 3);
  const [value, setValue] = useState(rfp.scoreValue ?? 3);
  const [override, setOverride] = useState<number | null>(rfp.priorityOverride ?? null);

  const computed = computePriority(
    { scoreFit: fit, scoreWin: win, scoreEffort: effort, scoreValue: value, priorityOverride: null },
    weights
  );
  const final = override ?? computed;

  return (
    <div className="space-y-4">
      <ScoreSlider label="Fit — how well does it match" value={fit} onChange={setFit} hint="5 = bullseye" />
      <ScoreSlider label="Win probability" value={win} onChange={setWin} hint="5 = highly likely" />
      <ScoreSlider label="Effort" value={effort} onChange={setEffort} hint="1 = light, 5 = heavy" inverted />
      <ScoreSlider label="Strategic value / $$" value={value} onChange={setValue} hint="5 = marquee deal" />

      <div className="flex items-center justify-between border-t pt-3">
        <div className="text-sm">
          <div className="text-muted-foreground">Computed</div>
          <div className="flex items-center gap-2 mt-1">
            <span className={`inline-flex items-center justify-center h-7 w-9 rounded-md text-sm font-semibold ${priorityHeatClass(computed)}`}>{computed}</span>
            <span className="text-xs text-muted-foreground">{priorityLabel(computed)}</span>
          </div>
        </div>
        <div className="text-sm">
          <div className="text-muted-foreground">Final</div>
          <div className="flex items-center gap-2 mt-1">
            <span className={`inline-flex items-center justify-center h-7 w-9 rounded-md text-sm font-semibold ${priorityHeatClass(final)} ${override ? "ring-2 ring-offset-1 ring-violet-400" : ""}`}>{final}</span>
            <span className="text-xs text-muted-foreground">{override ? "manual" : "auto"}</span>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Manual override (optional)</Label>
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setOverride(override === n ? null : n)}
              className={`h-8 w-10 rounded-md text-sm font-semibold ${priorityHeatClass(n)} ${override === n ? "ring-2 ring-offset-1 ring-violet-500" : "opacity-60 hover:opacity-100"}`}
            >
              {n}
            </button>
          ))}
          <Button variant="ghost" size="sm" onClick={() => setOverride(null)} disabled={override === null}>
            Use auto
          </Button>
        </div>
      </div>

      <DialogFooter>
        <Button
          variant="outline"
          onClick={() => onClear()}
          disabled={saving || rfp.priorityOverride === null}
        >
          Reset override
        </Button>
        <Button
          onClick={() =>
            onSave({
              scoreFit: fit,
              scoreWin: win,
              scoreEffort: effort,
              scoreValue: value,
              priorityOverride: override,
            })
          }
          disabled={saving}
        >
          {saving ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </div>
  );
}

function ScoreSlider(props: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
  inverted?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-sm">{props.label}</Label>
        <span className="text-sm font-mono tabular-nums w-6 text-right">{props.value}</span>
      </div>
      <Slider
        min={1}
        max={5}
        step={1}
        value={[props.value]}
        onValueChange={(v) => props.onChange(v[0])}
      />
      {props.hint ? <p className="text-[11px] text-muted-foreground">{props.hint}</p> : null}
    </div>
  );
}

// ---------- Weights editor ----------
function WeightsEditor(props: {
  initial: { weightFit: number; weightWin: number; weightEffort: number; weightValue: number };
  initialPrefix: string;
  onSave: (
    data: { weightFit: number; weightWin: number; weightEffort: number; weightValue: number; trackingPrefix?: string }
  ) => void;
  saving: boolean;
}) {
  const [fit, setFit] = useState(props.initial.weightFit);
  const [win, setWin] = useState(props.initial.weightWin);
  const [effort, setEffort] = useState(props.initial.weightEffort);
  const [value, setValue] = useState(props.initial.weightValue);
  const [prefix, setPrefix] = useState(props.initialPrefix);

  const total = fit + win + effort + value || 1;

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Higher weight → that factor matters more. Total auto-normalizes (currently {total}).
      </p>

      <WeightSlider label="Fit" value={fit} onChange={setFit} pct={Math.round((fit / total) * 100)} />
      <WeightSlider label="Win probability" value={win} onChange={setWin} pct={Math.round((win / total) * 100)} />
      <WeightSlider label="Effort (lower = better)" value={effort} onChange={setEffort} pct={Math.round((effort / total) * 100)} />
      <WeightSlider label="Strategic value" value={value} onChange={setValue} pct={Math.round((value / total) * 100)} />

      <div className="space-y-1.5 border-t pt-3">
        <Label className="text-sm">Tracking ID prefix</Label>
        <Input
          value={prefix}
          onChange={(e) => setPrefix(e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 6))}
          placeholder="e.g. NUC"
          maxLength={6}
        />
        <p className="text-[11px] text-muted-foreground">
          New RFPs will be numbered like <span className="font-mono">{prefix || "RFP"}-0001</span>. Existing IDs aren’t changed.
        </p>
      </div>

      <DialogFooter>
        <Button
          onClick={() =>
            props.onSave({
              weightFit: fit,
              weightWin: win,
              weightEffort: effort,
              weightValue: value,
              trackingPrefix: prefix || "RFP",
            })
          }
          disabled={props.saving}
        >
          {props.saving ? "Saving…" : "Save weights"}
        </Button>
      </DialogFooter>
    </div>
  );
}

function WeightSlider(props: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  pct: number;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-sm">{props.label}</Label>
        <span className="text-xs text-muted-foreground tabular-nums">{props.pct}%</span>
      </div>
      <Slider
        min={0}
        max={100}
        step={5}
        value={[props.value]}
        onValueChange={(v) => props.onChange(v[0])}
      />
    </div>
  );
}

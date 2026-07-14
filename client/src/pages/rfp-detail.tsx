import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import AppShell from "./app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import type { Profile, Proposal, Rfp, RfpComment, RfpRequirement } from "@shared/schema";
import {
  AlertTriangle,
  ArrowLeft,
  BrainCircuit,
  BookOpenCheck,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  Download,
  ExternalLink,
  FileSearch,
  FileWarning,
  MessageSquare,
  Plus,
  Save,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Target,
  UserRound,
  XCircle,
} from "lucide-react";

type WorkspaceTab = "overview" | "compliance" | "draft" | "review" | "intelligence";

type IntelligenceAction = "pursuit_brief" | "win_themes" | "compliance_gaps" | "red_team_review" | "draft_response";
type CitedPoint = { text: string; sourceIds: string[] };
type IntelligenceRisk = CitedPoint & { title: string; severity: "high" | "medium" | "low"; detail: string };
type IntelligenceResult = {
  headline: string;
  summary: string;
  winThemes: CitedPoint[];
  complianceRisks: IntelligenceRisk[];
  questions: CitedPoint[];
  redTeamFindings: IntelligenceRisk[];
  draft: string;
};
type IntelligenceRun = {
  id: number;
  action: IntelligenceAction;
  model: string;
  result: IntelligenceResult;
  sourceIds: string[];
  usage: { inputTokens: number; outputTokens: number };
  createdAt: string;
};

const SECTIONS: { key: keyof Proposal; title: string; help: string }[] = [
  { key: "executiveSummary", title: "Executive summary", help: "Make evaluator value and fit obvious." },
  { key: "companyOverview", title: "Company overview", help: "Capabilities, certifications, and key personnel." },
  { key: "understanding", title: "Understanding", help: "Reflect agency mission, constraints, and desired outcomes." },
  { key: "technicalApproach", title: "Technical approach", help: "Execution, governance, risk, and quality." },
  { key: "pastPerformance", title: "Past performance", help: "Relevant contracts, outcomes, and references." },
  { key: "pricingApproach", title: "Pricing approach", help: "Cost structure, assumptions, and value." },
  { key: "timeline", title: "Implementation timeline", help: "Phased schedule from kickoff through closeout." },
  { key: "conclusion", title: "Conclusion", help: "Final evaluator-focused case for award." },
];

const STATUS_META = {
  covered: { label: "Covered", icon: CheckCircle2, className: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  needs_evidence: { label: "Needs evidence", icon: AlertTriangle, className: "text-amber-700 bg-amber-50 border-amber-200" },
  gap: { label: "Gap", icon: XCircle, className: "text-red-700 bg-red-50 border-red-200" },
} as const;

function StatusMark({ status }: { status: string }) {
  const meta = STATUS_META[status as keyof typeof STATUS_META] ?? STATUS_META.gap;
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium ${meta.className}`}>
      <Icon className="h-3.5 w-3.5" />
      {meta.label}
    </span>
  );
}

function MetricLine({ icon, children, tone = "muted" }: { icon: React.ReactNode; children: React.ReactNode; tone?: "muted" | "warning" | "danger" }) {
  const color = tone === "warning" ? "text-amber-700" : tone === "danger" ? "text-red-700" : "text-muted-foreground";
  return <div className={`flex items-center gap-2 text-sm ${color}`}>{icon}{children}</div>;
}

function CitationChips({ sourceIds }: { sourceIds: string[] }) {
  return <div className="flex flex-wrap gap-1.5 mt-2">{sourceIds.map((sourceId) => <span key={sourceId} className="inline-flex items-center gap-1 border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[11px] font-medium text-primary"><BookOpenCheck className="h-3 w-3" />{sourceId}</span>)}</div>;
}

function SeverityMark({ severity }: { severity: IntelligenceRisk["severity"] }) {
  const tone = severity === "high" ? "border-red-200 bg-red-50 text-red-700" : severity === "medium" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-emerald-200 bg-emerald-50 text-emerald-700";
  return <span className={`inline-flex border px-1.5 py-0.5 text-[11px] font-medium capitalize ${tone}`}>{severity}</span>;
}

function IntelligenceWorkspace({ rfpId, onApplyDraft }: { rfpId: number; onApplyDraft: (draft: string) => void }) {
  const { toast } = useToast();
  const [focus, setFocus] = useState("");
  const [activeAction, setActiveAction] = useState<IntelligenceAction>("pursuit_brief");
  const { data, isLoading } = useQuery<{ run: IntelligenceRun | null }>({ queryKey: ["/api/rfps", rfpId, "intelligence", "latest"] });
  const run = data?.run ?? null;
  const intelligenceMut = useMutation({
    mutationFn: async (action: IntelligenceAction) => {
      const response = await apiRequest("POST", `/api/rfps/${rfpId}/intelligence`, { action, focus: focus.trim() || undefined });
      return (await response.json()) as { run: IntelligenceRun };
    },
    onSuccess: ({ run: next }) => {
      queryClient.setQueryData(["/api/rfps", rfpId, "intelligence", "latest"], { run: next });
      toast({ title: "Grounded analysis ready", description: `${next.usage.outputTokens.toLocaleString()} output tokens · every insight cites stored source material.` });
    },
    onError: (error: Error) => toast({ title: "Could not run pursuit intelligence", description: error.message, variant: "destructive" }),
  });

  const actions: Array<{ id: IntelligenceAction; label: string; icon: React.ElementType }> = [
    { id: "pursuit_brief", label: "Pursuit brief", icon: BrainCircuit },
    { id: "win_themes", label: "Win themes", icon: Target },
    { id: "compliance_gaps", label: "Compliance gaps", icon: ShieldAlert },
    { id: "red_team_review", label: "Red-team review", icon: FileWarning },
    { id: "draft_response", label: "Draft response", icon: Sparkles },
  ];

  if (isLoading) return <Skeleton className="h-[680px] w-full" />;
  const result = run?.result;
  return (
    <section className="border border-border bg-white" data-testid="pursuit-intelligence-workspace">
      <header className="p-4 md:p-5 border-b border-border">
        <div className="flex flex-wrap gap-4 items-start justify-between">
          <div><h3 className="text-xl font-semibold tracking-tight">Pursuit intelligence</h3><p className="text-sm text-muted-foreground mt-1">Claude analyzes only stored RFP and company evidence. Every insight shows its source.</p></div>
          <div className="text-xs text-muted-foreground border border-border px-3 py-2">Model · Claude Sonnet 5</div>
        </div>
        <div className="mt-5 flex gap-2">
          <Input value={focus} onChange={(event) => setFocus(event.target.value)} maxLength={280} placeholder="Focus this analysis, e.g. security differentiators or evaluator risks" aria-label="Analysis focus" />
          <Button onClick={() => intelligenceMut.mutate(activeAction)} disabled={intelligenceMut.isPending}>{intelligenceMut.isPending ? "Analyzing…" : "Analyze"}</Button>
        </div>
        <div className="mt-3 grid grid-cols-2 lg:grid-cols-5 gap-2">
          {actions.map((action) => { const Icon = action.icon; return <Button key={action.id} variant={activeAction === action.id ? "default" : "outline"} className="justify-start" onClick={() => { setActiveAction(action.id); intelligenceMut.mutate(action.id); }} disabled={intelligenceMut.isPending}><Icon className="h-4 w-4 mr-1.5" />{action.label}</Button>; })}
        </div>
      </header>

      {!result ? <div className="min-h-[480px] flex items-center justify-center p-8 text-center"><div className="max-w-lg"><BrainCircuit className="h-10 w-10 text-primary mx-auto mb-4" /><h4 className="text-lg font-semibold">Turn source material into a pursuit decision</h4><p className="text-sm text-muted-foreground leading-relaxed mt-2">Build your compliance matrix and company profile first. Then generate a grounded brief, red-team review, or evidence-aware draft.</p><Button className="mt-5" onClick={() => intelligenceMut.mutate("pursuit_brief")} disabled={intelligenceMut.isPending}>Create pursuit brief</Button></div></div> :
        <div className="grid xl:grid-cols-[1fr_300px] min-h-[590px]">
          <div className="p-4 md:p-5 space-y-4 min-w-0">
            <section className="border border-border p-4 bg-slate-50/60"><h4 className="font-semibold">{result.headline}</h4><p className="text-sm leading-relaxed text-muted-foreground mt-2">{result.summary}</p></section>
            <div className="grid lg:grid-cols-2 gap-4">
              <section className="border border-border p-4"><div className="flex items-center gap-2"><Target className="h-4 w-4 text-emerald-700" /><h4 className="font-semibold">Win themes</h4></div><div className="mt-3 space-y-3">{result.winThemes.length ? result.winThemes.map((point, index) => <div key={`${point.text}-${index}`} className="text-sm leading-relaxed"><p>{point.text}</p><CitationChips sourceIds={point.sourceIds} /></div>) : <p className="text-sm text-muted-foreground">No verified win themes found.</p>}</div></section>
              <section className="border border-border p-4"><div className="flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-amber-700" /><h4 className="font-semibold">Compliance risks</h4></div><div className="mt-3 space-y-3">{result.complianceRisks.length ? result.complianceRisks.map((risk, index) => <div key={`${risk.title}-${index}`}><div className="flex gap-2 items-start justify-between"><p className="text-sm font-medium">{risk.title}</p><SeverityMark severity={risk.severity} /></div><p className="text-sm text-muted-foreground mt-1 leading-relaxed">{risk.detail}</p><CitationChips sourceIds={risk.sourceIds} /></div>) : <p className="text-sm text-muted-foreground">No source-backed risks found.</p>}</div></section>
              <section className="border border-border p-4"><div className="flex items-center gap-2"><FileSearch className="h-4 w-4 text-primary" /><h4 className="font-semibold">Questions to resolve</h4></div><div className="mt-3 space-y-3">{result.questions.length ? result.questions.map((point, index) => <div key={`${point.text}-${index}`} className="text-sm leading-relaxed"><p>{point.text}</p><CitationChips sourceIds={point.sourceIds} /></div>) : <p className="text-sm text-muted-foreground">No source-backed questions found.</p>}</div></section>
              <section className="border border-border p-4"><div className="flex items-center gap-2"><FileWarning className="h-4 w-4 text-red-700" /><h4 className="font-semibold">Red-team findings</h4></div><div className="mt-3 space-y-3">{result.redTeamFindings.length ? result.redTeamFindings.map((risk, index) => <div key={`${risk.title}-${index}`}><div className="flex gap-2 items-start justify-between"><p className="text-sm font-medium">{risk.title}</p><SeverityMark severity={risk.severity} /></div><p className="text-sm text-muted-foreground mt-1 leading-relaxed">{risk.detail}</p><CitationChips sourceIds={risk.sourceIds} /></div>) : <p className="text-sm text-muted-foreground">No source-backed red-team findings found.</p>}</div></section>
            </div>
            {result.draft ? <section className="border border-primary/30 p-4 bg-blue-50/40"><div className="flex gap-3 justify-between items-center"><div><h4 className="font-semibold">Evidence-aware draft</h4><p className="text-xs text-muted-foreground mt-1">Review before applying. This does not auto-save or create commitments.</p></div><Button variant="outline" onClick={() => onApplyDraft(result.draft)}>Use in executive summary</Button></div><p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">{result.draft}</p></section> : null}
          </div>
          <aside className="border-t xl:border-t-0 xl:border-l border-border p-4 bg-slate-50/60"><h4 className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-semibold">Grounding ledger</h4><div className="mt-4 border border-emerald-200 bg-emerald-50 p-3"><div className="flex items-center gap-2 text-emerald-800 font-semibold text-sm"><ShieldCheck className="h-4 w-4" />No unsupported claims</div><p className="text-xs text-emerald-800/80 mt-1 leading-relaxed">Result rejected if it cites a source outside this pursuit.</p></div><div className="mt-5"><div className="text-xs font-semibold">Sources used ({run.sourceIds.length})</div><div className="mt-2 space-y-2">{run.sourceIds.map((sourceId) => <div key={sourceId} className="border border-border bg-white px-2.5 py-2 text-xs font-medium">{sourceId}</div>)}</div></div><div className="mt-5 pt-4 border-t border-border text-xs text-muted-foreground space-y-1"><p>{run.model}</p><p>{run.usage.inputTokens.toLocaleString()} input · {run.usage.outputTokens.toLocaleString()} output tokens</p><p>{new Date(run.createdAt).toLocaleString()}</p></div></aside>
        </div>}
    </section>
  );
}

function ComplianceWorkspace({ rfpId, recommendation }: { rfpId: number; recommendation?: string | null }) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showImporter, setShowImporter] = useState(false);
  const [solicitationText, setSolicitationText] = useState("");
  const [evidenceDraft, setEvidenceDraft] = useState({ owner: "", evidenceTitle: "", evidenceText: "" });

  const { data, isLoading } = useQuery<{ requirements: RfpRequirement[] }>({
    queryKey: ["/api/rfps", rfpId, "requirements"],
  });
  const requirements = data?.requirements ?? [];
  const selected = requirements.find((item) => item.id === selectedId) ?? requirements[0] ?? null;

  useEffect(() => {
    if (!selected) return;
    setSelectedId(selected.id);
    setEvidenceDraft({
      owner: selected.owner ?? "",
      evidenceTitle: selected.evidenceTitle ?? "",
      evidenceText: selected.evidenceText ?? "",
    });
  }, [selected?.id]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return requirements;
    return requirements.filter((item) =>
      [item.requirementText, item.sourceRef, item.owner, item.evidenceTitle]
        .some((value) => value?.toLowerCase().includes(term)),
    );
  }, [requirements, search]);

  const stats = useMemo(() => {
    const covered = requirements.filter((item) => item.status === "covered").length;
    const needsEvidence = requirements.filter((item) => item.status === "needs_evidence").length;
    const ownerGaps = requirements.filter((item) => !item.owner).length;
    const ready = requirements.length ? Math.round((covered / requirements.length) * 100) : 0;
    return { covered, needsEvidence, ownerGaps, ready };
  }, [requirements]);
  const decision = recommendation?.trim() || "WATCH — Qualification pending";
  const decisionTone = decision.startsWith("NO-GO") ? "text-red-700" : decision.startsWith("WATCH") ? "text-amber-700" : "text-emerald-700";

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["/api/rfps", rfpId, "requirements"] });

  const extractMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/rfps/${rfpId}/requirements/extract`, { solicitationText });
      return res.json();
    },
    onSuccess: (result) => {
      refresh();
      setSolicitationText("");
      setShowImporter(false);
      toast({ title: `${result.added} requirements extracted`, description: "Review every source line before using it in the proposal." });
    },
    onError: (error: Error) => toast({ title: "Could not extract requirements", description: error.message, variant: "destructive" }),
  });

  const addMut = useMutation({
    mutationFn: async () => apiRequest("POST", `/api/rfps/${rfpId}/requirements`, {
      requirementText: "New requirement — replace with exact solicitation language",
      sourceRef: "Manual entry",
      sourceExcerpt: "",
      owner: null,
      evidenceTitle: null,
      evidenceText: null,
      status: "gap",
      confidence: 0,
    }).then((res) => res.json()),
    onSuccess: (result) => {
      refresh();
      setSelectedId(result.requirement.id);
    },
  });

  const updateRequirement = async (id: number, patch: Partial<RfpRequirement>) => {
    await apiRequest("PUT", `/api/rfps/${rfpId}/requirements/${id}`, patch);
    await refresh();
  };

  const saveEvidenceMut = useMutation({
    mutationFn: async () => {
      if (!selected) return;
      const hasEvidence = evidenceDraft.evidenceTitle.trim() || evidenceDraft.evidenceText.trim();
      await updateRequirement(selected.id, {
        owner: evidenceDraft.owner.trim() || null,
        evidenceTitle: evidenceDraft.evidenceTitle.trim() || null,
        evidenceText: evidenceDraft.evidenceText.trim() || null,
        status: hasEvidence ? "covered" : "needs_evidence",
        confidence: hasEvidence ? 80 : 25,
      });
    },
    onSuccess: () => toast({ title: "Evidence saved", description: "Requirement readiness updated." }),
  });

  if (isLoading) return <Skeleton className="h-[620px] w-full" />;

  return (
    <div className="border border-border bg-white min-h-[620px]" data-testid="compliance-workspace">
      <div className="grid xl:grid-cols-[210px_minmax(480px,1fr)_300px] min-h-[620px]">
        <aside className="border-b xl:border-b-0 xl:border-r border-border p-4 space-y-5 bg-slate-50/60">
          <section>
            <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-semibold mb-2">Readiness</div>
            <div className="text-4xl tracking-tight font-semibold text-emerald-700">{stats.ready}%</div>
            <div className="text-sm text-emerald-700 mt-0.5">ready</div>
            <div className="h-1.5 rounded-full bg-slate-200 mt-4 overflow-hidden">
              <div className="h-full bg-emerald-600 transition-all" style={{ width: `${stats.ready}%` }} />
            </div>
            <p className="mt-3 text-sm"><strong>{stats.covered}</strong> of {requirements.length} requirements covered</p>
          </section>
          <div className="border-t border-border pt-4 space-y-3">
            <MetricLine tone="warning" icon={<AlertTriangle className="h-4 w-4" />}><strong>{stats.needsEvidence}</strong> need evidence</MetricLine>
            <MetricLine tone="danger" icon={<UserRound className="h-4 w-4" />}><strong>{stats.ownerGaps}</strong> owner gaps</MetricLine>
          </div>
          <section className="border-t border-border pt-4">
            <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-semibold mb-2">Go / no-go</div>
            <div className={`text-xl font-semibold ${decisionTone}`}>{decision}</div>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">Decision uses opportunity qualification. Compliance readiness remains separate.</p>
          </section>
        </aside>

        <section className="min-w-0">
          <div className="p-3 border-b border-border flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search requirements, owners, or evidence" className="pl-9" />
            </div>
            <Button variant="outline" onClick={() => setShowImporter((value) => !value)}>
              <FileSearch className="h-4 w-4 mr-1.5" /> Import text
            </Button>
            <Button variant="outline" onClick={() => addMut.mutate()} disabled={addMut.isPending}>
              <Plus className="h-4 w-4 mr-1.5" /> Add
            </Button>
          </div>

          {showImporter ? (
            <div className="p-4 border-b border-border bg-slate-50">
              <label className="text-sm font-semibold" htmlFor="solicitation-text">Paste solicitation text</label>
              <p className="text-xs text-muted-foreground mt-1 mb-3">Extracts shall, must, required, and contractor obligations. No synthetic requirements added.</p>
              <Textarea id="solicitation-text" rows={7} value={solicitationText} onChange={(event) => setSolicitationText(event.target.value)} placeholder="Paste Section C, L, M, PWS, or SOW text…" />
              <div className="flex justify-end mt-3">
                <Button onClick={() => extractMut.mutate()} disabled={extractMut.isPending || solicitationText.trim().length < 20}>
                  <BookOpenCheck className="h-4 w-4 mr-1.5" />
                  {extractMut.isPending ? "Extracting…" : "Build compliance matrix"}
                </Button>
              </div>
            </div>
          ) : null}

          {requirements.length === 0 ? (
            <div className="min-h-[480px] flex items-center justify-center p-8 text-center">
              <div className="max-w-md">
                <ShieldCheck className="h-10 w-10 text-primary mx-auto mb-4" />
                <h3 className="text-lg font-semibold">Build requirement traceability first</h3>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">Paste solicitation text. Achieve RFP extracts obligation language into a reviewable matrix before drafting starts.</p>
                <Button className="mt-5" onClick={() => setShowImporter(true)}>Import solicitation text</Button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="text-left text-xs text-muted-foreground border-b border-border bg-slate-50/70">
                  <tr>
                    <th className="font-medium px-4 py-3 w-[45%]">Requirement</th>
                    <th className="font-medium px-3 py-3">Source</th>
                    <th className="font-medium px-3 py-3">Owner</th>
                    <th className="font-medium px-3 py-3">Evidence</th>
                    <th className="font-medium px-3 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedId(item.id)}
                      className={`border-b border-border cursor-pointer hover:bg-slate-50 ${selected?.id === item.id ? "bg-blue-50/70 shadow-[inset_3px_0_0_#243f7d]" : ""}`}
                    >
                      <td className="px-4 py-3 align-top leading-relaxed">{item.requirementText}</td>
                      <td className="px-3 py-3 align-top text-xs text-primary font-medium">{item.sourceRef || "—"}</td>
                      <td className="px-3 py-3 align-top text-xs">{item.owner || <span className="text-red-700">Unassigned</span>}</td>
                      <td className="px-3 py-3 align-top text-xs">{item.evidenceTitle ? <span className="inline-flex items-center gap-1 text-emerald-700"><Check className="h-3.5 w-3.5" /> 1</span> : "0"}</td>
                      <td className="px-3 py-3 align-top"><StatusMark status={item.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="border-t xl:border-t-0 xl:border-l border-border p-4 bg-white">
          {selected ? (
            <div className="space-y-5">
              <div>
                <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-semibold">Evidence inspector</div>
                <div className="mt-3"><StatusMark status={selected.status} /></div>
              </div>
              <section className="border-t border-border pt-4">
                <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-semibold">Source · {selected.sourceRef || "Manual"}</div>
                <blockquote className="mt-2 text-sm leading-relaxed border-l-2 border-primary pl-3">{selected.sourceExcerpt || selected.requirementText}</blockquote>
              </section>
              <section className="border-t border-border pt-4 space-y-3">
                <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-semibold">Approved company proof</div>
                <label className="sr-only" htmlFor="evidence-title">Evidence title</label>
                <Input id="evidence-title" value={evidenceDraft.evidenceTitle} onChange={(event) => setEvidenceDraft((draft) => ({ ...draft, evidenceTitle: event.target.value }))} placeholder="Evidence title" />
                <label className="sr-only" htmlFor="evidence-text">Approved evidence</label>
                <Textarea id="evidence-text" rows={5} value={evidenceDraft.evidenceText} onChange={(event) => setEvidenceDraft((draft) => ({ ...draft, evidenceText: event.target.value }))} placeholder="Paste approved proof, outcome, certification, or past-performance evidence." />
              </section>
              <section className="border-t border-border pt-4 space-y-2">
                <label className="text-xs font-semibold" htmlFor="requirement-owner">Owner</label>
                <Input id="requirement-owner" value={evidenceDraft.owner} onChange={(event) => setEvidenceDraft((draft) => ({ ...draft, owner: event.target.value }))} placeholder="Name or email" />
              </section>
              <section className="border-t border-border pt-4">
                <div className="flex justify-between text-xs mb-2"><span className="font-semibold">Confidence</span><span>{selected.confidence}%</span></div>
                <div className="h-1.5 rounded-full bg-slate-200"><div className="h-full rounded-full bg-emerald-600" style={{ width: `${selected.confidence}%` }} /></div>
              </section>
              <Button className="w-full" onClick={() => saveEvidenceMut.mutate()} disabled={saveEvidenceMut.isPending}>
                <ShieldCheck className="h-4 w-4 mr-1.5" /> {saveEvidenceMut.isPending ? "Saving…" : "Use evidence"}
              </Button>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-center text-sm text-muted-foreground">Select a requirement to inspect evidence.</div>
          )}
        </aside>
      </div>
    </div>
  );
}

export default function RfpDetailPage() {
  const params = useParams();
  const id = parseInt((params as { id: string }).id, 10);
  const [, setLocation] = useLocation();
  const { account } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<WorkspaceTab>("compliance");
  const [sections, setSections] = useState<Partial<Proposal>>({});
  const [newComment, setNewComment] = useState("");
  const [generating, setGenerating] = useState(false);

  const { data: rfpData, isLoading: rfpLoading } = useQuery<{ rfp: Rfp }>({ queryKey: ["/api/rfps", id] });
  const { data: proposalData, isLoading: proposalLoading } = useQuery<{ proposal: Proposal | null }>({ queryKey: ["/api/proposals", id] });
  const { data: profileData } = useQuery<{ profile: Profile | null }>({ queryKey: ["/api/profile"] });
  const { data: commentsData } = useQuery<{ comments: RfpComment[] }>({ queryKey: ["/api/rfps", id, "comments"] });
  const { data: requirementData } = useQuery<{ requirements: RfpRequirement[] }>({ queryKey: ["/api/rfps", id, "requirements"] });

  useEffect(() => {
    const proposal = proposalData?.proposal;
    if (!proposal) return;
    setSections(Object.fromEntries(SECTIONS.map((section) => [section.key, proposal[section.key] ?? ""])) as Partial<Proposal>);
  }, [proposalData]);

  useEffect(() => {
    if (Number.isNaN(id)) return;
    apiRequest("POST", `/api/rfps/${id}/comments/mark-read`)
      .then(() => queryClient.invalidateQueries({ queryKey: ["/api/rfps"] }))
      .catch(() => undefined);
  }, [id]);

  const saveMut = useMutation({
    mutationFn: () => apiRequest("PUT", `/api/proposals/${id}`, sections),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/proposals", id] });
      toast({ title: "Proposal saved" });
    },
    onError: (error: Error) => toast({ title: "Could not save proposal", description: error.message, variant: "destructive" }),
  });

  const commentMut = useMutation({
    mutationFn: (body: string) => apiRequest("POST", `/api/rfps/${id}/comments`, { body }),
    onSuccess: () => {
      setNewComment("");
      queryClient.invalidateQueries({ queryKey: ["/api/rfps", id, "comments"] });
    },
  });

  async function handleGenerate() {
    setGenerating(true);
    try {
      const response = await apiRequest("POST", `/api/proposals/${id}/generate`);
      const { proposal } = await response.json() as { proposal: Proposal };
      setSections(Object.fromEntries(SECTIONS.map((section) => [section.key, proposal[section.key] ?? ""])) as Partial<Proposal>);
      setTab("draft");
      toast({ title: "Profile-based draft built", description: "Verify every claim and connect evidence before export." });
    } catch (error) {
      toast({ title: "Could not build draft", description: (error as Error).message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  }

  async function handleDownload() {
    if (!rfpData?.rfp || !account) return;
    const { generateProposalPdf } = await import("@/lib/pdf");
    await generateProposalPdf(account, rfpData.rfp, sections as Proposal, profileData?.profile);
    await apiRequest("POST", `/api/proposals/${id}/mark-downloaded`);
    toast({ title: "Proposal PDF exported" });
  }

  if (rfpLoading) return <AppShell title="Proposal Command Center"><Skeleton className="h-[720px] w-full" /></AppShell>;
  if (!rfpData?.rfp) return <AppShell title="Proposal Command Center"><div className="py-20 text-center"><p className="font-semibold mb-4">RFP not found</p><Link href="/app/rfps"><Button variant="outline">Back to pipeline</Button></Link></div></AppShell>;

  const rfp = rfpData.rfp;
  const requirements = requirementData?.requirements ?? [];
  const covered = requirements.filter((item) => item.status === "covered").length;
  const draftComplete = SECTIONS.filter((section) => String(sections[section.key] ?? "").trim().length > 80).length;
  const tabs: { key: WorkspaceTab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "compliance", label: `Compliance${requirements.length ? ` · ${covered}/${requirements.length}` : ""}` },
    { key: "draft", label: `Draft · ${draftComplete}/8` },
    { key: "review", label: `Review · ${commentsData?.comments.length ?? 0}` },
    { key: "intelligence", label: "Intelligence" },
  ];

  return (
    <AppShell title="Proposal Command Center">
      <div className="max-w-[1500px] mx-auto -m-4 md:-m-8 bg-white min-h-[calc(100vh-4rem)]">
        <header className="px-4 md:px-6 py-4 border-b border-border">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <button onClick={() => setLocation("/app/rfps")} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-2"><ArrowLeft className="h-3.5 w-3.5" /> Pipeline</button>
              <h2 className="text-xl md:text-2xl font-semibold tracking-tight" data-testid="text-rfp-title">{rfp.trackingId ? `${rfp.trackingId} · ` : ""}{rfp.title}</h2>
              <p className="text-sm text-muted-foreground mt-1">{rfp.agency || "Agency not set"} <span className="mx-1.5">·</span> Due {rfp.dueDateText || "not set"}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {rfp.url ? <Button asChild variant="outline"><a href={rfp.url} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4 mr-1.5" />Open source</a></Button> : null}
              <Button variant="outline" onClick={handleGenerate} disabled={generating}><Sparkles className="h-4 w-4 mr-1.5" />{generating ? "Building…" : "Build draft"}</Button>
              <Button onClick={handleDownload}><Download className="h-4 w-4 mr-1.5" />Export</Button>
            </div>
          </div>
        </header>

        <nav className="px-4 md:px-6 border-b border-border flex gap-6 overflow-x-auto" aria-label="Proposal workspace">
          {tabs.map((item) => <button key={item.key} onClick={() => setTab(item.key)} className={`py-3 text-sm whitespace-nowrap border-b-2 transition-colors ${tab === item.key ? "border-primary text-primary font-semibold" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{item.label}</button>)}
        </nav>

        <main className="p-4 md:p-6">
          {tab === "compliance" ? <ComplianceWorkspace rfpId={id} recommendation={rfpData.rfp.recommendation} /> : null}

          {tab === "intelligence" ? <IntelligenceWorkspace rfpId={id} onApplyDraft={(draft) => {
            setSections((current) => ({ ...current, executiveSummary: draft }));
            setTab("draft");
            toast({ title: "Draft added for review", description: "Executive summary updated locally. Save only after your review." });
          }} /> : null}

          {tab === "overview" ? (
            <div className="grid lg:grid-cols-[1fr_340px] gap-6">
              <section className="border border-border bg-white p-5">
                <h3 className="text-lg font-semibold">Pursuit brief</h3>
                <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-5 mt-5 text-sm">
                  {[['Agency', rfp.agency], ['Estimated value', rfp.valueText], ['Recommendation', rfp.recommendation], ['Status', rfp.status]].map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground uppercase tracking-wider">{label}</dt><dd className="mt-1 font-medium capitalize">{value || "Not set"}</dd></div>)}
                </dl>
                <div className="mt-6 pt-5 border-t border-border"><div className="text-xs text-muted-foreground uppercase tracking-wider">Capture notes</div><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{rfp.notes || "Add decision context, customer hot buttons, incumbent intelligence, and teaming notes."}</p></div>
              </section>
              <aside className="border border-border p-5 bg-slate-50/60">
                <h3 className="font-semibold">Readiness path</h3>
                <ol className="mt-4 space-y-4 text-sm">
                  {[{done: requirements.length > 0, label: "Build compliance matrix"}, {done: covered === requirements.length && requirements.length > 0, label: "Cover every requirement"}, {done: draftComplete === 8, label: "Complete all draft sections"}, {done: false, label: "Run final review and export"}].map((step) => <li key={step.label} className="flex gap-3"><span className={`h-6 w-6 rounded-full border flex items-center justify-center shrink-0 ${step.done ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-muted-foreground"}`}>{step.done ? <Check className="h-3.5 w-3.5" /> : <CircleDashed className="h-3.5 w-3.5" />}</span><span className="pt-0.5">{step.label}</span></li>)}
                </ol>
              </aside>
            </div>
          ) : null}

          {tab === "draft" ? (
            <div className="grid xl:grid-cols-[220px_1fr] gap-6">
              <aside className="border border-border bg-slate-50/60 p-4 h-fit xl:sticky xl:top-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Draft progress</div>
                <div className="text-3xl font-semibold mt-2">{draftComplete}/8</div>
                <div className="mt-4 space-y-1">{SECTIONS.map((section) => <a key={String(section.key)} href={`#${String(section.key)}`} className="flex items-center justify-between px-2 py-2 text-sm hover:bg-white"><span>{section.title}</span>{String(sections[section.key] ?? "").trim().length > 80 ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}</a>)}</div>
                <Button variant="outline" className="w-full mt-4" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}><Save className="h-4 w-4 mr-1.5" />{saveMut.isPending ? "Saving…" : "Save draft"}</Button>
              </aside>
              <section className="space-y-4">
                {proposalLoading ? <Skeleton className="h-[500px] w-full" /> : SECTIONS.map((section) => <div id={String(section.key)} key={String(section.key)} className="border border-border bg-white p-5 scroll-mt-4"><h3 className="text-base font-semibold">{section.title}</h3><p className="text-xs text-muted-foreground mt-1 mb-3">{section.help}</p><Textarea rows={9} value={String(sections[section.key] ?? "")} onChange={(event) => setSections((current) => ({ ...current, [section.key]: event.target.value }))} placeholder="Draft using verified company evidence and exact solicitation requirements." /></div>)}
              </section>
            </div>
          ) : null}

          {tab === "review" ? (
            <div className="max-w-4xl mx-auto border border-border bg-white p-5">
              <div className="flex items-center gap-2"><MessageSquare className="h-4 w-4 text-primary" /><h3 className="font-semibold">Review thread</h3></div>
              <p className="text-xs text-muted-foreground mt-1">Internal decisions and reviewer notes. Never exported.</p>
              <div className="flex gap-2 mt-5"><Textarea rows={3} value={newComment} onChange={(event) => setNewComment(event.target.value)} placeholder={`Post as ${account?.email ?? "you"}`} /><Button onClick={() => commentMut.mutate(newComment.trim())} disabled={!newComment.trim() || commentMut.isPending}><Send className="h-4 w-4 mr-1.5" />Post</Button></div>
              <ol className="mt-6 space-y-3">{(commentsData?.comments ?? []).map((comment) => <li key={comment.id} className="border-t border-border pt-3"><div className="text-xs font-semibold">{comment.authorEmail}</div><p className="text-sm whitespace-pre-wrap mt-1">{comment.body}</p></li>)}</ol>
            </div>
          ) : null}
        </main>
      </div>
    </AppShell>
  );
}

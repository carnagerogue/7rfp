import { useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import AppShell from "./app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import type { CompanySource } from "@shared/schema";
import {
  ArrowRight,
  BookOpenCheck,
  Boxes,
  Check,
  ChevronRight,
  CircleCheck,
  FileSearch,
  FileText,
  Globe2,
  Loader2,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Terminal,
  Trash2,
  Upload,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const sourceTypes = [
  ["website", "Website or product page"],
  ["capability_statement", "Capability statement"],
  ["case_study", "Case study"],
  ["past_performance", "Past performance"],
  ["certification", "Certification"],
  ["product", "Product material"],
  ["note", "Verified internal note"],
] as const;

const documentTypes = sourceTypes.filter(([value]) => value !== "website") as readonly (readonly [string, string])[];
const initial = { title: "", sourceType: "note", sourceUrl: "", content: "" };
type IntakeMode = "upload" | "research" | "paste" | "skill";
type PendingDocument = { name: string; dataUrl: string; size: number };
type Research = {
  summary: string;
  findings: Array<{ title: string; detail: string; sourceUrls: string[] }>;
  sources: Array<{ title: string; url: string; excerpt: string }>;
};
const intakeTabs: Array<{ value: IntakeMode; label: string; icon: LucideIcon }> = [
  { value: "upload", label: "Upload document", icon: Upload },
  { value: "research", label: "Research public context", icon: Search },
  { value: "paste", label: "Paste exact material", icon: FileText },
  { value: "skill", label: "Import from AI skill", icon: Boxes },
];

function sourceIcon(type: string) {
  if (type === "website" || type === "product") return Globe2;
  if (type === "skill") return Boxes;
  return FileText;
}

function readableBytes(size: number) {
  return size < 1024 * 1024 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The document could not be read."));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

export default function CompanyEvidencePage() {
  const { toast } = useToast();
  const { account } = useAuth();
  const fileInput = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<IntakeMode>("upload");
  const [form, setForm] = useState(initial);
  const [document, setDocument] = useState<PendingDocument | null>(null);
  const [documentType, setDocumentType] = useState("capability_statement");
  const [documentTitle, setDocumentTitle] = useState("");
  const [dragging, setDragging] = useState(false);
  const [researchUrl, setResearchUrl] = useState("");
  const [researchFocus, setResearchFocus] = useState("");
  const [research, setResearch] = useState<Research | null>(null);
  const [selectedFindings, setSelectedFindings] = useState<number[]>([]);
  const [skillUrl, setSkillUrl] = useState("");
  const [skillName, setSkillName] = useState("");
  const { data, isLoading } = useQuery<{ sources: CompanySource[] }>({ queryKey: ["/api/company-sources"] });
  const sources = data?.sources ?? [];
  const hasResearch = Boolean(research);

  const addMut = useMutation({
    mutationFn: async (body: typeof initial) => (await apiRequest("POST", "/api/company-sources", body)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company-sources"] });
      setForm(initial);
      toast({ title: "Evidence added", description: "This approved material is now available to Achieve RFP." });
    },
    onError: (error: Error) => toast({ title: "Could not add evidence", description: error.message, variant: "destructive" }),
  });
  const uploadMut = useMutation({
    mutationFn: async () => {
      if (!document) throw new Error("Choose a document first.");
      return (await apiRequest("POST", "/api/company-sources/upload", {
        fileName: document.name,
        dataUrl: document.dataUrl,
        sourceType: documentType,
        title: documentTitle.trim() || undefined,
      })).json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/company-sources"] });
      setDocument(null);
      setDocumentTitle("");
      toast({ title: "Document added", description: `${data.extractedCharacters.toLocaleString()} characters are ready for approved AI use.` });
    },
    onError: (error: Error) => toast({ title: "Document could not be added", description: error.message, variant: "destructive" }),
  });
  const researchMut = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/company-research", {
      companyName: account?.companyName ?? "Your company",
      companyUrl: researchUrl.trim(),
      focus: researchFocus.trim(),
    })).json() as Promise<{ research: Research }>,
    onSuccess: ({ research }) => {
      setResearch(research);
      setSelectedFindings(research.findings.map((_, index) => index));
    },
    onError: (error: Error) => toast({ title: "Research could not run", description: error.message, variant: "destructive" }),
  });
  const ingestSkillMut = useMutation({
    mutationFn: async () =>
      (await apiRequest("POST", "/api/company-sources/ingest-skill", {
        url: skillUrl.trim(),
        skill: skillName.trim() || undefined,
      })).json() as Promise<{ skillName: string; added: number }>,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/company-sources"] });
      setSkillUrl("");
      setSkillName("");
      toast({
        title: "Skill imported",
        description: `Added ${result.added} evidence source${result.added === 1 ? "" : "s"} from ${result.skillName}.`,
      });
    },
    onError: (error: Error) => toast({ title: "Could not import skill", description: error.message, variant: "destructive" }),
  });
  const deleteMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/company-sources/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/company-sources"] }); toast({ title: "Evidence removed" }); },
    onError: (error: Error) => toast({ title: "Could not remove evidence", description: error.message, variant: "destructive" }),
  });

  const chooseFile = async (file?: File) => {
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      toast({ title: "Document is too large", description: "Choose a document up to 3 MB.", variant: "destructive" });
      return;
    }
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!extension || !["docx", "txt", "md", "csv", "json", "rtf"].includes(extension)) {
      toast({ title: "Unsupported document", description: "Use a DOCX, TXT, MD, CSV, JSON, or RTF file.", variant: "destructive" });
      return;
    }
    try {
      setDocument({ name: file.name, dataUrl: await fileToDataUrl(file), size: file.size });
      setDocumentTitle(file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "));
    } catch (error) {
      toast({ title: "Document could not be read", description: error instanceof Error ? error.message : "Try again.", variant: "destructive" });
    }
  };

  const addResearch = () => {
    if (!research || !selectedFindings.length) return;
    const approved = research.findings.filter((_, index) => selectedFindings.includes(index));
    const content = [
      `Reviewed public context for ${account?.companyName ?? "company"}.`,
      research.summary,
      ...approved.map((finding) => `${finding.title}\n${finding.detail}\nSources: ${finding.sourceUrls.join(", ")}`),
    ].join("\n\n");
    addMut.mutate({
      title: `${account?.companyName ?? "Company"} — reviewed public context`,
      sourceType: "website",
      sourceUrl: researchUrl.trim() || approved[0]?.sourceUrls[0] || "",
      content,
    });
  };
  const toggleFinding = (index: number) => setSelectedFindings((current) => current.includes(index) ? current.filter((item) => item !== index) : [...current, index]);

  return <AppShell title="Company Evidence">
    <div className="mx-auto max-w-7xl space-y-8 pb-10" data-testid="company-evidence-page">
      <section className="grid gap-8 border-b border-slate-200 pb-8 lg:grid-cols-[1fr_310px] lg:items-end">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">Company intelligence</p>
          <h1 className="mt-3 max-w-3xl font-serif text-4xl tracking-[-0.04em] text-slate-950 sm:text-5xl">Evidence that gives every response a point of view.</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">Bring in the documents your team trusts, then review public context before it joins your library. Achieve RFP only uses material you approve.</p>
        </div>
        <div className="border-l-2 border-primary pl-4">
          <p className="text-sm font-medium text-slate-950">Private by default</p>
          <p className="mt-1 text-sm leading-6 text-slate-500">Original uploads are read to extract text, then discarded. Research stays in review until you add it.</p>
        </div>
      </section>

      <nav aria-label="Evidence setup" className="grid gap-2 sm:grid-cols-3">
        {[
          ["01", "Bring in proof", "Documents and approved facts", true],
          ["02", "Review public context", "AI finds sources; you decide", hasResearch],
          ["03", "Use with confidence", `${sources.length} approved source${sources.length === 1 ? "" : "s"}`, sources.length > 0],
        ].map(([number, label, detail, complete], index) => <div key={String(number)} className={`flex gap-3 border px-4 py-4 ${complete ? "border-slate-300 bg-white" : "border-slate-200 bg-slate-50/70"}`}>
          <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${complete ? "bg-primary text-white" : "border border-slate-300 text-slate-500"}`}>{complete ? <Check className="h-3.5 w-3.5" /> : number}</span>
          <div><p className="text-sm font-semibold text-slate-900">{label}</p><p className="mt-0.5 text-xs text-slate-500">{detail}</p></div>
          {index < 2 && <ChevronRight className="ml-auto hidden h-4 w-4 self-center text-slate-300 sm:block" />}
        </div>)}
      </nav>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="overflow-hidden border-slate-200 bg-white shadow-[0_18px_50px_-35px_rgba(15,23,42,0.3)]">
          <div className="border-b border-slate-100 px-5 pb-0 pt-5 sm:px-7 sm:pt-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Build your source of truth</p><h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Add company material</h2></div>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700"><ShieldCheck className="h-4 w-4" /> Approval required</span>
            </div>
            <div className="mt-6 flex gap-5 overflow-x-auto" role="tablist" aria-label="Evidence intake method">
              {intakeTabs.map(({ value, label, icon: Icon }) => <button key={value} type="button" role="tab" aria-selected={mode === value} onClick={() => setMode(value)} className={`flex shrink-0 items-center gap-2 border-b-2 pb-3 text-sm font-medium transition-colors ${mode === value ? "border-primary text-slate-950" : "border-transparent text-slate-500 hover:text-slate-800"}`}><Icon className="h-4 w-4" />{label}</button>)}
            </div>
          </div>

          <div className="p-5 sm:p-7">
            {mode === "upload" && <div className="space-y-5">
              <div>
                <h3 className="text-lg font-semibold tracking-tight text-slate-950">Start with the documents behind your claims.</h3>
                <p className="mt-1 text-sm leading-6 text-slate-500">Capability statements, case studies, certifications, product sheets, and past performance are all good first sources.</p>
              </div>
              <input ref={fileInput} className="hidden" type="file" accept=".docx,.txt,.md,.csv,.json,.rtf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" onChange={(event) => chooseFile(event.target.files?.[0])} />
              {!document ? <button type="button" onClick={() => fileInput.current?.click()} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); chooseFile(event.dataTransfer.files?.[0]); }} className={`group flex min-h-52 w-full flex-col items-center justify-center border border-dashed p-8 text-center transition-colors ${dragging ? "border-primary bg-primary/[0.035]" : "border-slate-300 bg-slate-50/60 hover:border-primary/60 hover:bg-primary/[0.02]"}`}>
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-primary shadow-sm ring-1 ring-slate-200"><Upload className="h-5 w-5" /></span>
                <span className="mt-4 text-sm font-semibold text-slate-900">Drop a document here, or choose a file</span>
                <span className="mt-1 text-xs text-slate-500">DOCX, TXT, MD, CSV, JSON, or RTF · up to 3 MB</span>
              </button> : <div className="border border-slate-200 bg-slate-50/70 p-5">
                <div className="flex gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center bg-white text-primary ring-1 ring-slate-200"><FileText className="h-5 w-5" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-950">{document.name}</p><p className="mt-0.5 text-xs text-slate-500">{readableBytes(document.size)} · ready to extract</p></div><Button variant="ghost" size="sm" onClick={() => setDocument(null)}>Replace</Button></div>
                <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_220px]"><div className="space-y-1.5"><Label htmlFor="document-title">Evidence title</Label><Input id="document-title" value={documentTitle} onChange={(event) => setDocumentTitle(event.target.value)} /></div><div className="space-y-1.5"><Label>Document type</Label><Select value={documentType} onValueChange={setDocumentType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{documentTypes.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div></div>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4"><p className="text-xs leading-5 text-slate-500">We extract readable text for your evidence library. The original file is not kept.</p><Button onClick={() => uploadMut.mutate()} disabled={uploadMut.isPending || !documentTitle.trim()}>{uploadMut.isPending ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Extracting…</> : <>Extract and add evidence <ArrowRight className="ml-1.5 h-4 w-4" /></>}</Button></div>
              </div>}
            </div>}

            {mode === "research" && <div className="space-y-5">
              {!research ? <><div><h3 className="text-lg font-semibold tracking-tight text-slate-950">Give the team a researched starting point.</h3><p className="mt-1 text-sm leading-6 text-slate-500">Claude searches public sources for {account?.companyName ?? "your company"}. You review each finding before anything enters your library.</p></div><div className="grid gap-4 sm:grid-cols-[1fr_1fr]"><div className="space-y-1.5"><Label htmlFor="research-url">Company website <span className="font-normal text-slate-400">optional</span></Label><Input id="research-url" type="url" value={researchUrl} onChange={(event) => setResearchUrl(event.target.value)} placeholder="https://company.com" /></div><div className="space-y-1.5"><Label htmlFor="research-focus">What should it look for? <span className="font-normal text-slate-400">optional</span></Label><Input id="research-focus" value={researchFocus} onChange={(event) => setResearchFocus(event.target.value)} placeholder="Products, outcomes, certifications…" /></div></div><div className="border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600"><Sparkles className="mr-2 inline h-4 w-4 text-primary" /> Research discovers public sources; it does not create approved claims. The next screen lets you include or leave out every finding.</div><Button onClick={() => researchMut.mutate()} disabled={researchMut.isPending}>{researchMut.isPending ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Researching public sources…</> : <><Search className="mr-1.5 h-4 w-4" />Research {account?.companyName ?? "company"}</>}</Button></> : <><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Review before approval</p><h3 className="mt-1 text-lg font-semibold tracking-tight text-slate-950">Choose what becomes evidence.</h3></div><Button variant="ghost" size="sm" onClick={() => setResearch(null)}>Start over</Button></div><p className="max-w-2xl text-sm leading-6 text-slate-600">{research.summary}</p><div className="space-y-2">{research.findings.map((finding, index) => { const selected = selectedFindings.includes(index); return <button key={`${finding.title}-${index}`} type="button" onClick={() => toggleFinding(index)} className={`w-full border p-4 text-left transition-colors ${selected ? "border-primary bg-primary/[0.025]" : "border-slate-200 hover:border-slate-300"}`}><div className="flex gap-3"><span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${selected ? "border-primary bg-primary text-white" : "border-slate-300 bg-white"}`}>{selected && <Check className="h-3.5 w-3.5" />}</span><div className="min-w-0"><p className="text-sm font-semibold text-slate-950">{finding.title}</p><p className="mt-1 text-sm leading-6 text-slate-600">{finding.detail}</p><div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">{finding.sourceUrls.map((url) => <span className="max-w-full truncate text-xs text-primary" key={url}>{url}</span>)}</div></div></div></button>; })}</div><div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5"><p className="text-xs leading-5 text-slate-500">{selectedFindings.length} finding{selectedFindings.length === 1 ? "" : "s"} selected. These become one reviewed source with its citations.</p><Button onClick={addResearch} disabled={addMut.isPending || !selectedFindings.length}>{addMut.isPending ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Adding…</> : <><ShieldCheck className="mr-1.5 h-4 w-4" />Add approved research</>}</Button></div></>}
            </div>}

            {mode === "paste" && <div className="space-y-4"><div><h3 className="text-lg font-semibold tracking-tight text-slate-950">Add one precise source.</h3><p className="mt-1 text-sm leading-6 text-slate-500">Use exact, current material your team can defend in a proposal.</p></div><div className="grid gap-4 sm:grid-cols-[1fr_220px]"><div className="space-y-1.5"><Label htmlFor="source-title">Evidence title</Label><Input id="source-title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="2025 capability statement" /></div><div className="space-y-1.5"><Label>Material type</Label><Select value={form.sourceType} onValueChange={(sourceType) => setForm({ ...form, sourceType })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{sourceTypes.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div></div><div className="space-y-1.5"><Label htmlFor="source-url">Source URL <span className="font-normal text-slate-400">optional</span></Label><Input id="source-url" value={form.sourceUrl} onChange={(event) => setForm({ ...form, sourceUrl: event.target.value })} placeholder="https://example.com/product" /></div><div className="space-y-1.5"><Label htmlFor="source-content">Approved text</Label><Textarea id="source-content" rows={11} value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} placeholder="Paste the exact capabilities, proof points, certifications, or outcomes that AI may cite." /><p className="text-xs text-slate-500">Minimum 20 characters. Be factual and specific.</p></div><div className="flex justify-end border-t border-slate-200 pt-5"><Button onClick={() => addMut.mutate(form)} disabled={addMut.isPending || form.title.trim().length < 2 || form.content.trim().length < 20}>{addMut.isPending ? "Adding…" : "Add approved evidence"}</Button></div></div>}
            {mode === "skill" && <div className="space-y-5">
              <div>
                <h3 className="text-lg font-semibold tracking-tight text-slate-950">Import an AI skill your team already maintains.</h3>
                <p className="mt-1 text-sm leading-6 text-slate-500">Point to a public skill repository — the same repos <code className="rounded bg-slate-100 px-1 py-0.5 text-[13px]">npx skills</code> installs. Achieve RFP reads its SKILL.md and reference docs and adds them as reviewable evidence Claude can cite.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-[1fr_240px]">
                <div className="space-y-1.5">
                  <Label htmlFor="skill-url">Paste your <code className="rounded bg-slate-100 px-1 py-0.5 text-[13px]">npx skills</code> command or a GitHub URL</Label>
                  <Input id="skill-url" value={skillUrl} onChange={(event) => setSkillUrl(event.target.value)} placeholder="npx skills add https://github.com/org/agent-skills --skill company-evidence" data-testid="input-skill-url" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="skill-name">Skill name <span className="font-normal text-slate-400">override</span></Label>
                  <Input id="skill-name" value={skillName} onChange={(event) => setSkillName(event.target.value)} placeholder="auto-detected" data-testid="input-skill-name" />
                </div>
              </div>
              <div className="border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                <Terminal className="mr-2 inline h-4 w-4 text-primary" /> Paste the whole <code className="rounded bg-slate-100 px-1 py-0.5 text-[13px] text-slate-800">npx skills add …</code> command straight from a skill's README, or just its repository URL — we pull out the repo and skill name automatically.
              </div>
              <Button onClick={() => ingestSkillMut.mutate()} disabled={ingestSkillMut.isPending || skillUrl.trim().length < 8} data-testid="button-ingest-skill">{ingestSkillMut.isPending ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Reading skill from GitHub…</> : <><Boxes className="mr-1.5 h-4 w-4" />Import skill as evidence</>}</Button>
            </div>}
          </div>
        </Card>

        <aside className="space-y-4">
          <Card className="border-slate-200 bg-slate-950 p-5 text-white shadow-[0_20px_45px_-30px_rgba(15,23,42,0.7)]"><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Your library</p><p className="mt-4 text-4xl font-semibold tracking-tight">{sources.length}</p><p className="mt-1 text-sm text-slate-300">approved source{sources.length === 1 ? "" : "s"}</p><div className="mt-5 h-px bg-white/15" /><p className="mt-4 text-sm leading-6 text-slate-300">Achieve RFP cites approved company material alongside the RFP evidence for every grounded analysis.</p></Card>
          <Card className="border-slate-200 p-5"><div className="flex gap-3"><CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /><div><p className="text-sm font-semibold text-slate-950">A useful first library</p><ul className="mt-3 space-y-2 text-sm leading-5 text-slate-600"><li>Capability statement</li><li>One specific case study</li><li>Current certifications or product material</li></ul></div></div></Card>
          <Card className="border-slate-200 p-5"><div className="flex gap-3"><FileSearch className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><div><p className="text-sm font-semibold text-slate-950">What happens next</p><p className="mt-1 text-sm leading-6 text-slate-600">When you launch an RFP, these sources appear as controlled evidence that Claude can cite—not background assumptions.</p></div></div></Card>
        </aside>
      </section>

      <Card className="overflow-hidden border-slate-200">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-100 px-5 py-5 sm:px-7"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Approved library</p><h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Material AI may use</h2></div><span className="inline-flex items-center gap-1.5 text-xs text-slate-500"><ShieldCheck className="h-4 w-4 text-emerald-600" /> Tenant-scoped and reviewable</span></div>
        {isLoading ? <div className="space-y-3 p-6">{[1, 2, 3].map((item) => <Skeleton className="h-16 w-full" key={item} />)}</div> : !sources.length ? <div className="p-10 text-center"><BookOpenCheck className="mx-auto h-8 w-8 text-primary" /><h3 className="mt-3 text-sm font-semibold text-slate-950">Your library is waiting for its first source.</h3><p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500">Upload a capability statement or research the company’s public context to begin with material your team approves.</p></div> : <div className="divide-y divide-slate-100">{sources.map((source) => { const Icon = sourceIcon(source.sourceType); return <div key={source.id} className="flex gap-4 px-5 py-5 sm:px-7" data-testid={`company-source-${source.id}`}><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-primary"><Icon className="h-4 w-4" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-2 gap-y-1"><h3 className="text-sm font-semibold text-slate-950">{source.title}</h3><span className="text-xs text-slate-400">{source.sourceType.replaceAll("_", " ")}</span><span className="inline-flex items-center gap-1 text-xs text-emerald-700"><Check className="h-3 w-3" />Approved</span></div>{source.sourceUrl ? <p className="mt-1 truncate text-xs text-primary">{source.sourceUrl}</p> : null}<p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{source.content}</p></div><Button variant="ghost" size="icon" className="shrink-0 text-slate-400 hover:text-red-700" onClick={() => deleteMut.mutate(source.id)} disabled={deleteMut.isPending} aria-label={`Remove ${source.title}`}><Trash2 className="h-4 w-4" /></Button></div>; })}</div>}
      </Card>
    </div>
  </AppShell>;
}

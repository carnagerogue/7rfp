import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import AppShell from "./app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { CompanySource } from "@shared/schema";
import { BookOpenCheck, FileText, Globe2, Plus, ShieldCheck, Trash2 } from "lucide-react";

const sourceTypes = [
  ["website", "Website or product page"],
  ["capability_statement", "Capability statement"],
  ["case_study", "Case study"],
  ["past_performance", "Past performance"],
  ["certification", "Certification"],
  ["product", "Product material"],
  ["note", "Verified internal note"],
] as const;

const initial = { title: "", sourceType: "website", sourceUrl: "", content: "" };

function sourceIcon(type: string) {
  return type === "website" || type === "product" ? Globe2 : FileText;
}

export default function CompanyEvidencePage() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initial);
  const { data, isLoading } = useQuery<{ sources: CompanySource[] }>({ queryKey: ["/api/company-sources"] });
  const sources = data?.sources ?? [];
  const addMut = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/company-sources", form)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company-sources"] });
      setForm(initial); setOpen(false);
      toast({ title: "Evidence saved", description: "Future AI analyses can cite this verified company source." });
    },
    onError: (error: Error) => toast({ title: "Could not save source", description: error.message, variant: "destructive" }),
  });
  const deleteMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/company-sources/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/company-sources"] }); toast({ title: "Evidence removed" }); },
    onError: (error: Error) => toast({ title: "Could not remove source", description: error.message, variant: "destructive" }),
  });
  return <AppShell title="Company Evidence">
    <div className="max-w-6xl mx-auto space-y-6" data-testid="company-evidence-page">
      <div className="grid lg:grid-cols-[1fr_270px] gap-5 items-start">
        <div>
          <h2 className="font-serif text-4xl tracking-tight text-slate-950">Build company evidence</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground max-w-2xl">Save exact source material about your company and product. Claude uses only this library, your company profile, and RFP evidence when it drafts or reviews a response.</p>
        </div>
        <Card className="p-4 border-emerald-200 bg-emerald-50/60">
          <div className="flex gap-2 items-center font-medium text-emerald-900"><ShieldCheck className="h-4 w-4" /> Grounded by design</div>
          <p className="mt-2 text-xs leading-relaxed text-emerald-900/75">Nothing is scraped or inferred. Paste material you approve, then every AI result can cite it.</p>
        </Card>
      </div>

      <Card className="border-border overflow-hidden">
        <div className="p-4 md:p-5 border-b flex flex-wrap gap-3 items-center justify-between">
          <div><h3 className="font-semibold">Evidence library <span className="text-muted-foreground">({sources.length})</span></h3><p className="text-xs text-muted-foreground mt-1">Verified source material shared across every RFP.</p></div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button data-testid="button-add-company-source"><Plus className="h-4 w-4 mr-1.5" />Add source</Button></DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>Add verified company source</DialogTitle><DialogDescription>Paste source text you want AI to use. Save only material your team can stand behind.</DialogDescription></DialogHeader>
              <div className="space-y-4 py-2">
                <div className="grid sm:grid-cols-[1fr_220px] gap-3"><div className="space-y-1.5"><Label htmlFor="source-title">Title</Label><Input id="source-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="2025 capability statement" /></div><div className="space-y-1.5"><Label>Source type</Label><Select value={form.sourceType} onValueChange={(sourceType) => setForm({ ...form, sourceType })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{sourceTypes.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div></div>
                <div className="space-y-1.5"><Label htmlFor="source-url">Source URL <span className="text-muted-foreground">(optional)</span></Label><Input id="source-url" value={form.sourceUrl} onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })} placeholder="https://example.com/product" /></div>
                <div className="space-y-1.5"><Label htmlFor="source-content">Approved source text</Label><Textarea id="source-content" rows={11} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="Paste relevant copy, case-study facts, product capabilities, certifications, or past-performance detail. Be specific: AI will cite this text exactly." /><p className="text-xs text-muted-foreground">Minimum 20 characters. Keep claims factual and current.</p></div>
              </div>
              <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={() => addMut.mutate()} disabled={addMut.isPending || form.title.trim().length < 2 || form.content.trim().length < 20}>{addMut.isPending ? "Saving…" : "Save verified source"}</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        {isLoading ? <div className="p-5 space-y-3">{[1, 2, 3].map((item) => <Skeleton className="h-16 w-full" key={item} />)}</div> : !sources.length ? <div className="p-12 text-center"><BookOpenCheck className="h-9 w-9 text-primary mx-auto mb-3" /><h3 className="font-semibold">No approved sources yet</h3><p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">Start with capability statement, product page, or strongest past-performance evidence. You control what AI sees.</p><Button className="mt-5" onClick={() => setOpen(true)}>Add first source</Button></div> : <div className="divide-y">{sources.map((source) => { const Icon = sourceIcon(source.sourceType); return <div key={source.id} className="p-4 md:px-5 flex gap-3 items-start" data-testid={`company-source-${source.id}`}><div className="h-9 w-9 shrink-0 bg-primary/8 text-primary flex items-center justify-center"><Icon className="h-4 w-4" /></div><div className="min-w-0 flex-1"><div className="flex gap-2 items-center flex-wrap"><h4 className="text-sm font-semibold">{source.title}</h4><span className="text-[11px] text-muted-foreground capitalize">{source.sourceType.replaceAll("_", " ")}</span><span className="inline-flex gap-1 items-center text-[11px] text-emerald-700"><ShieldCheck className="h-3 w-3" />Verified</span></div>{source.sourceUrl ? <p className="mt-1 text-xs text-primary truncate">{source.sourceUrl}</p> : null}<p className="mt-1.5 text-sm text-muted-foreground line-clamp-2 leading-relaxed">{source.content}</p></div><Button variant="ghost" size="icon" className="text-muted-foreground hover:text-red-700 shrink-0" onClick={() => deleteMut.mutate(source.id)} disabled={deleteMut.isPending} aria-label={`Remove ${source.title}`}><Trash2 className="h-4 w-4" /></Button></div>; })}</div>}
      </Card>
    </div>
  </AppShell>;
}

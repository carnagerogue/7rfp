import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import AppShell from "./app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import type { Profile } from "@shared/schema";
import { Upload, X, Search } from "lucide-react";

type ScanPreset = {
  key: string;
  label: string;
  description: string;
  keywords: string[];
  categories: string[];
};

const SOURCES: { slug: string; label: string }[] = [
  { slug: "sam", label: "SAM.gov" },
  { slug: "caleprocure", label: "Cal eProcure" },
  { slug: "bidnet", label: "BidNet Direct" },
  { slug: "highergov", label: "HigherGov" },
  { slug: "govtribe", label: "GovTribe" },
  { slug: "usaspending", label: "USAspending" },
  { slug: "grants", label: "Grants.gov" },
  { slug: "demandstar", label: "DemandStar" },
  { slug: "bonfire", label: "Bonfire" },
  { slug: "publicpurchase", label: "Public Purchase" },
  { slug: "bidsync", label: "BidSync" },
];

const LOGO_MAX_BYTES = 500 * 1024;

const FIELDS: { key: keyof Profile; label: string; placeholder: string; rows?: number }[] = [
  { key: "overview", label: "Company overview", placeholder: "Who you are, what you do, mission, size, locations.", rows: 4 },
  { key: "capabilities", label: "Core capabilities", placeholder: "Bullet your service lines and technical strengths." },
  { key: "pastPerformance", label: "Past performance", placeholder: "One contract per line: Customer | Title | Period | Value | Outcome", rows: 5 },
  { key: "keyPersonnel", label: "Key personnel", placeholder: "Names, roles, clearances, certifications." },
  { key: "pricingApproach", label: "Pricing approach", placeholder: "How you typically structure pricing — fixed-fee, T&M, blended rates, etc." },
  { key: "certifications", label: "Certifications & set-asides", placeholder: "ISO 9001, CMMI Level 3, 8(a), HUBZone, SDVOSB, etc." },
  { key: "differentiators", label: "Differentiators", placeholder: "What sets you apart from competitors." },
];

export default function ProfilePage() {
  const { account } = useAuth();
  const { toast } = useToast();
  const { data, isLoading } = useQuery<{ profile: Profile | null }>({
    queryKey: ["/api/profile"],
  });

  const [values, setValues] = useState<Partial<Profile>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: presetsData } = useQuery<{ presets: Record<string, ScanPreset> }>({
    queryKey: ["/api/scan-presets"],
  });
  const presets = presetsData?.presets;

  useEffect(() => {
    if (data?.profile) {
      setValues({
        overview: data.profile.overview ?? "",
        capabilities: data.profile.capabilities ?? "",
        pastPerformance: data.profile.pastPerformance ?? "",
        keyPersonnel: data.profile.keyPersonnel ?? "",
        pricingApproach: data.profile.pricingApproach ?? "",
        certifications: data.profile.certifications ?? "",
        differentiators: data.profile.differentiators ?? "",
        logoDataUrl: data.profile.logoDataUrl ?? "",
        scanPreset: data.profile.scanPreset ?? "custom",
        scanKeywords: data.profile.scanKeywords ?? "",
        scanSources: data.profile.scanSources ?? "sam,caleprocure,bidnet,highergov",
      });
    }
  }, [data]);

  const selectedPreset = (values.scanPreset as string) ?? "custom";
  const presetKeywords = presets?.[selectedPreset]?.keywords ?? [];
  const enabledSources = ((values.scanSources as string) ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  function toggleSource(slug: string, checked: boolean) {
    const next = checked
      ? Array.from(new Set([...enabledSources, slug]))
      : enabledSources.filter((s) => s !== slug);
    setValues({ ...values, scanSources: next.join(",") });
  }

  function onLogoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > LOGO_MAX_BYTES) {
      toast({
        title: "Logo too large",
        description: "Please choose a logo under 500 KB.",
        variant: "destructive",
      });
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setValues((v) => ({ ...v, logoDataUrl: String(reader.result) }));
    };
    reader.onerror = () =>
      toast({ title: "Failed to read file", variant: "destructive" });
    reader.readAsDataURL(file);
  }

  function removeLogo() {
    setValues((v) => ({ ...v, logoDataUrl: "" }));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", "/api/profile", values);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      toast({ title: "Company profile saved" });
    },
    onError: (err: any) =>
      toast({ title: "Failed to save", description: err.message, variant: "destructive" }),
  });

  return (
    <AppShell title="Company Profile">
      <div className="max-w-3xl mx-auto space-y-6">
        <p className="text-sm text-muted-foreground">
          Drafts are generated from this profile — keep it updated for better proposals.
        </p>

        {isLoading ? (
          <Card className="p-6 space-y-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </Card>
        ) : (
          <Card className="p-6 space-y-5">
            <div className="space-y-1.5">
              <Label>Company name</Label>
              <Input value={account?.companyName ?? ""} readOnly disabled data-testid="input-profile-company-name" />
            </div>

            <div className="space-y-2">
              <Label>Company logo</Label>
              <div className="flex items-start gap-4">
                <div className="flex h-[88px] w-[208px] shrink-0 items-center justify-center rounded-md border border-dashed border-border bg-muted/40 overflow-hidden">
                  {values.logoDataUrl ? (
                    <img
                      src={values.logoDataUrl}
                      alt="Company logo preview"
                      data-testid="img-logo-preview"
                      style={{ maxHeight: 80, maxWidth: 200, objectFit: "contain" }}
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">No logo</span>
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      data-testid="button-upload-logo"
                    >
                      <Upload className="h-3.5 w-3.5 mr-1.5" />
                      {values.logoDataUrl ? "Replace logo" : "Upload logo"}
                    </Button>
                    {values.logoDataUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={removeLogo}
                        data-testid="button-remove-logo"
                      >
                        <X className="h-3.5 w-3.5 mr-1.5" />
                        Remove
                      </Button>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml"
                      onChange={onLogoSelected}
                      className="hidden"
                      data-testid="input-logo-upload"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    PNG, JPG, or SVG. Recommended: transparent PNG, ~400×100px or square. Max 500 KB.
                  </p>
                </div>
              </div>
            </div>

            {FIELDS.map((f) => (
              <div key={f.key as string} className="space-y-1.5">
                <Label>{f.label}</Label>
                <Textarea
                  rows={f.rows ?? 3}
                  placeholder={f.placeholder}
                  value={(values[f.key] as string) ?? ""}
                  onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                  data-testid={`input-profile-${f.key}`}
                />
              </div>
            ))}
          </Card>
        )}

        {/* Discovery Settings */}
        <Card className="p-6 space-y-5">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Search className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Discovery Settings</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                We scan for matching opportunities every Monday and add them to your RFP Ready list.
                Choose a preset or define your own keywords.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Preset</Label>
            <Select
              value={selectedPreset}
              onValueChange={(v) => setValues({ ...values, scanPreset: v })}
            >
              <SelectTrigger data-testid="select-scan-preset">
                <SelectValue placeholder="Choose a preset" />
              </SelectTrigger>
              <SelectContent>
                {presets &&
                  Object.values(presets).map((p) => (
                    <SelectItem key={p.key} value={p.key}>
                      {p.label}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {presets?.[selectedPreset]?.description && (
              <p className="text-xs text-muted-foreground pt-1">
                {presets[selectedPreset].description}
              </p>
            )}
          </div>

          {selectedPreset !== "custom" && presetKeywords.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Included keywords
              </Label>
              <div className="flex flex-wrap gap-1.5" data-testid="chips-preset-keywords">
                {presetKeywords.map((k) => (
                  <span
                    key={k}
                    className="inline-flex items-center px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground text-xs"
                  >
                    {k}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Custom keywords</Label>
            <Textarea
              rows={4}
              placeholder="additional terms to search for, one per line"
              value={(values.scanKeywords as string) ?? ""}
              onChange={(e) => setValues({ ...values, scanKeywords: e.target.value })}
              data-testid="input-scan-keywords"
            />
            <p className="text-xs text-muted-foreground">
              One keyword or phrase per line. Combined with the preset keywords above.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Sources</Label>
            <div className="grid grid-cols-2 gap-2" data-testid="checkbox-sources">
              {SOURCES.map((s) => {
                const checked = enabledSources.includes(s.slug);
                return (
                  <label
                    key={s.slug}
                    className="flex items-center gap-2 text-sm cursor-pointer"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(c) => toggleSource(s.slug, Boolean(c))}
                      data-testid={`checkbox-source-${s.slug}`}
                    />
                    {s.label}
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={() => saveMut.mutate()}
              disabled={saveMut.isPending}
              data-testid="button-save-profile"
            >
              {saveMut.isPending ? "Saving..." : "Save profile"}
            </Button>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

import { storage } from "./storage";
import {
  getPreset,
  SCAN_PRESETS,
  sourcesToDomains,
  type ScanPresetKey,
} from "./scan-presets";
import type { Profile, Rfp } from "@shared/schema";
import { z } from "zod";

type DiscoveryHit = {
  url?: string;
  title?: string;
  domain?: string;
  snippet?: string;
  summary?: string;
  date?: string;
};

type DiscoverySearchResult = {
  hits: DiscoveryHit[];
};

const KEYWORD_CAP = 8;
const RESULTS_PER_KEYWORD = 3;

function dedupe<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function parseKeywords(profile: Profile): string[] {
  const presetKw = getPreset(profile.scanPreset).keywords;
  const customKw = (profile.scanKeywords ?? "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return dedupe([...presetKw, ...customKw]);
}

function parseSources(profile: Profile): string[] {
  const raw = profile.scanSources ?? "sam,caleprocure,bidnet,highergov";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

type AnthropicWebResult = { url?: string; title?: string; snippet?: string; content?: string };
type AnthropicContentBlock = { type?: string; content?: AnthropicWebResult[]; text?: string };

// A single opportunity the model extracted from its web searches, with the
// fields we actually surface (due date, value, agency) rather than hardcoding them.
const discoveredOpportunitySchema = z.object({
  title: z.string().trim().min(3).max(300),
  agency: z.string().trim().max(200).optional().default(""),
  url: z.string().trim().url().max(1000),
  dueDate: z.string().trim().max(120).optional().default(""),
  value: z.string().trim().max(120).optional().default(""),
  summary: z.string().trim().max(600).optional().default(""),
});
export type DiscoveredOpportunity = z.infer<typeof discoveredOpportunitySchema>;

function extractJsonObject(text: string): string | null {
  const withoutFences = text.replace(/```(?:json)?/gi, "").trim();
  const start = withoutFences.indexOf("{");
  const end = withoutFences.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  return withoutFences.slice(start, end + 1);
}

// Parse the model's JSON answer (`{ opportunities: [...] }`) into validated,
// de-duplicated opportunities. Returns [] if the model returned no usable JSON.
export function parseDiscoveredOpportunities(payload: {
  content?: Array<{ type?: string; text?: string }>;
}): DiscoveredOpportunity[] {
  const textBlock = (payload.content ?? []).find((b) => b?.type === "text" && typeof b.text === "string");
  const jsonText = extractJsonObject(textBlock?.text ?? "");
  if (!jsonText) return [];
  let raw: unknown;
  try {
    raw = JSON.parse(jsonText);
  } catch {
    return [];
  }
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { opportunities?: unknown[] })?.opportunities)
      ? (raw as { opportunities: unknown[] }).opportunities
      : [];
  const out: DiscoveredOpportunity[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    const parsed = discoveredOpportunitySchema.safeParse(item);
    if (!parsed.success) continue;
    const key = parsed.data.url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(parsed.data);
  }
  return out;
}

export function extractDiscoveryHits(payload: { content?: AnthropicContentBlock[] }): DiscoveryHit[] {
  const seen = new Set<string>();
  const hits: DiscoveryHit[] = [];
  for (const block of payload.content ?? []) {
    if (block.type !== "web_search_tool_result") continue;
    for (const result of Array.isArray(block.content) ? block.content : []) {
      const url = result.url?.trim();
      if (!url || seen.has(url.toLowerCase())) continue;
      seen.add(url.toLowerCase());
      hits.push({
        url,
        title: result.title?.trim() || url,
        snippet: (result.snippet ?? result.content ?? "").trim(),
      });
    }
  }
  return hits;
}

async function runClaudeDiscovery(
  keywords: string[],
  domains: string[],
): Promise<{ opportunities: DiscoveredOpportunity[] }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Discovery is not configured. Add ANTHROPIC_API_KEY to the server environment.");
  const query = [
    "Find currently open public-procurement opportunities (RFP, RFQ, RFI, IFB, or solicitation) that match these terms:",
    keywords.map((keyword) => `- ${keyword}`).join("\n"),
    "Search the allowed procurement sources on the web before answering. Prefer individual solicitation pages that show a specific response due date over portal index or search-result pages.",
    "For each real, currently open opportunity, extract these fields exactly as the source states them:",
    "- title: the solicitation title",
    "- agency: the issuing agency or organization",
    "- url: the exact source URL",
    '- dueDate: the response/proposal due date as written (for example "June 15, 2026"). Use "TBD — verify on source" only when the source shows no date.',
    '- value: the estimated value or ceiling if stated (for example "$2.4M"). Use "Not listed" when the source gives none.',
    "- summary: one sentence describing the scope.",
    "Never invent opportunities, dates, values, or agencies — report only what the sources actually show.",
    'Return JSON only, with no prose: {"opportunities":[{"title":"","agency":"","url":"","dueDate":"","value":"","summary":""}]}',
  ].join("\n\n");
  const tool: Record<string, unknown> = {
    type: "web_search_20260318",
    name: "web_search",
    max_uses: Math.max(1, Math.min(6, Number(process.env.DISCOVERY_MAX_WEB_SEARCHES || 5))),
  };
  if (domains.length) tool.allowed_domains = domains;
  const timeoutMs = Math.max(20_000, Math.min(150_000, Number(process.env.DISCOVERY_TIMEOUT_MS) || 100_000));
  let response: Response;
  try {
    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 3000,
        thinking: { type: "disabled" },
        tools: [tool],
        messages: [{ role: "user", content: query }],
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const name = (error as Error)?.name;
    console.error("[Achieve RFP] discovery request failed:", name, (error as Error)?.message);
    throw new Error(
      name === "TimeoutError" || name === "AbortError"
        ? "Discovery timed out. Try again."
        : "Discovery could not reach Anthropic.",
    );
  }
  if (!response.ok) throw new Error(`Claude discovery request failed (${response.status}).`);
  const payload = (await response.json()) as { content?: AnthropicContentBlock[] };
  const opportunities = parseDiscoveredOpportunities(payload);
  // Fallback: if the model didn't return structured JSON, keep the raw search
  // hits (title/URL only) so a scan still surfaces something to review.
  if (opportunities.length === 0) {
    return {
      opportunities: extractDiscoveryHits(payload)
        .filter((hit) => hit.url)
        .map((hit) => ({
          title: hit.title || "Newly discovered opportunity",
          agency: "",
          url: hit.url as string,
          dueDate: "",
          value: "",
          summary: hit.snippet ?? "",
        })),
    };
  }
  return { opportunities };
}

function buildDemoRfps(presetKey: ScanPresetKey): Array<Partial<Rfp>> {
  const preset = SCAN_PRESETS[presetKey] ?? SCAN_PRESETS.custom;
  const seedNote =
    "Demo result — real scan unavailable in this environment. Will activate in production.";

  const seedsByPreset: Record<ScanPresetKey, Array<Partial<Rfp>>> = {
    corrections_reentry: [
      {
        title:
          "Statewide Inmate Digital Learning & Tablet Program (Demo Discovery)",
        agency: "From scan — review and update",
        url: "https://sam.gov/opp/example-corrections-tablet",
        notes: seedNote,
      },
      {
        title: "Reentry Workforce Development Services (Demo Discovery)",
        agency: "From scan — review and update",
        url: "https://bidnetdirect.com/example-reentry-workforce",
        notes: seedNote,
      },
      {
        title: "County Jail Education & LMS Pilot (Demo Discovery)",
        agency: "From scan — review and update",
        url: "https://highergov.com/example-jail-education",
        notes: seedNote,
      },
    ],
    managed_it: [
      {
        title: "Managed IT Services Master Agreement (Demo Discovery)",
        agency: "From scan — review and update",
        url: "https://sam.gov/opp/example-managed-it",
        notes: seedNote,
      },
      {
        title: "Help Desk & Endpoint Support Services (Demo Discovery)",
        agency: "From scan — review and update",
        url: "https://caleprocure.ca.gov/example-helpdesk",
        notes: seedNote,
      },
      {
        title: "Network Infrastructure Refresh (Demo Discovery)",
        agency: "From scan — review and update",
        url: "https://bidnetdirect.com/example-network-refresh",
        notes: seedNote,
      },
    ],
    cybersecurity: [
      {
        title: "Managed Security Operations Center Services (Demo Discovery)",
        agency: "From scan — review and update",
        url: "https://sam.gov/opp/example-soc-services",
        notes: seedNote,
      },
      {
        title: "Vulnerability Assessment & Penetration Testing (Demo Discovery)",
        agency: "From scan — review and update",
        url: "https://highergov.com/example-vapt",
        notes: seedNote,
      },
      {
        title: "CMMC Readiness Assessment (Demo Discovery)",
        agency: "From scan — review and update",
        url: "https://bidnetdirect.com/example-cmmc",
        notes: seedNote,
      },
    ],
    cloud_migration: [
      {
        title: "Microsoft 365 & Azure Migration Services (Demo Discovery)",
        agency: "From scan — review and update",
        url: "https://sam.gov/opp/example-azure-migration",
        notes: seedNote,
      },
      {
        title: "Cloud Modernization & IaaS Services (Demo Discovery)",
        agency: "From scan — review and update",
        url: "https://highergov.com/example-cloud-modernization",
        notes: seedNote,
      },
    ],
    workforce_dev: [
      {
        title: "Career Readiness & Vocational Training Services (Demo Discovery)",
        agency: "From scan — review and update",
        url: "https://sam.gov/opp/example-career-readiness",
        notes: seedNote,
      },
      {
        title: "Employment Services Master Contract (Demo Discovery)",
        agency: "From scan — review and update",
        url: "https://bidnetdirect.com/example-employment-services",
        notes: seedNote,
      },
    ],
    custom: [
      {
        title: `${preset.label} — Sample Opportunity (Demo Discovery)`,
        agency: "From scan — review and update",
        url: "https://example.gov/sample-rfp-1",
        notes: seedNote,
      },
      {
        title: `${preset.label} — Additional Sample Opportunity (Demo Discovery)`,
        agency: "From scan — review and update",
        url: "https://example.gov/sample-rfp-2",
        notes: seedNote,
      },
    ],
  };

  return seedsByPreset[presetKey] ?? seedsByPreset.custom;
}

export type ScanRunResult = {
  added: number;
  lastScanAt: string;
  mode: "live" | "demo";
};

export type ScanRunError = {
  status: number;
  message: string;
};

export async function runScanForAccount(accountId: number): Promise<ScanRunResult> {
  const profile = storage.getProfile(accountId);
  if (!profile) {
    const err: ScanRunError = {
      status: 400,
      message: "Configure Discovery Settings on your profile first.",
    };
    throw err;
  }

  const keywords = parseKeywords(profile).slice(0, KEYWORD_CAP);
  if (keywords.length === 0) {
    const err: ScanRunError = {
      status: 400,
      message: "Configure Discovery Settings on your profile first.",
    };
    throw err;
  }

  const sources = parseSources(profile);
  const domainList = sourcesToDomains(sources).split(",").filter(Boolean);

  const existingRfps = storage.listRfps(accountId);
  const existingUrls = new Set(
    existingRfps.map((r) => (r.url ?? "").trim().toLowerCase()).filter((u) => u.length > 0)
  );

  let mode: "live" | "demo" = "live";
  const newRfps: Array<{
    title: string;
    agency: string;
    url: string;
    dueDateText: string;
    valueText: string;
    recommendation: string;
    status: string;
    notes: string;
  }> = [];

  try {
    const result = await runClaudeDiscovery(keywords, domainList);
    const opportunities = result.opportunities
      .filter((opp) => opp.url)
      .slice(0, KEYWORD_CAP * RESULTS_PER_KEYWORD);
    for (const opp of opportunities) {
      const url = opp.url.trim();
      if (!url) continue;
      const key = url.toLowerCase();
      if (existingUrls.has(key)) continue;
      existingUrls.add(key);
      newRfps.push({
        title: opp.title || "Newly discovered opportunity",
        agency: opp.agency?.trim() || "From scan — review and update",
        url,
        dueDateText: opp.dueDate?.trim() || "TBD — verify on source",
        valueText: opp.value?.trim() || "Not listed",
        recommendation: "WATCH — Newly discovered",
        status: "new",
        notes: (opp.summary ?? "").slice(0, 280),
      });
    }
  } catch (err) {
    const allowDemo = process.env.ALLOW_DEMO_SCAN === "true" && process.env.NODE_ENV !== "production";
    console.warn("[Achieve RFP] scan: live discovery unavailable.", (err as Error)?.message ?? err);
    if (!allowDemo) {
      const scanError: ScanRunError = {
        status: 503,
        message: "Live discovery is unavailable. Add ANTHROPIC_API_KEY in deployment settings, then try again.",
      };
      throw scanError;
    }
    mode = "demo";
    newRfps.length = 0;
    const seeds = buildDemoRfps((profile.scanPreset ?? "custom") as ScanPresetKey);
    for (const seed of seeds) {
      const url = (seed.url ?? "").trim();
      const key = url.toLowerCase();
      if (key && existingUrls.has(key)) continue;
      if (key) existingUrls.add(key);
      newRfps.push({
        title: seed.title ?? "Newly discovered opportunity",
        agency: seed.agency ?? "From scan — review and update",
        url,
        dueDateText: "TBD — verify on source",
        valueText: "Not listed",
        recommendation: "WATCH — Newly discovered",
        status: "new",
        notes:
          seed.notes ??
          "Demo result — real scan unavailable in this environment. Will activate in production.",
      });
    }
  }

  for (const item of newRfps) {
    storage.createRfp(accountId, item);
  }

  const nowIso = new Date().toISOString();
  storage.upsertProfile(accountId, {
    lastScanAt: nowIso,
    lastScanCount: newRfps.length,
  });

  return { added: newRfps.length, lastScanAt: nowIso, mode };
}

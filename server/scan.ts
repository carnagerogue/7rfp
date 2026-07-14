import { execFileSync } from "node:child_process";
import { storage } from "./storage";
import {
  getPreset,
  SCAN_PRESETS,
  sourcesToDomains,
  type ScanPresetKey,
} from "./scan-presets";
import type { Profile, Rfp } from "@shared/schema";

type PplxHit = {
  url?: string;
  title?: string;
  domain?: string;
  snippet?: string;
  summary?: string;
  date?: string;
};

type PplxSearchResult = {
  hits?: PplxHit[];
  total?: number;
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

// Best-effort recency filter — if the result has a parseable date, keep only
// items from the last 7 days; otherwise keep them (we can't tell).
function isRecentEnough(hit: PplxHit, daysBack = 7): boolean {
  if (!hit.date) return true;
  const t = Date.parse(hit.date);
  if (Number.isNaN(t)) return true;
  const cutoff = Date.now() - daysBack * 24 * 60 * 60 * 1000;
  return t >= cutoff;
}

function runPplxSearch(keyword: string, domains: string): PplxSearchResult {
  const args = ["search", "web", keyword];
  if (domains) {
    args.push("--domains", domains);
  }
  const stdout = execFileSync("pplx", args, {
    encoding: "utf8",
    timeout: 30_000,
    maxBuffer: 8 * 1024 * 1024,
    env: { ...process.env },
  });
  return JSON.parse(stdout) as PplxSearchResult;
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
  const domains = sourcesToDomains(sources);

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
    for (const keyword of keywords) {
      let result: PplxSearchResult;
      try {
        result = runPplxSearch(keyword, domains);
      } catch (innerErr) {
        // pplx not available or failed — surface to outer catch for demo fallback.
        throw innerErr;
      }
      const hits = (result.hits ?? [])
        .filter((h) => h.url)
        .filter((h) => isRecentEnough(h, 7))
        .slice(0, RESULTS_PER_KEYWORD);
      for (const hit of hits) {
        const url = (hit.url ?? "").trim();
        if (!url) continue;
        const key = url.toLowerCase();
        if (existingUrls.has(key)) continue;
        existingUrls.add(key);
        const snippet = (hit.snippet ?? hit.summary ?? "").slice(0, 280);
        newRfps.push({
          title: hit.title || keyword,
          agency: "From scan — review and update",
          url,
          dueDateText: "TBD — verify on source",
          valueText: "Not listed",
          recommendation: "WATCH — Newly discovered",
          status: "new",
          notes: snippet,
        });
      }
    }
  } catch (err) {
    const allowDemo = process.env.ALLOW_DEMO_SCAN === "true" && process.env.NODE_ENV !== "production";
    console.warn("[7RFP] scan: live discovery unavailable.", (err as Error)?.message ?? err);
    if (!allowDemo) {
      const scanError: ScanRunError = {
        status: 503,
        message: "Live discovery is unavailable. No opportunities were added. Configure the discovery provider and try again.",
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

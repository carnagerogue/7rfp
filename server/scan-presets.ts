// Hardcoded scan presets for the weekly RFP auto-discovery engine.
// Each preset bundles a friendly label, a description, and a list of search
// phrases that will be used by the scan engine in addition to (or instead of)
// the user's custom keywords.

export type ScanPresetKey =
  | "corrections_reentry"
  | "managed_it"
  | "cybersecurity"
  | "cloud_migration"
  | "workforce_dev"
  | "custom";

export type ScanPreset = {
  key: ScanPresetKey;
  label: string;
  description: string;
  keywords: string[];
  categories: string[];
};

export const SCAN_PRESETS: Record<ScanPresetKey, ScanPreset> = {
  corrections_reentry: {
    key: "corrections_reentry",
    label: "Corrections & Reentry Education",
    description:
      "Inmate education, correctional learning programs, reentry workforce, and digital learning in justice-involved settings.",
    keywords: [
      "inmate education",
      "correctional education",
      "offender education",
      "reentry program",
      "jail education",
      "prison education",
      "juvenile detention education",
      "digital learning corrections",
      "tablet program inmates",
      "LMS corrections",
      "workforce development justice involved",
    ],
    categories: ["Corrections", "Reentry", "Education", "Workforce"],
  },
  managed_it: {
    key: "managed_it",
    label: "Managed IT Services",
    description:
      "Managed IT, help desk, network and data center services, IT consulting, and IT master agreements.",
    keywords: [
      "managed IT services",
      "IT managed services",
      "help desk services",
      "network infrastructure",
      "data center services",
      "server storage refresh",
      "IT consulting services",
      "IT master agreement",
    ],
    categories: ["IT Services", "Infrastructure", "Help Desk"],
  },
  cybersecurity: {
    key: "cybersecurity",
    label: "Cybersecurity Services",
    description:
      "Managed security, SOC, vulnerability assessment, penetration testing, and CMMC compliance.",
    keywords: [
      "cybersecurity services",
      "managed security services",
      "SOC services",
      "vulnerability assessment",
      "penetration testing",
      "incident response",
      "security operations center",
      "CMMC compliance",
    ],
    categories: ["Cybersecurity", "Compliance", "SOC"],
  },
  cloud_migration: {
    key: "cloud_migration",
    label: "Cloud Migration & Modernization",
    description:
      "Microsoft 365, Azure, and AWS migrations plus broader cloud and infrastructure modernization.",
    keywords: [
      "cloud migration",
      "Microsoft 365 migration",
      "Azure migration",
      "AWS migration",
      "cloud modernization",
      "infrastructure as a service",
      "platform as a service",
    ],
    categories: ["Cloud", "Modernization"],
  },
  workforce_dev: {
    key: "workforce_dev",
    label: "Workforce Development",
    description:
      "Workforce, vocational, career-readiness and employment-services opportunities.",
    keywords: [
      "workforce development",
      "career exploration",
      "job training program",
      "vocational training",
      "career readiness",
      "skills training",
      "employment services",
    ],
    categories: ["Workforce", "Training", "Career Services"],
  },
  custom: {
    key: "custom",
    label: "Custom keywords only",
    description: "Use only the keywords you provide below — no preset list.",
    keywords: [],
    categories: [],
  },
};

export function getPreset(key: string | null | undefined): ScanPreset {
  const k = (key ?? "custom") as ScanPresetKey;
  return SCAN_PRESETS[k] ?? SCAN_PRESETS.custom;
}

// Source slug → domain. Used when shelling out to pplx with --domains.
export const SOURCE_DOMAINS: Record<string, string> = {
  sam: "sam.gov",
  caleprocure: "caleprocure.ca.gov",
  bidnet: "bidnetdirect.com",
  highergov: "highergov.com",
};

export const SOURCE_LABELS: Record<string, string> = {
  sam: "SAM.gov",
  caleprocure: "Cal eProcure",
  bidnet: "BidNet Direct",
  highergov: "HigherGov",
};

export function sourcesToDomains(slugs: string[]): string {
  return slugs
    .map((s) => SOURCE_DOMAINS[s])
    .filter(Boolean)
    .join(",");
}

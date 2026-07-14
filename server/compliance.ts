import type { InsertRfpRequirement } from "@shared/schema";

const OBLIGATION = /\b(shall|must|required to|will provide|will deliver|contractor will|offeror shall|vendor must)\b/i;

export function extractRequirements(text: string): InsertRfpRequirement[] {
  const lines = text
    .replace(/\r/g, "")
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.!?;])\s+(?=[A-Z0-9])/))
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length >= 20 && line.length <= 1200);

  const selected = lines.filter((line) => OBLIGATION.test(line)).slice(0, 100);
  const seen = new Set<string>();

  return selected.flatMap((line, index) => {
    const key = line.toLowerCase();
    if (seen.has(key)) return [];
    seen.add(key);
    return [{
      requirementText: line,
      sourceRef: `Extract ${index + 1}`,
      sourceExcerpt: line,
      owner: null,
      evidenceTitle: null,
      evidenceText: null,
      status: "gap",
      confidence: 85,
    }];
  });
}

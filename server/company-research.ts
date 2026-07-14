import { z } from "zod";

type WebHit = { title: string; url: string; excerpt: string };
type AnthropicBlock = { type?: string; text?: string; content?: Array<{ title?: string; url?: string; snippet?: string; content?: string }> };

const researchSchema = z.object({
  summary: z.string().trim().min(20).max(1_400),
  findings: z.array(z.object({
    title: z.string().trim().min(3).max(120),
    detail: z.string().trim().min(12).max(420),
    sourceUrls: z.array(z.string().url()).min(1).max(3),
  })).min(1).max(6),
});

export type CompanyResearch = z.infer<typeof researchSchema> & { sources: WebHit[] };

export class CompanyResearchError extends Error {
  constructor(message: string, readonly status = 500) {
    super(message);
  }
}

function hitsFromPayload(payload: { content?: AnthropicBlock[] }) {
  const seen = new Set<string>();
  const hits: WebHit[] = [];
  for (const block of payload.content ?? []) {
    if (block.type !== "web_search_tool_result") continue;
    for (const result of Array.isArray(block.content) ? block.content : []) {
      const url = result.url?.trim();
      if (!url || seen.has(url.toLowerCase())) continue;
      seen.add(url.toLowerCase());
      hits.push({
        url,
        title: result.title?.trim() || url,
        excerpt: (result.snippet ?? result.content ?? "").replace(/\s+/g, " ").trim().slice(0, 700),
      });
    }
  }
  return hits;
}

function textFromPayload(payload: { content?: AnthropicBlock[] }) {
  return payload.content?.find((block) => block.type === "text")?.text?.trim() ?? "";
}

function fallbackResearch(companyName: string, hits: WebHit[]): CompanyResearch {
  const selected = hits.slice(0, 4);
  if (!selected.length) throw new CompanyResearchError("No public sources were found. Add your company website or upload a document instead.", 404);
  return {
    summary: `Public context for ${companyName} is ready to review. Approve only the source material your team can verify.`,
    findings: selected.map((hit) => ({ title: hit.title, detail: hit.excerpt || "Review this source before adding it to your evidence library.", sourceUrls: [hit.url] })),
    sources: selected,
  };
}

export async function researchCompany(input: { companyName: string; companyUrl?: string; focus?: string }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new CompanyResearchError("Company research is not configured. Add ANTHROPIC_API_KEY to the server environment.", 503);
  const focus = input.focus?.trim().slice(0, 300);
  const request = [
    `Research the public company context for ${input.companyName}.`,
    input.companyUrl ? `Start with this company website: ${input.companyUrl}` : "Find the company’s official website and credible public material.",
    "Find only public, attributable information useful for a proposal team: stated products, capabilities, customers, outcomes, certifications, and positioning.",
    "Never infer, embellish, or treat search snippets as proof. Return concise review notes with source URLs.",
    focus ? `Prioritize: ${focus}` : "Prioritize the company overview, products, and differentiators.",
  ].join("\n");
  // Web-search-backed research is slow; give it room and make it tunable.
  const timeoutMs = Math.max(20_000, Math.min(120_000, Number(process.env.COMPANY_RESEARCH_TIMEOUT_MS) || 90_000));
  const maxSearches = Math.max(1, Math.min(5, Number(process.env.COMPANY_RESEARCH_MAX_WEB_SEARCHES) || 3));
  let response: Response;
  try {
    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "anthropic-version": "2023-06-01", "x-api-key": apiKey },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 1_200,
        thinking: { type: "disabled" },
        tools: [{ type: "web_search_20260318", name: "web_search", max_uses: maxSearches }],
        messages: [{ role: "user", content: `${request}\n\nReturn JSON only: { summary, findings: [{ title, detail, sourceUrls }] }. Each finding must include one or more exact URLs from the web search.` }],
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const name = (error as Error)?.name;
    console.error("[company-research] request failed:", name, (error as Error)?.message);
    if (name === "TimeoutError" || name === "AbortError") {
      throw new CompanyResearchError(
        `Company research took longer than ${Math.round(timeoutMs / 1000)}s and was stopped. Web research can be slow — please try again.`,
        503,
      );
    }
    throw new CompanyResearchError(
      "Could not reach the research service. Verify the server's ANTHROPIC_API_KEY and outbound network, then try again.",
      503,
    );
  }
  const payload = await response.json().catch(() => null) as { content?: AnthropicBlock[]; error?: { message?: string } } | null;
  if (!response.ok) throw new CompanyResearchError(payload?.error?.message || "Company research failed.", response.status === 429 ? 429 : 502);
  const hits = hitsFromPayload(payload ?? {});
  try {
    const parsed = researchSchema.parse(JSON.parse(textFromPayload(payload ?? {})));
    const validUrls = new Set(hits.map((hit) => hit.url));
    const findings = parsed.findings
      .map((finding) => ({ ...finding, sourceUrls: finding.sourceUrls.filter((url) => validUrls.has(url)) }))
      .filter((finding) => finding.sourceUrls.length > 0);
    if (!findings.length) return fallbackResearch(input.companyName, hits);
    return { summary: parsed.summary, findings, sources: hits.slice(0, 10) };
  } catch {
    return fallbackResearch(input.companyName, hits);
  }
}

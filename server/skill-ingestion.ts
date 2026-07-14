// Ingest an "AI skill" (the SKILL.md / npx-skills convention) as company evidence.
//
// We never execute `npx skills` on the server — instead we read the same public
// skill repository straight from GitHub (SKILL.md + text files under references/).
// The user-supplied URL is only parsed for owner/repo/path; every network call
// targets api.github.com or the download URLs GitHub returns, so there is no SSRF
// surface to arbitrary hosts.

const MAX_FILE_CHARS = 30_000;
const MAX_REFERENCE_BYTES = 300_000;
const MAX_SOURCES = 12;
const TEXT_EXTENSIONS = new Set(["md", "markdown", "mdx", "txt", "text", "rst"]);

export class SkillIngestionError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

type GitHubEntry = {
  name: string;
  path: string;
  type: string;
  size: number;
  download_url: string | null;
  html_url: string | null;
};

export type SkillEvidence = {
  title: string;
  sourceType: "skill";
  sourceUrl: string;
  content: string;
};

function githubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "achieve-rfp-skill-ingest",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

// Parse a github.com URL (optionally .../tree/<ref>/<path>) plus an optional
// skill name into the repo coordinates we need for the contents API.
export function parseSkillTarget(
  rawUrl: string,
  skill?: string,
): { owner: string; repo: string; path: string; ref?: string } {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new SkillIngestionError("Enter a valid GitHub URL for the skill.");
  }
  const host = url.hostname.toLowerCase();
  if (host !== "github.com" && host !== "www.github.com") {
    throw new SkillIngestionError("Only public github.com skill repositories are supported.");
  }
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 2) {
    throw new SkillIngestionError("That GitHub URL is missing an owner and repository.");
  }
  const owner = parts[0];
  const repo = parts[1].replace(/\.git$/i, "");
  let ref: string | undefined;
  let path = "";
  if ((parts[2] === "tree" || parts[2] === "blob") && parts.length >= 4) {
    ref = parts[3];
    path = parts.slice(4).join("/");
  }
  // A blob URL points at a file (e.g. .../SKILL.md); ingest its folder instead.
  if (parts[2] === "blob" && /\.[a-z0-9]+$/i.test(path)) {
    path = path.replace(/\/[^/]+$/, "");
  }
  const cleanSkill = (skill ?? "").trim().replace(/^\/+|\/+$/g, "");
  if (cleanSkill) path = path ? `${path}/${cleanSkill}` : cleanSkill;
  return { owner, repo, path, ref };
}

// Split YAML-style frontmatter (name/description) from the SKILL.md body.
export function parseFrontmatter(markdown: string): { name?: string; description?: string; body: string } {
  const match = /^---\s*\n([\s\S]*?)\n---\s*\n?/.exec(markdown);
  if (!match) return { body: markdown.trim() };
  const yaml = match[1];
  const body = markdown.slice(match[0].length).trim();
  const field = (key: string) =>
    new RegExp(`(?:^|\\n)${key}:[ \\t]*(.+)`).exec(yaml)?.[1]?.trim().replace(/^["']|["']$/g, "");
  return { name: field("name"), description: field("description"), body };
}

function clip(text: string, max = MAX_FILE_CHARS): string {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  return normalized.length > max ? `${normalized.slice(0, max - 1)}…` : normalized;
}

function extensionOf(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

async function listContents(
  owner: string,
  repo: string,
  path: string,
  ref?: string,
): Promise<GitHubEntry[]> {
  const base = `https://api.github.com/repos/${owner}/${repo}/contents/${path ? encodeURI(path) : ""}`;
  const url = ref ? `${base}?ref=${encodeURIComponent(ref)}` : base;
  let response: Response;
  try {
    response = await fetch(url, { headers: githubHeaders(), signal: AbortSignal.timeout(15_000) });
  } catch {
    throw new SkillIngestionError("Could not reach GitHub. Try again.", 503);
  }
  if (response.status === 404) {
    throw new SkillIngestionError("That skill path was not found on GitHub. Check the URL and skill name.", 404);
  }
  if (response.status === 403) {
    throw new SkillIngestionError("GitHub rate limit reached. Add a GITHUB_TOKEN to the server or try again later.", 429);
  }
  if (!response.ok) {
    throw new SkillIngestionError(`GitHub request failed (${response.status}).`, 502);
  }
  const body = await response.json().catch(() => null);
  if (!Array.isArray(body)) {
    throw new SkillIngestionError("Point to a skill folder that contains a SKILL.md file, not a single file.");
  }
  return body as GitHubEntry[];
}

async function fetchText(entry: GitHubEntry): Promise<string> {
  if (!entry.download_url) return "";
  try {
    const response = await fetch(entry.download_url, {
      headers: { "User-Agent": "achieve-rfp-skill-ingest" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return "";
    return await response.text();
  } catch {
    return "";
  }
}

export async function ingestSkill(input: {
  url: string;
  skill?: string;
}): Promise<{ skillName: string; sources: SkillEvidence[] }> {
  const { owner, repo, path, ref } = parseSkillTarget(input.url, input.skill);
  const entries = await listContents(owner, repo, path, ref);

  const skillFile = entries.find((e) => e.type === "file" && e.name.toLowerCase() === "skill.md");
  if (!skillFile) {
    const dirs = entries.filter((e) => e.type === "dir").map((e) => e.name);
    if (dirs.length) {
      throw new SkillIngestionError(
        `No SKILL.md at that path. This repository may hold multiple skills — add a skill name (e.g. ${dirs.slice(0, 5).join(", ")}).`,
      );
    }
    throw new SkillIngestionError("No SKILL.md found. Point to a folder that contains a SKILL.md file.");
  }

  const skillMarkdown = await fetchText(skillFile);
  if (!skillMarkdown.trim()) {
    throw new SkillIngestionError("SKILL.md could not be read from GitHub.", 502);
  }
  const frontmatter = parseFrontmatter(skillMarkdown);
  const skillName = frontmatter.name || (path ? path.split("/").pop()! : repo);

  const sources: SkillEvidence[] = [];
  const skillContent = [
    frontmatter.description ? `Skill: ${skillName}\n${frontmatter.description}` : `Skill: ${skillName}`,
    frontmatter.body,
  ]
    .filter(Boolean)
    .join("\n\n");
  sources.push({
    title: `${skillName} (AI skill)`,
    sourceType: "skill",
    sourceUrl: skillFile.html_url || `https://github.com/${owner}/${repo}`,
    content: clip(skillContent),
  });

  // Pull prose reference docs (skip stylesheets, configs, images, binaries).
  const referencesDir = entries.find((e) => e.type === "dir" && e.name.toLowerCase() === "references");
  if (referencesDir) {
    let referenceEntries: GitHubEntry[] = [];
    try {
      referenceEntries = await listContents(owner, repo, referencesDir.path, ref);
    } catch {
      referenceEntries = [];
    }
    const textReferences = referenceEntries.filter(
      (e) => e.type === "file" && TEXT_EXTENSIONS.has(extensionOf(e.name)) && e.size <= MAX_REFERENCE_BYTES,
    );
    for (const reference of textReferences) {
      if (sources.length >= MAX_SOURCES) break;
      const text = clip(await fetchText(reference));
      if (text.length < 20) continue;
      sources.push({
        title: `${skillName} — ${reference.name}`,
        sourceType: "skill",
        sourceUrl: reference.html_url || skillFile.html_url || `https://github.com/${owner}/${repo}`,
        content: text,
      });
    }
  }

  return { skillName, sources };
}

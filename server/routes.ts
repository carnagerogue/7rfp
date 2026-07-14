import type { Express, Request, Response } from "express";
import type { Server } from "node:http";
import { storage } from "./storage";
import {
  signupSchema,
  loginSchema,
  changePasswordSchema,
  insertRfpSchema,
  insertProfileSchema,
  insertProposalSchema,
  insertRfpRequirementSchema,
} from "@shared/schema";
import {
  hashPassword,
  verifyPassword,
  signToken,
  authMiddleware,
  setAuthCookie,
  clearAuthCookie,
} from "./auth";
import { generateDraftSections } from "./draft-generator";
import { runScanForAccount } from "./scan";
import { SCAN_PRESETS } from "./scan-presets";
import { extractRequirements } from "./compliance";
import {
  aiActionSchema,
  PursuitIntelligenceError,
  runPursuitIntelligence,
} from "./pursuit-intelligence";
import { CompanyResearchError, researchCompany } from "./company-research";
import { DocumentExtractionError, extractDocumentText } from "./document-extraction";
import { SkillIngestionError, ingestSkill } from "./skill-ingestion";
import { z } from "zod";

function publicAccount(a: { id: number; email: string; companyName: string; plan: string }) {
  return { id: a.id, email: a.email, companyName: a.companyName, plan: a.plan };
}

const intelligenceInFlightAccounts = new Set<number>();
const companyResearchInFlightAccounts = new Set<number>();
const companyResearchRuns = new Map<number, number[]>();
const skillIngestInFlightAccounts = new Set<number>();
const skillIngestRuns = new Map<number, number[]>();

function parseAiRun(run: { id: number; action: string; model: string; resultJson: string; sourceIdsJson: string; inputTokens: number; outputTokens: number; createdAt: Date }) {
  try {
    return {
      id: run.id,
      action: run.action,
      model: run.model,
      result: JSON.parse(run.resultJson),
      sourceIds: JSON.parse(run.sourceIdsJson),
      usage: { inputTokens: run.inputTokens, outputTokens: run.outputTokens },
      createdAt: run.createdAt,
    };
  } catch {
    return null;
  }
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // Public, dependency-free liveness check for deployment platforms.
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  // ------------ Auth ------------
  app.post("/api/auth/signup", async (req: Request, res: Response) => {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid signup data", errors: parsed.error.errors });
    }
    const { email, password, companyName } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();
    const existing = storage.getAccountByEmail(normalizedEmail);
    if (existing) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }
    const passwordHash = await hashPassword(password);
    const account = storage.createAccount({ email: normalizedEmail, passwordHash, companyName });
    // Pre-fill the scan preset for two flagship tenants when their company name matches.
    const lowerName = companyName.toLowerCase();
    let scanPreset: "corrections_reentry" | "managed_it" | "custom" = "custom";
    if (lowerName.includes("nucleos")) scanPreset = "corrections_reentry";
    else if (lowerName.includes("it1")) scanPreset = "managed_it";
    // Derive tracking prefix from company name: first 3 alphanumeric chars, uppercase
    const trackingPrefix =
      (companyName.replace(/[^a-zA-Z0-9]/g, "").slice(0, 3).toUpperCase() || "RFP");
    storage.upsertProfile(account.id, { scanPreset, trackingPrefix });
    const token = signToken(account.id);
    setAuthCookie(res, token);
    res.json({ account: publicAccount(account) });
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid login data" });
    }
    const account = storage.getAccountByEmail(parsed.data.email.toLowerCase().trim());
    if (!account) return res.status(401).json({ message: "Invalid email or password" });
    const ok = await verifyPassword(parsed.data.password, account.passwordHash);
    if (!ok) return res.status(401).json({ message: "Invalid email or password" });
    const token = signToken(account.id);
    setAuthCookie(res, token);
    res.json({ account: publicAccount(account) });
  });

  app.post("/api/auth/logout", (_req, res) => {
    clearAuthCookie(res);
    res.json({ ok: true });
  });

  app.get("/api/auth/me", authMiddleware, (req: Request, res: Response) => {
    const account = storage.getAccount(req.accountId!);
    if (!account) return res.status(404).json({ message: "Account not found" });
    res.json({ account: publicAccount(account) });
  });

  app.post("/api/auth/change-password", authMiddleware, async (req: Request, res: Response) => {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input" });
    }
    const account = storage.getAccount(req.accountId!);
    if (!account) return res.status(404).json({ message: "Account not found" });
    const ok = await verifyPassword(parsed.data.currentPassword, account.passwordHash);
    if (!ok) return res.status(400).json({ message: "Current password is incorrect" });
    const newHash = await hashPassword(parsed.data.newPassword);
    storage.updatePassword(account.id, newHash);
    res.json({ ok: true });
  });

  // ------------ Scan presets (static metadata) ------------
  app.get("/api/scan-presets", (_req, res) => {
    res.json({ presets: SCAN_PRESETS });
  });

  // ------------ Run scan (on demand) ------------
  app.post("/api/scan/run", authMiddleware, async (req, res) => {
    try {
      const result = await runScanForAccount(req.accountId!);
      res.json(result);
    } catch (err: any) {
      const status = typeof err?.status === "number" ? err.status : 500;
      const message = err?.message ?? "Scan failed";
      res.status(status).json({ message });
    }
  });

  // ------------ Profile ------------
  app.get("/api/profile", authMiddleware, (req, res) => {
    const profile = storage.getProfile(req.accountId!);
    res.json({ profile: profile ?? null });
  });

  const profileUpdateSchema = insertProfileSchema.omit({ accountId: true }).partial();
  const LOGO_MAX_CHARS = 700_000; // ~500KB raw payload after base64
  app.put("/api/profile", authMiddleware, (req, res) => {
    const parsed = profileUpdateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid profile" });
    const logo = parsed.data.logoDataUrl;
    if (logo && logo.length > LOGO_MAX_CHARS) {
      return res
        .status(413)
        .json({ message: "Logo too large. Please use an image under 500 KB." });
    }
    const profile = storage.upsertProfile(req.accountId!, parsed.data);
    res.json({ profile });
  });

  // ------------ Company evidence library ------------
  const companySourceSchema = z.object({
    title: z.string().trim().min(2).max(180),
    sourceType: z.enum(["website", "capability_statement", "case_study", "past_performance", "certification", "product", "note"]),
    sourceUrl: z.string().trim().url().max(1_000).optional().or(z.literal("")),
    content: z.string().trim().min(20).max(30_000),
    status: z.literal("verified").default("verified"),
  });
  app.get("/api/company-sources", authMiddleware, (req, res) => {
    res.json({ sources: storage.listCompanySources(req.accountId!) });
  });
  app.post("/api/company-sources", authMiddleware, (req, res) => {
    const parsed = companySourceSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Invalid source" });
    const source = storage.createCompanySource(req.accountId!, {
      ...parsed.data,
      sourceUrl: parsed.data.sourceUrl || null,
    });
    res.status(201).json({ source });
  });
  const documentUploadSchema = z.object({
    fileName: z.string().trim().min(3).max(240),
    dataUrl: z.string().min(40).max(4_300_000),
    sourceType: z.enum(["capability_statement", "case_study", "past_performance", "certification", "product", "note"]).default("capability_statement"),
    title: z.string().trim().min(2).max(180).optional(),
  });
  app.post("/api/company-sources/upload", authMiddleware, async (req, res) => {
    const parsed = documentUploadSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Invalid document" });
    try {
      const content = await extractDocumentText(parsed.data);
      const defaultTitle = parsed.data.fileName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
      const source = storage.createCompanySource(req.accountId!, {
        title: parsed.data.title || defaultTitle || "Uploaded company document",
        sourceType: parsed.data.sourceType,
        sourceUrl: null,
        content,
        status: "verified",
      });
      res.status(201).json({ source, extractedCharacters: content.length });
    } catch (error) {
      if (error instanceof DocumentExtractionError) return res.status(error.status).json({ message: error.message });
      console.error("[company-evidence] document extraction failed", error);
      res.status(500).json({ message: "Document extraction failed." });
    }
  });
  const companyResearchSchema = z.object({
    companyName: z.string().trim().min(2).max(180),
    companyUrl: z.string().trim().url().max(1_000).optional().or(z.literal("")),
    focus: z.string().trim().max(300).optional(),
  });
  app.post("/api/company-research", authMiddleware, async (req, res) => {
    const parsed = companyResearchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Invalid company research request" });
    const accountId = req.accountId!;
    const now = Date.now();
    const recentRuns = (companyResearchRuns.get(accountId) ?? []).filter((time) => time > now - 60 * 60 * 1000);
    if (recentRuns.length >= 6) return res.status(429).json({ message: "Company research limit reached. Try again in an hour." });
    if (companyResearchInFlightAccounts.has(accountId)) return res.status(409).json({ message: "Company research is already running for this workspace." });
    companyResearchRuns.set(accountId, [...recentRuns, now]);
    companyResearchInFlightAccounts.add(accountId);
    try {
      const research = await researchCompany({ ...parsed.data, companyUrl: parsed.data.companyUrl || undefined });
      res.json({ research });
    } catch (error) {
      if (error instanceof CompanyResearchError) return res.status(error.status).json({ message: error.message });
      console.error("[company-evidence] research failed", error);
      res.status(500).json({ message: "Company research failed." });
    } finally {
      companyResearchInFlightAccounts.delete(accountId);
    }
  });
  // Import an "AI skill" (SKILL.md + reference docs) from a public GitHub repo
  // as reviewable company evidence. See server/skill-ingestion.ts.
  const skillIngestSchema = z.object({
    url: z.string().trim().url().max(400),
    skill: z.string().trim().max(120).optional().or(z.literal("")),
  });
  app.post("/api/company-sources/ingest-skill", authMiddleware, async (req, res) => {
    const parsed = skillIngestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Invalid skill request" });
    const accountId = req.accountId!;
    const now = Date.now();
    const recentRuns = (skillIngestRuns.get(accountId) ?? []).filter((time) => time > now - 60 * 60 * 1000);
    if (recentRuns.length >= 10) return res.status(429).json({ message: "Skill import limit reached. Try again in an hour." });
    if (skillIngestInFlightAccounts.has(accountId)) return res.status(409).json({ message: "A skill import is already running for this workspace." });
    skillIngestRuns.set(accountId, [...recentRuns, now]);
    skillIngestInFlightAccounts.add(accountId);
    try {
      const { skillName, sources } = await ingestSkill({ url: parsed.data.url, skill: parsed.data.skill || undefined });
      const created = sources
        .map((source) =>
          storage.createCompanySource(accountId, {
            title: source.title,
            sourceType: source.sourceType,
            sourceUrl: source.sourceUrl,
            content: source.content,
            status: "verified",
          }),
        )
        .filter(Boolean);
      res.status(201).json({ skillName, sources: created, added: created.length });
    } catch (error) {
      if (error instanceof SkillIngestionError) return res.status(error.status).json({ message: error.message });
      console.error("[company-evidence] skill ingestion failed", error);
      res.status(500).json({ message: "Skill ingestion failed." });
    } finally {
      skillIngestInFlightAccounts.delete(accountId);
    }
  });

  app.delete("/api/company-sources/:id", authMiddleware, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: "Invalid id" });
    if (!storage.deleteCompanySource(req.accountId!, id)) return res.status(404).json({ message: "Source not found" });
    res.status(204).end();
  });

  // ------------ RFPs ------------
  app.get("/api/rfps", authMiddleware, (req, res) => {
    const list = storage.listRfps(req.accountId!);
    const meta = storage.getCommentMetaMap(req.accountId!);
    const enriched = list.map((r) => {
      const m = meta.get(r.id) ?? { commentCount: 0, unreadCount: 0 };
      return { ...r, commentCount: m.commentCount, unreadCount: m.unreadCount };
    });
    const totals = enriched.reduce(
      (acc, r) => {
        acc.commentTotal += r.commentCount;
        acc.unreadTotal += r.unreadCount;
        return acc;
      },
      { commentTotal: 0, unreadTotal: 0 },
    );
    res.json({ rfps: enriched, ...totals });
  });

  app.post("/api/rfps", authMiddleware, (req, res) => {
    const parsed = insertRfpSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid RFP", errors: parsed.error.errors });
    const rfp = storage.createRfp(req.accountId!, parsed.data);
    res.json({ rfp });
  });

  app.get("/api/rfps/:id", authMiddleware, (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid id" });
    const rfp = storage.getRfp(req.accountId!, id);
    if (!rfp) return res.status(404).json({ message: "RFP not found" });
    res.json({ rfp });
  });

  const rfpUpdateSchema = insertRfpSchema.partial();
  app.put("/api/rfps/:id", authMiddleware, (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid id" });
    const parsed = rfpUpdateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid input" });
    const rfp = storage.updateRfp(req.accountId!, id, parsed.data);
    if (!rfp) return res.status(404).json({ message: "RFP not found" });
    res.json({ rfp });
  });

  app.delete("/api/rfps/:id", authMiddleware, (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid id" });
    const ok = storage.deleteRfp(req.accountId!, id);
    if (!ok) return res.status(404).json({ message: "RFP not found" });
    res.json({ ok: true });
  });

  // ------------ Compliance matrix ------------
  app.get("/api/rfps/:id/requirements", authMiddleware, (req, res) => {
    const rfpId = parseInt(String(req.params.id), 10);
    if (Number.isNaN(rfpId)) return res.status(400).json({ message: "Invalid id" });
    if (!storage.getRfp(req.accountId!, rfpId)) return res.status(404).json({ message: "RFP not found" });
    res.json({ requirements: storage.listRequirements(req.accountId!, rfpId) });
  });

  app.post("/api/rfps/:id/requirements", authMiddleware, (req, res) => {
    const rfpId = parseInt(String(req.params.id), 10);
    if (Number.isNaN(rfpId)) return res.status(400).json({ message: "Invalid id" });
    const parsed = insertRfpRequirementSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid requirement" });
    const requirement = storage.createRequirement(req.accountId!, rfpId, parsed.data);
    if (!requirement) return res.status(404).json({ message: "RFP not found" });
    res.json({ requirement });
  });

  app.put("/api/rfps/:rfpId/requirements/:id", authMiddleware, (req, res) => {
    const rfpId = parseInt(String(req.params.rfpId), 10);
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(rfpId) || Number.isNaN(id)) return res.status(400).json({ message: "Invalid id" });
    const parsed = insertRfpRequirementSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid requirement" });
    const requirement = storage.updateRequirement(req.accountId!, rfpId, id, parsed.data);
    if (!requirement) return res.status(404).json({ message: "Requirement not found" });
    res.json({ requirement });
  });

  app.delete("/api/rfps/:rfpId/requirements/:id", authMiddleware, (req, res) => {
    const rfpId = parseInt(String(req.params.rfpId), 10);
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(rfpId) || Number.isNaN(id)) return res.status(400).json({ message: "Invalid id" });
    const ok = storage.deleteRequirement(req.accountId!, rfpId, id);
    if (!ok) return res.status(404).json({ message: "Requirement not found" });
    res.json({ ok: true });
  });

  const extractionSchema = z.object({ solicitationText: z.string().trim().min(20).max(500_000) });
  app.post("/api/rfps/:id/requirements/extract", authMiddleware, (req, res) => {
    const rfpId = parseInt(String(req.params.id), 10);
    if (Number.isNaN(rfpId)) return res.status(400).json({ message: "Invalid id" });
    if (!storage.getRfp(req.accountId!, rfpId)) return res.status(404).json({ message: "RFP not found" });
    const parsed = extractionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Paste at least 20 characters of solicitation text" });
    const existing = new Set(
      storage.listRequirements(req.accountId!, rfpId).map((item) => item.requirementText.toLowerCase()),
    );
    const extracted = extractRequirements(parsed.data.solicitationText).filter(
      (item) => !existing.has(item.requirementText.toLowerCase()),
    );
    const requirements = extracted
      .map((item) => storage.createRequirement(req.accountId!, rfpId, item))
      .filter(Boolean);
    res.json({ requirements, added: requirements.length, mode: "deterministic" });
  });

  // ------------ Pursuit intelligence (Claude server gateway) ------------
  const intelligenceRequestSchema = z.object({
    action: aiActionSchema,
    focus: z.string().trim().max(280).optional(),
  });

  app.get("/api/rfps/:id/intelligence/latest", authMiddleware, (req, res) => {
    const rfpId = parseInt(String(req.params.id), 10);
    if (Number.isNaN(rfpId)) return res.status(400).json({ message: "Invalid id" });
    const run = storage.getLatestAiRun(req.accountId!, rfpId);
    res.json({ run: run ? parseAiRun(run) : null });
  });

  app.post("/api/rfps/:id/intelligence", authMiddleware, async (req, res) => {
    const rfpId = parseInt(String(req.params.id), 10);
    if (Number.isNaN(rfpId)) return res.status(400).json({ message: "Invalid id" });
    const parsed = intelligenceRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Choose a supported intelligence action." });
    const accountId = req.accountId!;
    const rfp = storage.getRfp(accountId, rfpId);
    if (!rfp) return res.status(404).json({ message: "RFP not found" });

    const hourLimit = Math.max(1, Number(process.env.AI_MAX_REQUESTS_PER_HOUR || 8));
    const dayLimit = Math.max(hourLimit, Number(process.env.AI_MAX_REQUESTS_PER_DAY || 30));
    const hourly = storage.countAiRunsSince(accountId, new Date(Date.now() - 60 * 60 * 1000));
    const daily = storage.countAiRunsSince(accountId, new Date(Date.now() - 24 * 60 * 60 * 1000));
    if (hourly >= hourLimit || daily >= dayLimit) {
      return res.status(429).json({ message: "Pursuit intelligence quota reached. Try again later." });
    }
    if (intelligenceInFlightAccounts.has(accountId)) {
      return res.status(409).json({ message: "Pursuit intelligence is already running for this workspace." });
    }

    intelligenceInFlightAccounts.add(accountId);
    try {
      const response = await runPursuitIntelligence({
        action: parsed.data.action,
        focus: parsed.data.focus,
        rfp,
        profile: storage.getProfile(accountId),
        requirements: storage.listRequirements(accountId, rfpId),
        companySources: storage.listCompanySources(accountId),
      });
      const run = storage.createAiRun(accountId, rfpId, {
        action: parsed.data.action,
        model: "claude-sonnet-5",
        resultJson: JSON.stringify(response.result),
        sourceIdsJson: JSON.stringify(response.sourceIds),
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens,
      });
      if (!run) return res.status(404).json({ message: "RFP not found" });
      res.json({ run: parseAiRun(run) });
    } catch (error) {
      if (error instanceof PursuitIntelligenceError) {
        return res.status(error.status).json({ message: error.message });
      }
      console.error("[pursuit-intelligence] unexpected failure", error);
      res.status(500).json({ message: "Pursuit intelligence failed." });
    } finally {
      intelligenceInFlightAccounts.delete(accountId);
    }
  });

  // ------------ Team Notes (RFP Comments) ------------
  app.get("/api/rfps/:id/comments", authMiddleware, (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid id" });
    const rfp = storage.getRfp(req.accountId!, id);
    if (!rfp) return res.status(404).json({ message: "RFP not found" });
    const comments = storage.listRfpComments(req.accountId!, id);
    res.json({ comments });
  });

  const newCommentSchema = z.object({
    body: z.string().trim().min(1, "Comment cannot be empty").max(4000),
  });
  app.post("/api/rfps/:id/comments", authMiddleware, (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid id" });
    const parsed = newCommentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Invalid comment" });
    }
    const account = storage.getAccount(req.accountId!);
    if (!account) return res.status(404).json({ message: "Account not found" });
    const comment = storage.addRfpComment(
      req.accountId!,
      id,
      account.email,
      parsed.data.body,
    );
    if (!comment) return res.status(404).json({ message: "RFP not found" });
    res.json({ comment });
  });

  app.post("/api/rfps/:id/comments/mark-read", authMiddleware, (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid id" });
    const rfp = storage.getRfp(req.accountId!, id);
    if (!rfp) return res.status(404).json({ message: "RFP not found" });
    storage.markRfpCommentsRead(req.accountId!, id);
    res.json({ ok: true });
  });

  // ------------ Proposals ------------
  app.get("/api/proposals/:rfpId", authMiddleware, (req, res) => {
    const rfpId = parseInt(String(req.params.rfpId), 10);
    if (Number.isNaN(rfpId)) return res.status(400).json({ message: "Invalid id" });
    const rfp = storage.getRfp(req.accountId!, rfpId);
    if (!rfp) return res.status(404).json({ message: "RFP not found" });
    const proposal = storage.getProposal(req.accountId!, rfpId);
    res.json({ proposal: proposal ?? null });
  });

  const proposalUpdateSchema = insertProposalSchema.omit({ rfpId: true }).partial();
  app.put("/api/proposals/:rfpId", authMiddleware, (req, res) => {
    const rfpId = parseInt(String(req.params.rfpId), 10);
    if (Number.isNaN(rfpId)) return res.status(400).json({ message: "Invalid id" });
    const parsed = proposalUpdateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid proposal" });
    const proposal = storage.upsertProposal(req.accountId!, rfpId, parsed.data);
    if (!proposal) return res.status(404).json({ message: "RFP not found" });
    // bump status to drafting/reviewed if it was new
    const rfp = storage.getRfp(req.accountId!, rfpId);
    if (rfp && rfp.status === "new") {
      storage.updateRfp(req.accountId!, rfpId, { status: "drafting" });
    }
    res.json({ proposal });
  });

  app.post("/api/proposals/:rfpId/generate", authMiddleware, (req, res) => {
    const rfpId = parseInt(String(req.params.rfpId), 10);
    if (Number.isNaN(rfpId)) return res.status(400).json({ message: "Invalid id" });
    const rfp = storage.getRfp(req.accountId!, rfpId);
    if (!rfp) return res.status(404).json({ message: "RFP not found" });
    const profile = storage.getProfile(req.accountId!);
    const account = storage.getAccount(req.accountId!);
    const sections = generateDraftSections(profile, rfp, account?.companyName);
    const proposal = storage.upsertProposal(req.accountId!, rfpId, sections);
    storage.updateRfp(req.accountId!, rfpId, { status: "drafting" });
    res.json({ proposal });
  });

  app.post("/api/proposals/:rfpId/mark-downloaded", authMiddleware, (req, res) => {
    const rfpId = parseInt(String(req.params.rfpId), 10);
    if (Number.isNaN(rfpId)) return res.status(400).json({ message: "Invalid id" });
    const rfp = storage.markRfpDownloaded(req.accountId!, rfpId);
    if (!rfp) return res.status(404).json({ message: "RFP not found" });
    res.json({ rfp });
  });

  return httpServer;
}

import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ----- Accounts (tenants) -----
export const accounts = sqliteTable("accounts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  companyName: text("company_name").notNull(),
  plan: text("plan").notNull().default("free"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s','now'))`),
});

export const insertAccountSchema = createInsertSchema(accounts).omit({
  id: true,
  passwordHash: true,
  createdAt: true,
});
export type InsertAccount = z.infer<typeof insertAccountSchema>;
export type Account = typeof accounts.$inferSelect;

// ----- Profile (one per account) -----
export const profiles = sqliteTable("profiles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  accountId: integer("account_id")
    .notNull()
    .unique()
    .references(() => accounts.id),
  overview: text("overview"),
  capabilities: text("capabilities"),
  pastPerformance: text("past_performance"),
  keyPersonnel: text("key_personnel"),
  pricingApproach: text("pricing_approach"),
  certifications: text("certifications"),
  differentiators: text("differentiators"),
  logoDataUrl: text("logo_data_url"),
  scanPreset: text("scan_preset").notNull().default("custom"),
  scanKeywords: text("scan_keywords").notNull().default(""),
  scanSources: text("scan_sources").notNull().default("sam,caleprocure,bidnet,highergov"),
  lastScanAt: text("last_scan_at"),
  lastScanCount: integer("last_scan_count").notNull().default(0),
  weightFit: integer("weight_fit").notNull().default(30),
  weightWin: integer("weight_win").notNull().default(30),
  weightEffort: integer("weight_effort").notNull().default(20),
  weightValue: integer("weight_value").notNull().default(20),
  trackingPrefix: text("tracking_prefix").notNull().default("RFP"),
  trackingCounter: integer("tracking_counter").notNull().default(0),
});

export const insertProfileSchema = createInsertSchema(profiles).omit({
  id: true,
});
export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type Profile = typeof profiles.$inferSelect;

// ----- Company evidence library -----
// Explicitly saved, tenant-scoped source material used to ground proposal intelligence.
export const companySources = sqliteTable("company_sources", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  accountId: integer("account_id").notNull().references(() => accounts.id),
  title: text("title").notNull(),
  sourceType: text("source_type").notNull().default("note"),
  sourceUrl: text("source_url"),
  content: text("content").notNull(),
  status: text("status").notNull().default("verified"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s','now'))`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s','now'))`),
});
export const insertCompanySourceSchema = createInsertSchema(companySources).omit({
  id: true,
  accountId: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCompanySource = z.infer<typeof insertCompanySourceSchema>;
export type CompanySource = typeof companySources.$inferSelect;

// ----- RFPs -----
export const rfps = sqliteTable("rfps", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  accountId: integer("account_id")
    .notNull()
    .references(() => accounts.id),
  title: text("title").notNull(),
  agency: text("agency"),
  dueDateText: text("due_date_text"),
  valueText: text("value_text"),
  url: text("url"),
  recommendation: text("recommendation"),
  status: text("status").notNull().default("new"),
  notes: text("notes"),
  scoreFit: integer("score_fit").notNull().default(3),
  scoreWin: integer("score_win").notNull().default(3),
  scoreEffort: integer("score_effort").notNull().default(3),
  scoreValue: integer("score_value").notNull().default(3),
  priorityOverride: integer("priority_override"), // 1-5 manual override, null = use computed
  trackingId: text("tracking_id"), // e.g. "NUC-0042"
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s','now'))`),
});

export const insertRfpSchema = createInsertSchema(rfps).omit({
  id: true,
  accountId: true,
  createdAt: true,
});
export type InsertRfp = z.infer<typeof insertRfpSchema>;
export type Rfp = typeof rfps.$inferSelect;

// ----- Solicitation requirements / compliance matrix -----
export const rfpRequirements = sqliteTable("rfp_requirements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  rfpId: integer("rfp_id").notNull().references(() => rfps.id),
  accountId: integer("account_id").notNull().references(() => accounts.id),
  requirementText: text("requirement_text").notNull(),
  sourceRef: text("source_ref"),
  sourceExcerpt: text("source_excerpt"),
  owner: text("owner"),
  evidenceTitle: text("evidence_title"),
  evidenceText: text("evidence_text"),
  status: text("status").notNull().default("gap"),
  confidence: integer("confidence").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s','now'))`),
});

export const insertRfpRequirementSchema = createInsertSchema(rfpRequirements).omit({
  id: true,
  rfpId: true,
  accountId: true,
  createdAt: true,
});
export type InsertRfpRequirement = z.infer<typeof insertRfpRequirementSchema>;
export type RfpRequirement = typeof rfpRequirements.$inferSelect;

// ----- Grounded AI runs -----
// Stores output and auditable usage metadata. API keys and raw prompts are never persisted.
export const rfpAiRuns = sqliteTable("rfp_ai_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  rfpId: integer("rfp_id").notNull().references(() => rfps.id),
  accountId: integer("account_id").notNull().references(() => accounts.id),
  action: text("action").notNull(),
  model: text("model").notNull(),
  status: text("status").notNull().default("completed"),
  resultJson: text("result_json").notNull(),
  sourceIdsJson: text("source_ids_json").notNull(),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s','now'))`),
});
export type RfpAiRun = typeof rfpAiRuns.$inferSelect;

// ----- RFP Comments (Team Notes) -----
export const rfpComments = sqliteTable("rfp_comments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  rfpId: integer("rfp_id")
    .notNull()
    .references(() => rfps.id),
  accountId: integer("account_id")
    .notNull()
    .references(() => accounts.id),
  authorEmail: text("author_email").notNull(),
  body: text("body").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s','now'))`),
});

export const insertRfpCommentSchema = createInsertSchema(rfpComments).omit({
  id: true,
  accountId: true,
  authorEmail: true,
  createdAt: true,
  rfpId: true,
});
export type InsertRfpComment = z.infer<typeof insertRfpCommentSchema>;
export type RfpComment = typeof rfpComments.$inferSelect;

// Tracks per-user (account) read state for each RFP's comment thread.
// One row per (accountId, rfpId). Updated when the thread is opened.
export const rfpCommentReads = sqliteTable("rfp_comment_reads", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  rfpId: integer("rfp_id")
    .notNull()
    .references(() => rfps.id),
  accountId: integer("account_id")
    .notNull()
    .references(() => accounts.id),
  lastReadAt: integer("last_read_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s','now'))`),
});
export type RfpCommentRead = typeof rfpCommentReads.$inferSelect;

// ----- Proposals -----
export const proposals = sqliteTable("proposals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  rfpId: integer("rfp_id")
    .notNull()
    .unique()
    .references(() => rfps.id),
  executiveSummary: text("executive_summary"),
  companyOverview: text("company_overview"),
  understanding: text("understanding"),
  technicalApproach: text("technical_approach"),
  pastPerformance: text("past_performance"),
  pricingApproach: text("pricing_approach"),
  timeline: text("timeline"),
  conclusion: text("conclusion"),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s','now'))`),
});

export const insertProposalSchema = createInsertSchema(proposals).omit({
  id: true,
  updatedAt: true,
});
export type InsertProposal = z.infer<typeof insertProposalSchema>;
export type Proposal = typeof proposals.$inferSelect;

// ----- Auth payloads -----
export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  companyName: z.string().min(1),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// ----- Priority scoring -----
// Computes a 1-5 priority. Inputs: fit/win/value 1-5 (higher better), effort 1-5 (lower better).
// Weights are integers, normalized internally.
export function computePriority(
  rfp: { scoreFit: number; scoreWin: number; scoreEffort: number; scoreValue: number; priorityOverride?: number | null },
  weights: { weightFit: number; weightWin: number; weightEffort: number; weightValue: number }
): number {
  if (rfp.priorityOverride && rfp.priorityOverride >= 1 && rfp.priorityOverride <= 5) {
    return rfp.priorityOverride;
  }
  const wf = Math.max(0, weights.weightFit);
  const ww = Math.max(0, weights.weightWin);
  const we = Math.max(0, weights.weightEffort);
  const wv = Math.max(0, weights.weightValue);
  const total = wf + ww + we + wv || 1;
  // Effort is inverted: lower effort = better
  const effortInverted = 6 - rfp.scoreEffort;
  const weighted =
    (wf * rfp.scoreFit + ww * rfp.scoreWin + we * effortInverted + wv * rfp.scoreValue) / total;
  // Round to nearest 1-5
  return Math.max(1, Math.min(5, Math.round(weighted)));
}

export const DEFAULT_WEIGHTS = {
  weightFit: 30,
  weightWin: 30,
  weightEffort: 20,
  weightValue: 20,
} as const;

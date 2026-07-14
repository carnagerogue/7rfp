import {
  accounts,
  profiles,
  rfps,
  proposals,
  rfpComments,
  rfpCommentReads,
  rfpRequirements,
  rfpAiRuns,
  companySources,
} from "@shared/schema";
import type {
  Account,
  Profile,
  Rfp,
  Proposal,
  InsertRfp,
  InsertProfile,
  RfpComment,
  RfpRequirement,
  InsertRfpRequirement,
  RfpAiRun,
  CompanySource,
  InsertCompanySource,
} from "@shared/schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { and, eq, desc } from "drizzle-orm";

// SQLite path: configurable so Render (and other hosts) can mount persistent storage.
// Defaults to ./data.db for local dev and the existing pplx.app deploy.
const sqlite = new Database(process.env.DATA_DB_PATH || "data.db");
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite);

// Bootstrap tables (idempotent) — keeps first run working without drizzle-kit push
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    company_name TEXT NOT NULL,
    plan TEXT NOT NULL DEFAULT 'free',
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  );
  CREATE TABLE IF NOT EXISTS profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL UNIQUE REFERENCES accounts(id),
    overview TEXT,
    capabilities TEXT,
    past_performance TEXT,
    key_personnel TEXT,
    pricing_approach TEXT,
    certifications TEXT,
    differentiators TEXT,
    logo_data_url TEXT
  );
  CREATE TABLE IF NOT EXISTS rfps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id),
    title TEXT NOT NULL,
    agency TEXT,
    due_date_text TEXT,
    value_text TEXT,
    url TEXT,
    recommendation TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    notes TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  );
  -- Idempotent migration for existing dbs that pre-date logo support.
  -- SQLite has no IF NOT EXISTS for ADD COLUMN, but we can swallow the error.
  CREATE TABLE IF NOT EXISTS rfp_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rfp_id INTEGER NOT NULL REFERENCES rfps(id),
    account_id INTEGER NOT NULL REFERENCES accounts(id),
    author_email TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  );
  CREATE INDEX IF NOT EXISTS idx_rfp_comments_rfp ON rfp_comments(rfp_id);
  CREATE TABLE IF NOT EXISTS rfp_comment_reads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rfp_id INTEGER NOT NULL REFERENCES rfps(id),
    account_id INTEGER NOT NULL REFERENCES accounts(id),
    last_read_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_rfp_comment_reads_unique
    ON rfp_comment_reads(account_id, rfp_id);
  CREATE TABLE IF NOT EXISTS proposals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rfp_id INTEGER NOT NULL UNIQUE REFERENCES rfps(id),
    executive_summary TEXT,
    company_overview TEXT,
    understanding TEXT,
    technical_approach TEXT,
    past_performance TEXT,
    pricing_approach TEXT,
    timeline TEXT,
    conclusion TEXT,
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  );
  CREATE TABLE IF NOT EXISTS rfp_requirements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rfp_id INTEGER NOT NULL REFERENCES rfps(id),
    account_id INTEGER NOT NULL REFERENCES accounts(id),
    requirement_text TEXT NOT NULL,
    source_ref TEXT,
    source_excerpt TEXT,
    owner TEXT,
    evidence_title TEXT,
    evidence_text TEXT,
    status TEXT NOT NULL DEFAULT 'gap',
    confidence INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  );
  CREATE INDEX IF NOT EXISTS idx_rfp_requirements_rfp ON rfp_requirements(rfp_id);
  CREATE TABLE IF NOT EXISTS rfp_ai_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rfp_id INTEGER NOT NULL REFERENCES rfps(id),
    account_id INTEGER NOT NULL REFERENCES accounts(id),
    action TEXT NOT NULL,
    model TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'completed',
    result_json TEXT NOT NULL,
    source_ids_json TEXT NOT NULL,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  );
  CREATE INDEX IF NOT EXISTS idx_rfp_ai_runs_latest ON rfp_ai_runs(account_id, rfp_id, created_at DESC);
  CREATE TABLE IF NOT EXISTS company_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id),
    title TEXT NOT NULL,
    source_type TEXT NOT NULL DEFAULT 'note',
    source_url TEXT,
    content TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'verified',
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  );
  CREATE INDEX IF NOT EXISTS idx_company_sources_account ON company_sources(account_id, updated_at DESC);
`);

// Backfill columns added after initial release (idempotent).
function ensureColumn(table: string, column: string, ddl: string) {
  const cols = sqlite.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === column)) {
    sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}
ensureColumn("profiles", "logo_data_url", "logo_data_url TEXT");
ensureColumn("profiles", "scan_preset", "scan_preset TEXT NOT NULL DEFAULT 'custom'");
ensureColumn("profiles", "scan_keywords", "scan_keywords TEXT NOT NULL DEFAULT ''");
ensureColumn(
  "profiles",
  "scan_sources",
  "scan_sources TEXT NOT NULL DEFAULT 'sam,caleprocure,bidnet,highergov'"
);
ensureColumn("profiles", "last_scan_at", "last_scan_at TEXT");
ensureColumn("profiles", "last_scan_count", "last_scan_count INTEGER NOT NULL DEFAULT 0");
ensureColumn("profiles", "weight_fit", "weight_fit INTEGER NOT NULL DEFAULT 30");
ensureColumn("profiles", "weight_win", "weight_win INTEGER NOT NULL DEFAULT 30");
ensureColumn("profiles", "weight_effort", "weight_effort INTEGER NOT NULL DEFAULT 20");
ensureColumn("profiles", "weight_value", "weight_value INTEGER NOT NULL DEFAULT 20");
ensureColumn("rfps", "score_fit", "score_fit INTEGER NOT NULL DEFAULT 3");
ensureColumn("rfps", "score_win", "score_win INTEGER NOT NULL DEFAULT 3");
ensureColumn("rfps", "score_effort", "score_effort INTEGER NOT NULL DEFAULT 3");
ensureColumn("rfps", "score_value", "score_value INTEGER NOT NULL DEFAULT 3");
ensureColumn("rfps", "priority_override", "priority_override INTEGER");
ensureColumn("profiles", "tracking_prefix", "tracking_prefix TEXT NOT NULL DEFAULT 'RFP'");
ensureColumn("profiles", "tracking_counter", "tracking_counter INTEGER NOT NULL DEFAULT 0");
ensureColumn("rfps", "tracking_id", "tracking_id TEXT");

// One-time backfill: assign tracking IDs to any existing RFP rows that don't have one.
// Also auto-derive a sensible prefix from the account's company_name when the profile
// still has the default "RFP" prefix (i.e., it was created before prefix support).
function backfillTrackingIds() {
  try {
    const accountIds = sqlite
      .prepare(`SELECT DISTINCT account_id FROM rfps WHERE tracking_id IS NULL OR tracking_id = ''`)
      .all() as Array<{ account_id: number }>;
    for (const { account_id } of accountIds) {
      // Look up the profile + account so we can derive a reasonable prefix.
      const acct = sqlite
        .prepare(`SELECT company_name FROM accounts WHERE id = ?`)
        .get(account_id) as { company_name?: string } | undefined;
      const prof = sqlite
        .prepare(`SELECT tracking_prefix, tracking_counter FROM profiles WHERE account_id = ?`)
        .get(account_id) as { tracking_prefix?: string; tracking_counter?: number } | undefined;
      let prefix = (prof?.tracking_prefix || "").toUpperCase();
      // If the profile is still on the default "RFP" or empty, derive from company name.
      if (!prefix || prefix === "RFP") {
        const name = (acct?.company_name || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
        if (name.length >= 2) prefix = name.slice(0, 3);
        else prefix = prefix || "RFP";
      }
      let counter = prof?.tracking_counter ?? 0;
      const pendingRows = sqlite
        .prepare(
          `SELECT id FROM rfps WHERE account_id = ? AND (tracking_id IS NULL OR tracking_id = '') ORDER BY id ASC`,
        )
        .all(account_id) as Array<{ id: number }>;
      const updateRfp = sqlite.prepare(`UPDATE rfps SET tracking_id = ? WHERE id = ?`);
      const tx = sqlite.transaction((rows: Array<{ id: number }>) => {
        for (const row of rows) {
          counter += 1;
          const id = `${prefix}-${String(counter).padStart(4, "0")}`;
          updateRfp.run(id, row.id);
        }
      });
      tx(pendingRows);
      // Persist the new prefix and counter on the profile.
      sqlite
        .prepare(
          `UPDATE profiles SET tracking_prefix = ?, tracking_counter = ? WHERE account_id = ?`,
        )
        .run(prefix, counter, account_id);
    }
  } catch (err) {
    // Don't crash the app over backfill — just log it.
    console.warn("[backfillTrackingIds] skipped:", (err as Error).message);
  }
}
backfillTrackingIds();

export type ProposalSections = {
  executiveSummary?: string | null;
  companyOverview?: string | null;
  understanding?: string | null;
  technicalApproach?: string | null;
  pastPerformance?: string | null;
  pricingApproach?: string | null;
  timeline?: string | null;
  conclusion?: string | null;
};

export type RfpCommentMeta = { commentCount: number; unreadCount: number };

export type CreateAiRun = {
  action: string;
  model: string;
  status?: string;
  resultJson: string;
  sourceIdsJson: string;
  inputTokens: number;
  outputTokens: number;
};

export interface IStorage {
  // accounts
  getAccountByEmail(email: string): Account | undefined;
  getAccount(id: number): Account | undefined;
  createAccount(data: { email: string; passwordHash: string; companyName: string }): Account;
  updatePassword(id: number, passwordHash: string): void;
  // profile
  getProfile(accountId: number): Profile | undefined;
  upsertProfile(accountId: number, data: Omit<InsertProfile, "accountId">): Profile;
  // company evidence library
  listCompanySources(accountId: number): CompanySource[];
  createCompanySource(accountId: number, data: InsertCompanySource): CompanySource;
  deleteCompanySource(accountId: number, id: number): boolean;
  // rfps
  listRfps(accountId: number): Rfp[];
  getRfp(accountId: number, id: number): Rfp | undefined;
  createRfp(accountId: number, data: InsertRfp): Rfp;
  updateRfp(accountId: number, id: number, data: Partial<InsertRfp>): Rfp | undefined;
  deleteRfp(accountId: number, id: number): boolean;
  markRfpDownloaded(accountId: number, id: number): Rfp | undefined;
  // proposals
  getProposal(accountId: number, rfpId: number): Proposal | undefined;
  upsertProposal(accountId: number, rfpId: number, sections: ProposalSections): Proposal | undefined;
  // comments (Team Notes)
  listRfpComments(accountId: number, rfpId: number): RfpComment[];
  addRfpComment(accountId: number, rfpId: number, authorEmail: string, body: string): RfpComment | undefined;
  markRfpCommentsRead(accountId: number, rfpId: number): void;
  getCommentMetaMap(accountId: number): Map<number, RfpCommentMeta>;
  // compliance requirements
  listRequirements(accountId: number, rfpId: number): RfpRequirement[];
  createRequirement(accountId: number, rfpId: number, data: InsertRfpRequirement): RfpRequirement | undefined;
  updateRequirement(accountId: number, rfpId: number, id: number, data: Partial<InsertRfpRequirement>): RfpRequirement | undefined;
  deleteRequirement(accountId: number, rfpId: number, id: number): boolean;
  // grounded AI audit trail
  getLatestAiRun(accountId: number, rfpId: number): RfpAiRun | undefined;
  countAiRunsSince(accountId: number, since: Date): number;
  createAiRun(accountId: number, rfpId: number, data: CreateAiRun): RfpAiRun | undefined;
}

export class DatabaseStorage implements IStorage {
  // ---------- Accounts ----------
  getAccountByEmail(email: string) {
    return db.select().from(accounts).where(eq(accounts.email, email)).get();
  }
  getAccount(id: number) {
    return db.select().from(accounts).where(eq(accounts.id, id)).get();
  }
  createAccount(data: { email: string; passwordHash: string; companyName: string }) {
    return db
      .insert(accounts)
      .values({
        email: data.email,
        passwordHash: data.passwordHash,
        companyName: data.companyName,
      })
      .returning()
      .get();
  }
  updatePassword(id: number, passwordHash: string) {
    db.update(accounts).set({ passwordHash }).where(eq(accounts.id, id)).run();
  }

  // ---------- Profile ----------
  getProfile(accountId: number) {
    return db.select().from(profiles).where(eq(profiles.accountId, accountId)).get();
  }
  upsertProfile(accountId: number, data: Omit<InsertProfile, "accountId">) {
    const existing = this.getProfile(accountId);
    if (existing) {
      return db
        .update(profiles)
        .set({ ...data })
        .where(eq(profiles.accountId, accountId))
        .returning()
        .get();
    }
    return db
      .insert(profiles)
      .values({ accountId, ...data })
      .returning()
      .get();
  }

  // ---------- Company evidence library ----------
  listCompanySources(accountId: number) {
    return db.select().from(companySources).where(eq(companySources.accountId, accountId)).orderBy(desc(companySources.updatedAt)).all();
  }
  createCompanySource(accountId: number, data: InsertCompanySource) {
    return db.insert(companySources).values({ ...data, accountId, updatedAt: new Date() }).returning().get();
  }
  deleteCompanySource(accountId: number, id: number) {
    const result = db.delete(companySources).where(and(eq(companySources.id, id), eq(companySources.accountId, accountId))).run();
    return result.changes > 0;
  }

  // ---------- RFPs ----------
  listRfps(accountId: number) {
    return db.select().from(rfps).where(eq(rfps.accountId, accountId)).all();
  }
  getRfp(accountId: number, id: number) {
    return db
      .select()
      .from(rfps)
      .where(and(eq(rfps.accountId, accountId), eq(rfps.id, id)))
      .get();
  }
  createRfp(accountId: number, data: InsertRfp) {
    // Auto-assign tracking ID using profile prefix + counter
    let trackingId = data.trackingId ?? null;
    if (!trackingId) {
      const profile = this.getProfile(accountId);
      if (profile) {
        const prefix = (profile.trackingPrefix || "RFP").toUpperCase();
        const next = (profile.trackingCounter ?? 0) + 1;
        trackingId = `${prefix}-${String(next).padStart(4, "0")}`;
        db.update(profiles)
          .set({ trackingCounter: next })
          .where(eq(profiles.accountId, accountId))
          .run();
      }
    }
    return db
      .insert(rfps)
      .values({ ...data, accountId, trackingId })
      .returning()
      .get();
  }
  updateRfp(accountId: number, id: number, data: Partial<InsertRfp>) {
    const existing = this.getRfp(accountId, id);
    if (!existing) return undefined;
    return db
      .update(rfps)
      .set({ ...data })
      .where(and(eq(rfps.accountId, accountId), eq(rfps.id, id)))
      .returning()
      .get();
  }
  deleteRfp(accountId: number, id: number) {
    const existing = this.getRfp(accountId, id);
    if (!existing) return false;
    // remove proposal first (FK)
    db.delete(proposals).where(eq(proposals.rfpId, id)).run();
    db.delete(rfpRequirements).where(eq(rfpRequirements.rfpId, id)).run();
    db.delete(rfpAiRuns).where(eq(rfpAiRuns.rfpId, id)).run();
    db.delete(rfps).where(and(eq(rfps.accountId, accountId), eq(rfps.id, id))).run();
    return true;
  }
  markRfpDownloaded(accountId: number, id: number) {
    const rfp = this.getRfp(accountId, id);
    if (!rfp) return undefined;
    return db
      .update(rfps)
      .set({ status: "downloaded" })
      .where(and(eq(rfps.accountId, accountId), eq(rfps.id, id)))
      .returning()
      .get();
  }

  // ---------- Comments (Team Notes) ----------
  listRfpComments(accountId: number, rfpId: number) {
    const rfp = this.getRfp(accountId, rfpId);
    if (!rfp) return [];
    return db
      .select()
      .from(rfpComments)
      .where(eq(rfpComments.rfpId, rfpId))
      .orderBy(desc(rfpComments.createdAt))
      .all();
  }
  addRfpComment(accountId: number, rfpId: number, authorEmail: string, body: string) {
    const rfp = this.getRfp(accountId, rfpId);
    if (!rfp) return undefined;
    const trimmed = body.trim();
    if (!trimmed) return undefined;
    const inserted = db
      .insert(rfpComments)
      .values({ rfpId, accountId, authorEmail, body: trimmed })
      .returning()
      .get();
    // Posting your own comment counts as having read your own comment.
    this.markRfpCommentsRead(accountId, rfpId);
    return inserted;
  }
  markRfpCommentsRead(accountId: number, rfpId: number) {
    const rfp = this.getRfp(accountId, rfpId);
    if (!rfp) return;
    const now = new Date();
    const existing = db
      .select()
      .from(rfpCommentReads)
      .where(
        and(
          eq(rfpCommentReads.accountId, accountId),
          eq(rfpCommentReads.rfpId, rfpId),
        ),
      )
      .get();
    if (existing) {
      db.update(rfpCommentReads)
        .set({ lastReadAt: now })
        .where(eq(rfpCommentReads.id, existing.id))
        .run();
    } else {
      db.insert(rfpCommentReads)
        .values({ accountId, rfpId, lastReadAt: now })
        .run();
    }
  }
  getCommentMetaMap(accountId: number) {
    // Single query that returns per-RFP total + unread (for this account).
    // Unread = comments by other authors that were created after this account's last_read_at.
    const rows = sqlite
      .prepare(
        `SELECT
           r.id AS rfp_id,
           COUNT(c.id) AS total,
           SUM(
             CASE
               WHEN c.id IS NULL THEN 0
               WHEN c.account_id = ? THEN 0
               WHEN cr.last_read_at IS NULL THEN 1
               WHEN c.created_at > cr.last_read_at THEN 1
               ELSE 0
             END
           ) AS unread
         FROM rfps r
         LEFT JOIN rfp_comments c ON c.rfp_id = r.id
         LEFT JOIN rfp_comment_reads cr
           ON cr.rfp_id = r.id AND cr.account_id = ?
         WHERE r.account_id = ?
         GROUP BY r.id`,
      )
      .all(accountId, accountId, accountId) as Array<{ rfp_id: number; total: number | null; unread: number | null }>;
    const map = new Map<number, RfpCommentMeta>();
    for (const row of rows) {
      map.set(row.rfp_id, {
        commentCount: Number(row.total ?? 0),
        unreadCount: Number(row.unread ?? 0),
      });
    }
    return map;
  }

  // ---------- Compliance requirements ----------
  listRequirements(accountId: number, rfpId: number) {
    if (!this.getRfp(accountId, rfpId)) return [];
    return db
      .select()
      .from(rfpRequirements)
      .where(and(eq(rfpRequirements.accountId, accountId), eq(rfpRequirements.rfpId, rfpId)))
      .all();
  }
  createRequirement(accountId: number, rfpId: number, data: InsertRfpRequirement) {
    if (!this.getRfp(accountId, rfpId)) return undefined;
    return db.insert(rfpRequirements).values({ ...data, accountId, rfpId }).returning().get();
  }
  updateRequirement(accountId: number, rfpId: number, id: number, data: Partial<InsertRfpRequirement>) {
    const existing = db
      .select()
      .from(rfpRequirements)
      .where(
        and(
          eq(rfpRequirements.id, id),
          eq(rfpRequirements.rfpId, rfpId),
          eq(rfpRequirements.accountId, accountId),
        ),
      )
      .get();
    if (!existing) return undefined;
    return db
      .update(rfpRequirements)
      .set(data)
      .where(eq(rfpRequirements.id, id))
      .returning()
      .get();
  }
  deleteRequirement(accountId: number, rfpId: number, id: number) {
    const existing = db
      .select()
      .from(rfpRequirements)
      .where(
        and(
          eq(rfpRequirements.id, id),
          eq(rfpRequirements.rfpId, rfpId),
          eq(rfpRequirements.accountId, accountId),
        ),
      )
      .get();
    if (!existing) return false;
    db.delete(rfpRequirements).where(eq(rfpRequirements.id, id)).run();
    return true;
  }

  // ---------- Grounded AI audit trail ----------
  getLatestAiRun(accountId: number, rfpId: number) {
    if (!this.getRfp(accountId, rfpId)) return undefined;
    return db
      .select()
      .from(rfpAiRuns)
      .where(and(eq(rfpAiRuns.accountId, accountId), eq(rfpAiRuns.rfpId, rfpId)))
      .orderBy(desc(rfpAiRuns.createdAt))
      .get();
  }
  countAiRunsSince(accountId: number, since: Date) {
    const row = sqlite
      .prepare("SELECT COUNT(*) AS count FROM rfp_ai_runs WHERE account_id = ? AND created_at >= ?")
      .get(accountId, Math.floor(since.getTime() / 1000)) as { count: number };
    return Number(row.count ?? 0);
  }
  createAiRun(accountId: number, rfpId: number, data: CreateAiRun) {
    if (!this.getRfp(accountId, rfpId)) return undefined;
    return db
      .insert(rfpAiRuns)
      .values({ accountId, rfpId, ...data })
      .returning()
      .get();
  }

  // ---------- Proposals ----------
  getProposal(accountId: number, rfpId: number) {
    const rfp = this.getRfp(accountId, rfpId);
    if (!rfp) return undefined;
    return db.select().from(proposals).where(eq(proposals.rfpId, rfpId)).get();
  }
  upsertProposal(accountId: number, rfpId: number, sections: ProposalSections) {
    const rfp = this.getRfp(accountId, rfpId);
    if (!rfp) return undefined;
    const existing = db.select().from(proposals).where(eq(proposals.rfpId, rfpId)).get();
    const now = new Date();
    if (existing) {
      return db
        .update(proposals)
        .set({ ...sections, updatedAt: now })
        .where(eq(proposals.rfpId, rfpId))
        .returning()
        .get();
    }
    return db
      .insert(proposals)
      .values({ rfpId, ...sections, updatedAt: now })
      .returning()
      .get();
  }
}

export const storage = new DatabaseStorage();

import jsPDF from "jspdf";
import type { Rfp, Profile } from "@shared/schema";
import type { AuthAccount } from "./auth";
import { SEVEN_RFP_LOGO_DATA_URL } from "./brand-logo";

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

const SECTION_LIST: { key: keyof ProposalSections; title: string }[] = [
  { key: "executiveSummary", title: "Executive Summary" },
  { key: "companyOverview", title: "Company Overview" },
  { key: "understanding", title: "Understanding of Requirements" },
  { key: "technicalApproach", title: "Technical Approach" },
  { key: "pastPerformance", title: "Past Performance" },
  { key: "pricingApproach", title: "Pricing Approach" },
  { key: "timeline", title: "Implementation Timeline" },
  { key: "conclusion", title: "Conclusion" },
];

function slug(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "untitled";
}

function fmtDate(d: Date) {
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

// Resolve a logo data URL to its natural dimensions and detected jsPDF format.
// Returns null when the format isn't supported (e.g. SVG, which jsPDF can't embed natively).
async function loadLogoMeta(
  dataUrl: string
): Promise<{ format: "PNG" | "JPEG"; width: number; height: number } | null> {
  const lower = dataUrl.slice(0, 30).toLowerCase();
  let format: "PNG" | "JPEG";
  if (lower.startsWith("data:image/png")) format = "PNG";
  else if (lower.startsWith("data:image/jpeg") || lower.startsWith("data:image/jpg")) format = "JPEG";
  else {
    console.warn("[7RFP] PDF: unsupported logo format (expected PNG or JPEG); skipping logo.");
    return null;
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () =>
      resolve({ format, width: img.naturalWidth || 400, height: img.naturalHeight || 100 });
    img.onerror = () => resolve({ format, width: 400, height: 100 });
    img.src = dataUrl;
  });
}

export async function generateProposalPdf(
  account: AuthAccount,
  rfp: Rfp,
  sections: ProposalSections,
  profile?: Profile | null
) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 64;
  const marginY = 72;
  const contentW = pageW - marginX * 2;
  const today = new Date();

  const presentSections = SECTION_LIST.filter((s) => {
    const v = sections[s.key];
    return v && v.toString().trim().length > 0;
  });

  // ---------- COVER PAGE ----------
  // Top accent bar
  doc.setFillColor(31, 55, 99); // deep navy
  doc.rect(0, 0, pageW, 6, "F");

  // Logo (centered) — only when profile.logoDataUrl is a supported raster image.
  // Position ~25mm (≈ 71pt) from the top, max 60mm (≈ 170pt) wide / 25mm (≈ 70pt) tall.
  const LOGO_TOP = 71;
  const LOGO_MAX_W = 170;
  const LOGO_MAX_H = 70;
  let companyNameY = 200;
  const tenantLogoUrl = profile?.logoDataUrl;
  let tenantLogoEmbedded = false;
  if (tenantLogoUrl && tenantLogoUrl.length > 0) {
    const meta = await loadLogoMeta(tenantLogoUrl);
    if (meta) {
      const ratio = meta.width / meta.height;
      let drawW = LOGO_MAX_W;
      let drawH = drawW / ratio;
      if (drawH > LOGO_MAX_H) {
        drawH = LOGO_MAX_H;
        drawW = drawH * ratio;
      }
      const drawX = (pageW - drawW) / 2;
      try {
        doc.addImage(tenantLogoUrl, meta.format, drawX, LOGO_TOP, drawW, drawH, undefined, "FAST");
        // Push the company-name block below the logo with a small gap.
        companyNameY = Math.max(companyNameY, LOGO_TOP + drawH + 32);
        tenantLogoEmbedded = true;
      } catch (err) {
        console.warn("[7RFP] PDF: failed to embed logo, continuing without it.", err);
      }
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.setTextColor(20, 30, 50);
  doc.text(account.companyName, marginX, companyNameY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(110, 110, 120);
  doc.text("PROPOSAL", marginX, companyNameY + 24, { charSpace: 2 });

  // Divider
  doc.setDrawColor(220, 222, 230);
  doc.setLineWidth(0.5);
  doc.line(marginX, companyNameY + 44, pageW - marginX, companyNameY + 44);

  // RFP title (wrapped)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(20, 30, 50);
  const titleLines = doc.splitTextToSize(rfp.title, contentW);
  const titleY = companyNameY + 90;
  doc.text(titleLines, marginX, titleY);

  let coverY = titleY + titleLines.length * 22 + 20;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(80, 90, 110);
  if (rfp.agency) {
    doc.text(`Issued by: ${rfp.agency}`, marginX, coverY);
    coverY += 18;
  }
  doc.text(`Submitted: ${fmtDate(today)}`, marginX, coverY);
  coverY += 16;
  if (rfp.dueDateText) {
    doc.text(`Due: ${rfp.dueDateText}`, marginX, coverY);
    coverY += 16;
  }
  if (rfp.valueText) {
    doc.text(`Estimated value: ${rfp.valueText}`, marginX, coverY);
    coverY += 16;
  }

  // Subtle 7RFP branding at the bottom of the cover.
  // - If the tenant did NOT upload their own logo, embed the 7RFP brand mark
  //   centered above a small "Generated with 7RFP" caption.
  // - If the tenant DID upload a logo, just keep the text caption (no second mark).
  if (!tenantLogoEmbedded) {
    try {
      const brandMeta = await loadLogoMeta(SEVEN_RFP_LOGO_DATA_URL);
      if (brandMeta) {
        const brandW = 71; // ~25mm
        const brandH = brandW / (brandMeta.width / brandMeta.height);
        const brandX = (pageW - brandW) / 2;
        const brandY = pageH - 90 - brandH;
        doc.addImage(
          SEVEN_RFP_LOGO_DATA_URL,
          "PNG",
          brandX,
          brandY,
          brandW,
          brandH,
          undefined,
          "FAST"
        );
      }
    } catch (err) {
      console.warn("[7RFP] PDF: failed to embed brand watermark.", err);
    }
  }
  doc.setFontSize(9);
  doc.setTextColor(150, 155, 165);
  const caption = "Generated with 7RFP";
  const captionWidth = doc.getTextWidth(caption);
  doc.text(caption, (pageW - captionWidth) / 2, pageH - 60);

  // ---------- TABLE OF CONTENTS ----------
  doc.addPage();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(20, 30, 50);
  doc.text("Table of Contents", marginX, marginY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(60, 65, 80);
  let tocY = marginY + 36;
  presentSections.forEach((s, i) => {
    doc.text(`${i + 1}. ${s.title}`, marginX, tocY);
    tocY += 22;
  });

  // ---------- BODY SECTIONS ----------
  for (const s of presentSections) {
    doc.addPage();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(20, 30, 50);
    doc.text(s.title, marginX, marginY);

    doc.setFont("times", "normal");
    doc.setFontSize(11);
    doc.setTextColor(40, 45, 60);

    const text = (sections[s.key] || "").toString();
    const paragraphs = text.split(/\n+/).filter((p) => p.trim().length > 0);
    let y = marginY + 28;
    const lineHeight = 16;
    const bottomLimit = pageH - marginY;

    for (const para of paragraphs) {
      const wrapped = doc.splitTextToSize(para, contentW);
      for (const line of wrapped) {
        if (y > bottomLimit) {
          doc.addPage();
          doc.setFont("times", "normal");
          doc.setFontSize(11);
          doc.setTextColor(40, 45, 60);
          y = marginY;
        }
        doc.text(line, marginX, y);
        y += lineHeight;
      }
      y += 6; // paragraph break
    }
  }

  // ---------- PAGE NUMBERS (footer) ----------
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(150, 155, 165);
    doc.text(`Page ${p} of ${pageCount}`, pageW - marginX, pageH - 36, { align: "right" });
    if (p > 1) {
      doc.text(account.companyName, marginX, pageH - 36);
    }
  }

  const fileName = `7RFP_${slug(account.companyName)}_${slug(rfp.title)}_${ymd(today)}.pdf`;
  doc.save(fileName);
  return fileName;
}


import type { Profile, Rfp } from "@shared/schema";

const FALLBACK = (label: string) =>
  `[Add ${label} in your Company Profile to make this section stronger.]`;

const norm = (s?: string | null) => (s && s.trim().length ? s.trim() : "");

export function generateDraftSections(profile: Profile | undefined, rfp: Rfp, companyName?: string) {
  const company = norm(companyName) || "Our team";
  const overview = norm(profile?.overview) || FALLBACK("a company overview");
  const capabilities = norm(profile?.capabilities) || FALLBACK("your capabilities");
  const past = norm(profile?.pastPerformance) || FALLBACK("past performance examples");
  const personnel = norm(profile?.keyPersonnel) || FALLBACK("key personnel");
  const pricing = norm(profile?.pricingApproach) || FALLBACK("a pricing approach");
  const certs = norm(profile?.certifications) || FALLBACK("certifications");
  const diff = norm(profile?.differentiators) || FALLBACK("differentiators");

  const title = rfp.title;
  const agency = rfp.agency || "the issuing agency";
  const due = rfp.dueDateText || "the stated due date";
  const rec = rfp.recommendation || "GO — Pursue";
  const tail = `\n\n[Customize this section based on the specific RFP requirements]`;

  const executiveSummary =
    `${company} is pleased to submit this proposal in response to "${title}" issued by ${agency}. ` +
    `This opportunity is currently classified as "${rec}" and the response is due ${due}. ` +
    `${overview} ` +
    `Our approach combines deep mission understanding with proven delivery practices, allowing us to ` +
    `meet the agency's stated objectives while controlling risk and cost. The sections that follow ` +
    `describe our company, our understanding of the requirement, our technical approach, relevant past ` +
    `performance, pricing approach, and an implementation timeline. We believe the strengths summarized ` +
    `here — ${diff} — translate directly into measurable outcomes for ${agency}.` +
    tail;

  const companyOverview =
    `${overview}\n\n` +
    `Our core capabilities relevant to this engagement include: ${capabilities}. ` +
    `Where applicable, we hold the following certifications and accreditations: ${certs}. ` +
    `Key personnel positioned for this effort: ${personnel}. ` +
    `What separates us in this market: ${diff}. ` +
    `We will commit a dedicated delivery team to "${title}" and align governance with ${agency}'s ` +
    `program management expectations from kickoff through closeout.` +
    tail;

  const understanding =
    `${agency} is seeking a partner that can execute "${title}" with rigor, transparency, and on-time ` +
    `delivery. Based on our review of the solicitation, we understand the agency's priorities to include ` +
    `compliance with stated requirements, demonstrated past performance on similar work, a credible ` +
    `staffing plan, and a defensible pricing approach. We have noted the submission deadline of ${due} ` +
    `and have built our internal schedule to support a final quality review well in advance. ` +
    `Use the Compliance workspace to confirm every mandatory requirement, assign an owner, and attach ` +
    `supporting evidence before submission.` +
    tail;

  const technicalApproach =
    `Our technical approach for "${title}" is built on the capabilities we apply across every engagement: ` +
    `${capabilities}. ` +
    `[Confirm mobilization timing, delivery cadence, risk controls, and quality gates against the solicitation.] ` +
    `This approach reflects how ${diff}.` +
    tail;

  const pastPerformanceText =
    `${company} brings directly relevant past performance to "${title}". Highlights include:\n\n` +
    `${past}\n\n` +
    `Across these engagements we have demonstrated the same disciplines we propose to apply for ${agency}: ` +
    `compliant delivery, transparent reporting, and a focus on outcomes over activity. ` +
    `[Verify reference availability, customer approval, dates, values, and measurable outcomes.]` +
    tail;

  const pricingApproachText =
    `Our pricing approach for this opportunity reflects ${pricing}. ` +
    `We have built the cost narrative around the work breakdown described in our technical approach, ` +
    `ensuring every dollar is traceable to a specific deliverable for ${agency}. ` +
    `[Confirm labor categories, rates, contract type, assumptions, and cost controls before submission.]` +
    tail;

  const timeline =
    `Upon award, we will execute the following phased timeline for "${title}":\n\n` +
    `• Week 1 — Mobilization, kickoff with ${agency}, and finalization of the project management plan.\n` +
    `• Weeks 2-4 — Discovery, requirements confirmation, and baseline schedule.\n` +
    `• Weeks 5-12 — Iterative delivery against the agreed work breakdown, with biweekly status reviews.\n` +
    `• Final phase — Acceptance testing, transition planning, and formal closeout.\n\n` +
    `This schedule is designed to align with the submission deadline of ${due} and any period-of-performance ` +
    `constraints in the solicitation.` +
    tail;

  const conclusion =
    `${company} is committed to delivering "${title}" on schedule, on budget, and in full compliance with ` +
    `${agency}'s requirements. Our current recommendation classification is "${rec}". ` +
    `[Confirm authorized commitments, start date, and final compliance status.] We look forward to demonstrating the ` +
    `outcomes summarized in this proposal. Thank you for the opportunity to respond to this solicitation.` +
    tail;

  return {
    executiveSummary,
    companyOverview,
    understanding,
    technicalApproach,
    pastPerformance: pastPerformanceText,
    pricingApproach: pricingApproachText,
    timeline,
    conclusion,
  };
}

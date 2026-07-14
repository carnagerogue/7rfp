import assert from "node:assert/strict";
import test from "node:test";
import { buildGroundedSources, validateGroundedResult } from "./pursuit-intelligence";

const rfp = {
  id: 1, accountId: 1, title: "Secure learning platform", agency: "Example Agency",
  dueDateText: null, valueText: null, url: null, recommendation: null, status: "new",
  notes: null, scoreFit: 3, scoreWin: 3, scoreEffort: 3, scoreValue: 3,
  priorityOverride: null, trackingId: "EXA-0001", createdAt: new Date(),
};

test("builds an isolated source envelope from pursuit data", () => {
  const sources = buildGroundedSources(rfp, undefined, [{
    id: 4, rfpId: 1, accountId: 1, requirementText: "The contractor must encrypt data.",
    sourceRef: "Section C.2", sourceExcerpt: null, owner: null, evidenceTitle: "Security plan",
    evidenceText: "Our approved encryption standard.", status: "covered", confidence: 80, createdAt: new Date(),
  }]);
  assert.deepEqual(sources.map((source) => source.id), ["RFP-METADATA", "REQ-4", "EVID-4"]);
});

test("adds only saved company-library sources to the pursuit envelope", () => {
  const sources = buildGroundedSources(rfp, undefined, [], [{
    id: 9, accountId: 1, title: "Approved product brief", sourceType: "product",
    sourceUrl: "https://example.test/brief", content: "Verified product capability detail.",
    status: "verified", createdAt: new Date(), updatedAt: new Date(),
  }]);
  assert.deepEqual(sources.map((source) => source.id), ["RFP-METADATA", "COMPANY-9"]);
  assert.match(sources[1].text, /Verified product capability detail/);
});

test("rejects results that cite a source outside the current pursuit", () => {
  assert.throws(() => validateGroundedResult({
    headline: "Risk review", summary: "Source-backed assessment with enough detail.",
    winThemes: [{ text: "Grounded theme", sourceIds: ["OTHER-TENANT"] }],
    complianceRisks: [], questions: [], redTeamFindings: [], draft: "",
  }, [{ id: "REQ-4", label: "Section C.2", text: "Encrypt data" }]), /invalid source citation/);
});

test("accepts cited analysis using only supplied sources", () => {
  const result = validateGroundedResult({
    headline: "Security fit", summary: "The supplied security evidence aligns with the stated requirement.",
    winThemes: [{ text: "Approved encryption evidence supports response positioning.", sourceIds: ["REQ-4", "EVID-4"] }],
    complianceRisks: [], questions: [], redTeamFindings: [], draft: "",
  }, [{ id: "REQ-4", label: "Section C.2", text: "Encrypt data" }, { id: "EVID-4", label: "Security plan", text: "Approved standard" }]);
  assert.equal(result.winThemes[0].sourceIds.length, 2);
});

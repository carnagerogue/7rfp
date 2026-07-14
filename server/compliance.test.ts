import assert from "node:assert/strict";
import test from "node:test";
import { extractRequirements } from "./compliance";

test("extracts mandatory clauses and ignores narrative filler", () => {
  const result = extractRequirements(`
Section 2.1 The offeror shall provide a transition plan within ten days.
This paragraph describes the agency background and general mission.
Section 4.2 Responses must include three customer references.
The contractor is required to encrypt data at rest.
  `);

  assert.equal(result.length, 3);
  assert.match(result[0].requirementText, /shall provide/i);
  assert.equal(result[0].status, "gap");
  assert.equal(result[0].confidence, 85);
});

test("deduplicates repeated clauses", () => {
  const result = extractRequirements(`
The vendor must submit a staffing plan.
The vendor must submit a staffing plan.
  `);

  assert.equal(result.length, 1);
});

test("returns no invented requirements when source text has none", () => {
  const result = extractRequirements("Agency background and market context only.");
  assert.deepEqual(result, []);
});

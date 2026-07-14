import assert from "node:assert/strict";
import test from "node:test";
import { extractDiscoveryHits, parseDiscoveredOpportunities } from "./scan";

test("keeps only unique URL-backed Claude web-search hits", () => {
  const hits = extractDiscoveryHits({ content: [
    { type: "text", content: [] },
    { type: "web_search_tool_result", content: [
      { title: "Open procurement", url: "https://sam.gov/opp/123", content: "Open through Friday" },
      { title: "Duplicate", url: "https://sam.gov/opp/123", content: "Duplicate" },
      { title: "No URL", content: "Ignore" },
    ] },
  ] });
  assert.deepEqual(hits, [{
    title: "Open procurement", url: "https://sam.gov/opp/123", snippet: "Open through Friday",
  }]);
});

test("parseDiscoveredOpportunities extracts structured fields from the model's JSON", () => {
  const payload = {
    content: [
      { type: "web_search_tool_result", content: [] },
      {
        type: "text",
        text:
          'Here are the results:\n```json\n{"opportunities":[{"title":"Inmate Education Tablet RFP",' +
          '"agency":"California Dept. of Corrections","url":"https://sam.gov/opp/abc",' +
          '"dueDate":"June 15, 2026","value":"$5M","summary":"Statewide tablet program."}]}\n```',
      },
    ],
  };
  const opps = parseDiscoveredOpportunities(payload);
  assert.equal(opps.length, 1);
  assert.equal(opps[0].agency, "California Dept. of Corrections");
  assert.equal(opps[0].dueDate, "June 15, 2026");
  assert.equal(opps[0].value, "$5M");
  assert.equal(opps[0].url, "https://sam.gov/opp/abc");
});

test("parseDiscoveredOpportunities de-dupes by URL and drops invalid rows", () => {
  const payload = {
    content: [
      {
        type: "text",
        text:
          '{"opportunities":[' +
          '{"title":"A valid solicitation","url":"https://bidnetdirect.com/x"},' +
          '{"title":"Same url again","url":"https://bidnetdirect.com/x"},' +
          '{"title":"no url here"}]}',
      },
    ],
  };
  const opps = parseDiscoveredOpportunities(payload);
  assert.equal(opps.length, 1);
  assert.equal(opps[0].dueDate, "");
});

test("parseDiscoveredOpportunities returns [] when there is no JSON", () => {
  assert.deepEqual(parseDiscoveredOpportunities({ content: [{ type: "text", text: "no data" }] }), []);
});

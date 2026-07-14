import assert from "node:assert/strict";
import test from "node:test";
import { extractDiscoveryHits } from "./scan";

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

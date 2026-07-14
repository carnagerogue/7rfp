import assert from "node:assert/strict";
import test from "node:test";
import { parseSkillTarget, parseFrontmatter } from "./skill-ingestion";

test("parseSkillTarget: repo root + explicit skill name", () => {
  const target = parseSkillTarget("https://github.com/Nucleos-LMS/nucleos-agent-skills", "it1-nucleos-design");
  assert.equal(target.owner, "Nucleos-LMS");
  assert.equal(target.repo, "nucleos-agent-skills");
  assert.equal(target.path, "it1-nucleos-design");
  assert.equal(target.ref, undefined);
});

test("parseSkillTarget: tree URL carries ref and path", () => {
  const target = parseSkillTarget("https://github.com/acme/skills/tree/main/company-evidence");
  assert.equal(target.ref, "main");
  assert.equal(target.path, "company-evidence");
});

test("parseSkillTarget: blob URL resolves to the containing folder", () => {
  const target = parseSkillTarget("https://github.com/acme/skills/blob/main/company-evidence/SKILL.md");
  assert.equal(target.path, "company-evidence");
});

test("parseSkillTarget: parses a full `npx skills add … --skill …` command", () => {
  const target = parseSkillTarget(
    "npx skills add https://github.com/Nucleos-LMS/nucleos-agent-skills --skill it1-nucleos-design",
  );
  assert.equal(target.owner, "Nucleos-LMS");
  assert.equal(target.repo, "nucleos-agent-skills");
  assert.equal(target.path, "it1-nucleos-design");
});

test("parseSkillTarget: an explicit skill argument overrides the command's --skill", () => {
  const target = parseSkillTarget(
    "npx skills add https://github.com/acme/skills --skill alpha",
    "beta",
  );
  assert.equal(target.path, "beta");
});

test("parseSkillTarget: strips .git and rejects non-GitHub hosts", () => {
  assert.equal(parseSkillTarget("https://github.com/acme/skills.git").repo, "skills");
  assert.throws(() => parseSkillTarget("https://gitlab.com/acme/skills"), /github\.com/);
  assert.throws(() => parseSkillTarget("not a url"), /valid GitHub URL/);
});

test("parseFrontmatter: extracts name and description, keeps body", () => {
  const md = "---\nname: company-evidence\ndescription: Our capabilities and past performance.\n---\n\n# Overview\nBody text here.";
  const fm = parseFrontmatter(md);
  assert.equal(fm.name, "company-evidence");
  assert.equal(fm.description, "Our capabilities and past performance.");
  assert.match(fm.body, /# Overview/);
});

test("parseFrontmatter: missing frontmatter returns the whole document as body", () => {
  const fm = parseFrontmatter("Just content, no frontmatter.");
  assert.equal(fm.name, undefined);
  assert.equal(fm.description, undefined);
  assert.equal(fm.body, "Just content, no frontmatter.");
});

// Writes a short Markdown summary of test-results/junit.xml for the GitHub Actions run page.
// Usage: node scripts/ci-summary.mjs "<title>" >> "$GITHUB_STEP_SUMMARY"
import { existsSync, readFileSync } from 'node:fs';

const title = process.argv[2] ?? 'Playwright';
const file = 'test-results/junit.xml';
if (!existsSync(file)) {
  console.log(`### ${title}\n\nNo JUnit report found (the run may have failed before tests started).`);
  process.exit(0);
}

const xml = readFileSync(file, 'utf8');
const attr = (name) => Number(xml.match(new RegExp(`<testsuites[^>]*\\s${name}="(\\d+)"`))?.[1] ?? 0);
const tests = attr('tests');
const failures = attr('failures') + attr('errors');
const skipped = attr('skipped');
const passed = tests - failures - skipped;
const time = Number(xml.match(/<testsuites[^>]*\stime="([\d.]+)"/)?.[1] ?? 0);
// Known-defect tests are marked test.fail(); Playwright reports them as passed while the defect still exists.
const knownDefects = (xml.match(/<property name="fail"/g) ?? []).length;

const failed = [...xml.matchAll(/<testcase name="([^"]+)"[^>]*>\s*<failure/g)].map((m) => m[1]);

console.log(`### ${failures ? '❌' : '✅'} ${title}

| Tests | Passed | Failed | Skipped | Known defects tracked | Time |
|---:|---:|---:|---:|---:|---:|
| ${tests} | ${passed} | ${failures} | ${skipped} | ${knownDefects} | ${time.toFixed(1)}s |
${failed.length ? `\n**Failed:**\n${failed.map((f) => `- ${f}`).join('\n')}\n` : ''}
Download the HTML report and traces from the run's artifacts.
`);

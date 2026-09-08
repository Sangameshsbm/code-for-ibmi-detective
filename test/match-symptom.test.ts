/**
 * match-symptom.test.ts
 *
 * Tests for the match-symptom pipeline stage.
 * Loads mock diagnostic JSON for port449 and mapepire-hang scenarios.
 * Asserts matched=true and confidence_score >= confidence_hint for each.
 *
 * Run:  node --require ts-node/register test/match-symptom.test.ts
 */

import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';

// Adjust __dirname for ts-node execution from repo root
const FIXTURES = path.join(__dirname, 'fixtures');

// Import pipeline modules relative to src/
import { DiagnosticResult } from '../src/pipeline/collect-diagnostics';
import { matchSymptom, KnownIssue }      from '../src/pipeline/match-symptom';

interface TestScenario {
  name: string;
  fixtureFile: string;
  expectedIssueId: string;
  expectedConfidenceHint: number;
}

const scenarios: TestScenario[] = [
  {
    name:                   'port449 connection refused',
    fixtureFile:            'mock-extension-logs-port449.json',
    expectedIssueId:        'port449-connection-refused',
    expectedConfidenceHint: 78,
  },
  {
    name:                   'mapepire-hang post-upgrade',
    fixtureFile:            'mock-extension-logs-mapepire-hang.json',
    expectedIssueId:        'mapepire-hang-post-upgrade',
    expectedConfidenceHint: 75,
  },
];

let passed = 0;
let failed = 0;

function test(description: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ✔ ${description}`);
    passed++;
  } catch (err) {
    console.error(`  ✘ ${description}`);
    console.error(`    ${(err as Error).message}`);
    failed++;
  }
}

console.log('\nmatch-symptom tests\n');

for (const scenario of scenarios) {
  console.log(`Scenario: ${scenario.name}`);

  const raw        = fs.readFileSync(path.join(FIXTURES, scenario.fixtureFile), 'utf8');
  const diagnostic = JSON.parse(raw) as DiagnosticResult;
  const result     = matchSymptom(diagnostic);

  test('matched is true', () => {
    assert.strictEqual(result.matched, true, `Expected matched=true, got matched=${result.matched}`);
  });

  test(`confidence_score >= ${scenario.expectedConfidenceHint}`, () => {
    assert.ok(
      result.confidence_score >= scenario.expectedConfidenceHint,
      `Expected confidence_score >= ${scenario.expectedConfidenceHint}, got ${result.confidence_score}`,
    );
  });

  test('confidence_band is HIGH or MEDIUM', () => {
    assert.ok(
      result.confidence_band === 'HIGH' || result.confidence_band === 'MEDIUM',
      `Expected HIGH or MEDIUM, got ${result.confidence_band}`,
    );
  });

  test('issue is defined and has id', () => {
    assert.ok(result.issue, 'Expected result.issue to be defined');
    assert.ok((result.issue as KnownIssue).id, 'Expected issue.id to be defined');
  });

  test(`issue.id is "${scenario.expectedIssueId}"`, () => {
    assert.strictEqual(
      (result.issue as KnownIssue).id,
      scenario.expectedIssueId,
      `Expected issue.id="${scenario.expectedIssueId}", got "${(result.issue as KnownIssue).id}"`,
    );
  });

  console.log('');
}

console.log(`Results: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  process.exit(1);
}

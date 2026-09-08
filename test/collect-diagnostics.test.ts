/**
 * collect-diagnostics.test.ts
 *
 * Tests for the collect-diagnostics pipeline stage.
 * Runs collectDiagnostics in mock mode and asserts required fields are present.
 *
 * Run:  node --require ts-node/register test/collect-diagnostics.test.ts
 */

import * as assert from 'assert';
import { collectDiagnostics, DiagnosticResult } from '../src/pipeline/collect-diagnostics';

let passed = 0;
let failed = 0;

function test(description: string, fn: () => void | Promise<void>): Promise<void> {
  return Promise.resolve(fn())
    .then(() => {
      console.log(`  ✔ ${description}`);
      passed++;
    })
    .catch((err: unknown) => {
      console.error(`  ✘ ${description}`);
      console.error(`    ${(err as Error).message}`);
      failed++;
    });
}

function assertRequiredFields(result: DiagnosticResult, label: string): void {
  assert.ok(typeof result.extension_version === 'string', `${label}: extension_version must be string`);
  assert.ok(typeof result.vscode_version    === 'string', `${label}: vscode_version must be string`);
  assert.ok(typeof result.output_log        === 'string', `${label}: output_log must be string`);
  assert.ok(Array.isArray(result.error_summary),          `${label}: error_summary must be array`);
  assert.ok(typeof result.collected_at      === 'string', `${label}: collected_at must be string`);
  assert.ok(typeof result.collection_mode   === 'string', `${label}: collection_mode must be string`);
  assert.ok(typeof result.platform          === 'string', `${label}: platform must be string`);
}

async function runTests(): Promise<void> {
  console.log('\ncollect-diagnostics tests\n');

  // ── Scenario: port449 ─────────────────────────────────────────────────────
  console.log('Scenario: mock / port449');

  let port449Result: DiagnosticResult | undefined;

  await test('collectDiagnostics(true, "port449") resolves without error', async () => {
    port449Result = await collectDiagnostics(true, 'port449');
  });

  await test('port449: collection_mode is "mock"', () => {
    assert.strictEqual(port449Result?.collection_mode, 'mock');
  });

  await test('port449: required fields are present', () => {
    assertRequiredFields(port449Result!, 'port449');
  });

  await test('port449: error_summary contains at least one entry', () => {
    assert.ok(
      (port449Result?.error_summary?.length ?? 0) > 0,
      'Expected at least one error_summary entry',
    );
  });

  console.log('');

  // ── Scenario: 3239 / mapepire-hang ────────────────────────────────────────
  console.log('Scenario: mock / mapepire-hang (3239)');

  let mapepireResult: DiagnosticResult | undefined;

  await test('collectDiagnostics(true, "mapepire-hang") resolves without error', async () => {
    mapepireResult = await collectDiagnostics(true, 'mapepire-hang');
  });

  await test('mapepire-hang: collection_mode is "mock"', () => {
    assert.strictEqual(mapepireResult?.collection_mode, 'mock');
  });

  await test('mapepire-hang: required fields are present', () => {
    assertRequiredFields(mapepireResult!, 'mapepire-hang');
  });

  await test('mapepire-hang: error_summary contains MCH3601', () => {
    const hasMch = mapepireResult?.error_summary.some(line =>
      line.includes('MCH3601'),
    );
    assert.ok(hasMch, 'Expected error_summary to contain MCH3601 entry');
  });

  console.log('');

  // ── Scenario: unknown scenario → throws ───────────────────────────────────
  console.log('Scenario: unknown scenario throws');

  await test('collectDiagnostics(true, "unknown") throws with useful message', async () => {
    try {
      await collectDiagnostics(true, 'unknown-scenario');
      assert.fail('Expected an error to be thrown');
    } catch (err) {
      assert.ok(
        (err as Error).message.includes('Unknown scenario'),
        `Expected "Unknown scenario" in error, got: ${(err as Error).message}`,
      );
    }
  });

  console.log('');
  console.log(`Results: ${passed} passed, ${failed} failed\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});

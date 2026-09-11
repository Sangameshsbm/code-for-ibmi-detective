#!/usr/bin/env node
/**
 * collect-diagnostics.ts
 *
 * TypeScript port of collect-diagnostics.js.
 * Collects Code for IBM i extension diagnostic data from the local filesystem.
 * IDE-agnostic — works identically when called from Bob or VS Code (Copilot/Claude).
 * No IBM i connection required. No system queries. Extension-side data only.
 *
 * Mock mode (mock=true / IBM_I_MOCK=true):
 *   Returns pre-built mock extension log data.
 *   Scenario selected by scenario arg / IBM_I_MOCK_SCENARIO env var:
 *     "mapepire-hang" → test/fixtures/mock-extension-logs-mapepire-hang.json  (default)
 *     "port449"       → test/fixtures/mock-extension-logs-port449.json
 *
 * Live mode:
 *   Reads Code for IBM i extension logs from standard VS Code log locations.
 *   Returns a structured JSON object with extension version, VS Code version,
 *   connection trace, and output channel log content.
 *
 * Output shape (both modes):
 * {
 *   "collected_at": "<ISO timestamp>",
 *   "collection_mode": "mock" | "live",
 *   "vscode_version": "<string>",
 *   "extension_version": "<string>",
 *   "platform": "<string>",
 *   "output_log": "<full text of Code for IBM i output channel log>",
 *   "connection_trace": "<connection trace text if available>",
 *   "error_summary": ["<key error line>", ...]
 * }
 */

'use strict';

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { sanitiseLog } from './sanitise-log';

export interface DiagnosticResult {
  collected_at: string;
  collection_mode: 'mock' | 'live';
  vscode_version: string;
  extension_version: string;
  previous_extension_version: string | null;
  upgrade_date: string | null;
  platform: string;
  output_log: string;
  connection_trace: string;
  error_summary: string[];
}

/**
 * Collect diagnostics from Code for IBM i extension logs.
 * @param mock     - when true, reads from fixture files instead of live FS
 * @param scenario - "mapepire-hang" (default) or "port449"
 */
export async function collectDiagnostics(
  mock: boolean,
  scenario: string = 'mapepire-hang',
): Promise<DiagnosticResult> {
  if (mock) {
    // ── Mock mode ──────────────────────────────────────────────────────────────
    const fixturesDir = path.join(__dirname, '..', 'test', 'fixtures');
    const mockFiles: Record<string, string> = {
      'mapepire-hang': path.join(fixturesDir, 'mock-extension-logs-mapepire-hang.json'),
      'port449':       path.join(fixturesDir, 'mock-extension-logs-port449.json'),
    };

    const mockFile = mockFiles[scenario.toLowerCase()];
    if (!mockFile) {
      throw new Error(
        `Unknown scenario "${scenario}". Valid values: mapepire-hang, port449`,
      );
    }

    const raw = fs.readFileSync(mockFile, 'utf8');
    return JSON.parse(raw) as DiagnosticResult;
  }

  // ── Live mode ────────────────────────────────────────────────────────────────
  // Reads Code for IBM i extension logs from standard VS Code log directories.
  // These are filesystem reads — no VS Code API or IBM i connection required.

  const platform = os.platform();
  const homeDir  = os.homedir();

  const logRoots: Record<string, string> = {
    win32:  path.join(homeDir, 'AppData', 'Roaming', 'Code', 'logs'),
    darwin: path.join(homeDir, 'Library', 'Application Support', 'Code', 'logs'),
    linux:  path.join(homeDir, '.config', 'Code', 'logs'),
  };

  const logRoot = logRoots[platform] ?? logRoots['linux'];

  let outputLog       = 'Log file not found — check VS Code Output > Code for IBM i manually';
  let connectionTrace = 'Connection trace not available';

  try {
    if (fs.existsSync(logRoot)) {
      const sessions = fs.readdirSync(logRoot).sort().reverse(); // most recent first
      for (const session of sessions) {
        const extLogDir = path.join(logRoot, session, 'exthost');
        if (!fs.existsSync(extLogDir)) { continue; }
        const logFiles = fs.readdirSync(extLogDir)
          .filter(f => f.toLowerCase().includes('halcyon') || f.toLowerCase().includes('codefori'));
        if (logFiles.length > 0) {
          outputLog = sanitiseLog(fs.readFileSync(path.join(extLogDir, logFiles[0]), 'utf8').slice(-8000));
          break;
        }
      }
    }
  } catch (_) { /* non-fatal */ }

  const result: DiagnosticResult = {
    collected_at:              new Date().toISOString(),
    collection_mode:           'live',
    vscode_version:            process.env['VSCODE_VERSION'] ?? 'unknown',
    extension_version:         process.env['CODEFORI_VERSION'] ?? 'unknown',
    previous_extension_version: null,
    upgrade_date:              null,
    platform,
    output_log:                outputLog,
    connection_trace:          connectionTrace,
    error_summary:             outputLog
      .split('\n')
      .filter(l => /error|warn|fail|exception|timeout|MSGW|MCH/i.test(l))
      .slice(0, 20),
  };

  return result;
}

// ── CLI entrypoint ────────────────────────────────────────────────────────────
if (require.main === module) {
  const isMock   = process.env['IBM_I_MOCK'] === 'true';
  const scenario = (process.env['IBM_I_MOCK_SCENARIO'] ?? 'mapepire-hang').toLowerCase();

  collectDiagnostics(isMock, scenario)
    .then(result => {
      process.stdout.write(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch(err => {
      process.stderr.write(`collect-diagnostics failed: ${(err as Error).message}\n`);
      process.exit(1);
    });
}

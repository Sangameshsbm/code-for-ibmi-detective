/**
 * tools/collect.js — collect_ibmi_extension_diagnostics tool implementation
 *
 * Collects Code for IBM i extension diagnostic data.
 *
 * Mock mode (mock=true):
 *   Reads pre-built fixture JSON from ../../test/fixtures/
 *   Scenarios: "port449", "mapepire-hang" (alias "3239")
 *
 * Live mode:
 *   Reads the Code for IBM i extension output channel log from the standard
 *   VS Code log directory for the current OS. No VS Code API or IBM i
 *   connection required — purely filesystem reads.
 *
 * Output shape (DiagnosticResult):
 * {
 *   collected_at:               ISO timestamp,
 *   collection_mode:            "mock" | "live",
 *   vscode_version:             string,
 *   extension_version:          string,
 *   previous_extension_version: string | null,
 *   upgrade_date:               string | null,
 *   platform:                   string,
 *   output_log:                 string,
 *   connection_trace:           string,
 *   error_summary:              string[]
 * }
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

// Resolve __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Root of the companion extension repo (two levels up from packages/mcp-server/tools/)
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

/**
 * Collect diagnostics from Code for IBM i extension logs.
 *
 * @param {boolean} mock     - when true, reads fixture files instead of live FS
 * @param {string}  scenario - "mapepire-hang" (default) | "port449" | "3239"
 * @returns {Promise<object>} DiagnosticResult
 */
export async function collectDiagnostics(mock, scenario = 'mapepire-hang') {
  // Normalise "3239" alias → "mapepire-hang"
  const normScenario = scenario === '3239' ? 'mapepire-hang' : scenario.toLowerCase();

  if (mock) {
    // ── Mock mode ─────────────────────────────────────────────────────────────
    const fixturesDir = path.join(REPO_ROOT, 'test', 'fixtures');

    const mockFiles = {
      'mapepire-hang': path.join(fixturesDir, 'mock-extension-logs-mapepire-hang.json'),
      'port449':       path.join(fixturesDir, 'mock-extension-logs-port449.json'),
    };

    const mockFile = mockFiles[normScenario];
    if (!mockFile) {
      throw new Error(
        `Unknown scenario "${scenario}". Valid values: mapepire-hang, port449, 3239`,
      );
    }

    const raw = fs.readFileSync(mockFile, 'utf8');
    return JSON.parse(raw);
  }

  // ── Live mode ────────────────────────────────────────────────────────────────
  // Reads Code for IBM i extension logs from standard VS Code log directories.
  const platform = os.platform();
  const homeDir  = os.homedir();

  const logRoots = {
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
          outputLog = fs.readFileSync(path.join(extLogDir, logFiles[0]), 'utf8').slice(-8000);
          break;
        }
      }
    }
  } catch (_) {
    // Non-fatal — continue with placeholder text
  }

  return {
    collected_at:               new Date().toISOString(),
    collection_mode:            'live',
    vscode_version:             process.env.VSCODE_VERSION   ?? 'unknown',
    extension_version:          process.env.CODEFORI_VERSION ?? 'unknown',
    previous_extension_version: null,
    upgrade_date:               null,
    platform,
    output_log:                 outputLog,
    connection_trace:           connectionTrace,
    error_summary:              outputLog
      .split('\n')
      .filter(l => /error|warn|fail|exception|timeout|MSGW|MCH/i.test(l))
      .slice(0, 20),
  };
}

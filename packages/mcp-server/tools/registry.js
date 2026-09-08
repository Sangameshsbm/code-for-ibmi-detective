/**
 * tools/registry.js — get_known_issues_registry tool implementation
 *
 * Returns the full Known Issue Registry as a JSON array.
 *
 * Reads data/known-issues.json from the companion extension repo root.
 * No inputs required.
 *
 * Output: KnownIssue[] JSON array
 * [
 *   {
 *     id:                   string,
 *     title:                string,
 *     github_issue_number:  number | null,
 *     github_issue_url:     string | null,
 *     confidence_hint:      number,
 *     keywords:             string[],
 *     symptom_description:  string,
 *     resolution_steps:     string[],
 *     labels:               string[]
 *   }
 * ]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

/**
 * Load and return the full Known Issue Registry.
 *
 * @returns {object[]} array of KnownIssue objects
 * @throws {Error} if known-issues.json cannot be read or parsed
 */
export function getKnownIssuesRegistry() {
  const registryPath = path.join(REPO_ROOT, 'data', 'known-issues.json');
  try {
    const raw = fs.readFileSync(registryPath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`Failed to load known-issues.json: ${err.message}`);
  }
}

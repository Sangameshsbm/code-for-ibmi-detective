/**
 * tools/match.js — match_ibmi_symptom tool implementation
 *
 * Matches a DiagnosticResult against the Known Issue Registry (data/known-issues.json).
 * Uses keyword frequency scoring to compute a confidence score and band.
 *
 * Confidence scoring formula:
 *   matched_keywords / total_keywords * 100 → raw score (0–100)
 *   Bands:
 *     >= 75 : HIGH   — strong match, follow resolution steps directly
 *     40–74 : MEDIUM — possible match, consider resolution steps
 *     < 40  : LOW    — no confident match, suggest opening a GitHub issue
 *
 * The issue with the highest score at or above the LOW threshold is returned.
 * If all issues score below 40, matched=false is returned.
 *
 * Output shape (MatchResult):
 * {
 *   matched:              boolean,
 *   confidence_score:     number (0–100),
 *   confidence_band:      "HIGH" | "MEDIUM" | "LOW",
 *   suggest_github_issue: boolean,
 *   issue?:               KnownIssue
 * }
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

/** Load the Known Issue Registry from the bundled data file. */
function loadKnownIssues() {
  const registryPath = path.join(REPO_ROOT, 'data', 'known-issues.json');
  try {
    const raw = fs.readFileSync(registryPath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`Failed to load known-issues.json: ${err.message}`);
  }
}

/**
 * Score a single known issue against the diagnostic result.
 * Returns a 0–100 confidence score.
 *
 * @param {object} issue      - KnownIssue from registry
 * @param {object} diagnostic - DiagnosticResult
 * @returns {number}
 */
function scoreIssue(issue, diagnostic) {
  if (!issue.keywords || issue.keywords.length === 0) { return 0; }

  // Build the corpus: combine all text fields from the diagnostic
  const corpus = [
    diagnostic.output_log       ?? '',
    diagnostic.connection_trace ?? '',
    ...(diagnostic.error_summary ?? []),
  ]
    .join('\n')
    .toLowerCase();

  let matchedCount = 0;
  for (const keyword of issue.keywords) {
    if (corpus.includes(keyword.toLowerCase())) {
      matchedCount++;
    }
  }

  return Math.round((matchedCount / issue.keywords.length) * 100);
}

/**
 * Match a DiagnosticResult against all known issues.
 * Returns the best match with confidence score and band.
 *
 * @param {object} diagnostic - DiagnosticResult object
 * @returns {object} MatchResult
 */
export function matchSymptom(diagnostic) {
  const issues = loadKnownIssues();

  let bestIssue;
  let bestScore = 0;

  for (const issue of issues) {
    const score = scoreIssue(issue, diagnostic);
    if (score > bestScore) {
      bestScore = score;
      bestIssue = issue;
    }
  }

  const confidenceBand =
    bestScore >= 75 ? 'HIGH'
    : bestScore >= 40 ? 'MEDIUM'
    : 'LOW';

  const matched = bestScore >= 40 && bestIssue !== undefined;

  return {
    matched,
    confidence_score:     bestScore,
    confidence_band:      confidenceBand,
    suggest_github_issue: !matched || (bestIssue?.github_issue_url == null),
    issue:                matched ? bestIssue : undefined,
  };
}

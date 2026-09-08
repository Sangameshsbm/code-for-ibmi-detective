#!/usr/bin/env node
/**
 * match-symptom.ts
 *
 * Matches a DiagnosticResult against the Known Issue Registry (data/known-issues.json).
 * Uses keyword frequency scoring to compute a confidence score and band.
 *
 * Confidence scoring formula:
 *   matched_keywords / total_keywords * 100 → raw score
 *   Bands:
 *     >= 75 : HIGH   (green)
 *     40–74 : MEDIUM (amber)
 *     < 40  : LOW    (red / no match)
 *
 * The issue with the highest score above the LOW threshold is returned.
 * If all issues score below LOW, matched=false is returned.
 */

'use strict';

import * as fs from 'fs';
import * as path from 'path';
import { DiagnosticResult } from './collect-diagnostics';

export interface KnownIssue {
  id: string;
  title: string;
  github_issue_number: number | null;
  github_issue_url: string | null;
  confidence_hint: number;
  keywords: string[];
  symptom_description: string;
  resolution_steps: string[];
  labels: string[];
}

export interface MatchResult {
  matched: boolean;
  confidence_score: number;
  confidence_band: 'HIGH' | 'MEDIUM' | 'LOW';
  suggest_github_issue: boolean;
  issue?: KnownIssue;
}

/** Load the Known Issue Registry from the bundled data file. */
function loadKnownIssues(): KnownIssue[] {
  const registryPath = path.join(__dirname, '..', '..', 'data', 'known-issues.json');
  try {
    const raw = fs.readFileSync(registryPath, 'utf8');
    return JSON.parse(raw) as KnownIssue[];
  } catch (err) {
    throw new Error(`Failed to load known-issues.json: ${(err as Error).message}`);
  }
}

/**
 * Score a single known issue against the diagnostic result.
 * Returns a 0–100 confidence score.
 */
function scoreIssue(issue: KnownIssue, diagnostic: DiagnosticResult): number {
  if (issue.keywords.length === 0) { return 0; }

  // Build the corpus: combine all text fields of the diagnostic
  const corpus = [
    diagnostic.output_log,
    diagnostic.connection_trace,
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

  const rawScore = (matchedCount / issue.keywords.length) * 100;
  return Math.round(rawScore);
}

/**
 * Match a DiagnosticResult against all known issues.
 * Returns the best match with confidence score and band.
 */
export function matchSymptom(diagnostic: DiagnosticResult): MatchResult {
  const issues = loadKnownIssues();

  let bestIssue: KnownIssue | undefined;
  let bestScore = 0;

  for (const issue of issues) {
    const score = scoreIssue(issue, diagnostic);
    if (score > bestScore) {
      bestScore = score;
      bestIssue = issue;
    }
  }

  const confidenceBand: MatchResult['confidence_band'] =
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

// ── CLI entrypoint ────────────────────────────────────────────────────────────
if (require.main === module) {
  const stdinChunks: Buffer[] = [];
  process.stdin.on('data', (chunk: Buffer) => stdinChunks.push(chunk));
  process.stdin.on('end', () => {
    try {
      const raw        = Buffer.concat(stdinChunks).toString('utf8');
      const diagnostic = JSON.parse(raw) as DiagnosticResult;
      const result     = matchSymptom(diagnostic);
      process.stdout.write(JSON.stringify(result, null, 2));
      process.exit(0);
    } catch (err) {
      process.stderr.write(`match-symptom failed: ${(err as Error).message}\n`);
      process.exit(1);
    }
  });
}

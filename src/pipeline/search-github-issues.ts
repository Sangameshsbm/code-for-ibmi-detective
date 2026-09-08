#!/usr/bin/env node
/**
 * search-github-issues.ts
 *
 * TypeScript port of search-github-issues.js.
 * Searches codefori/vscode-ibmi GitHub issues for matches to the developer's symptom.
 * IDE-agnostic — works identically when called from Bob or VS Code (Copilot/Claude).
 *
 * Mock mode (IBM_I_MOCK=true):
 *   Returns pre-built mock GitHub API response from test/fixtures/mock-github-issues.json.
 *   No internet or GitHub PAT required — safe for offline demos.
 *
 * Live mode:
 *   Calls GitHub Search API:
 *     GET https://api.github.com/search/issues
 *         ?q=<symptom>+repo:codefori/vscode-ibmi
 *   GITHUB_TOKEN env var recommended for higher rate limits (5000 req/hr vs 60).
 *
 * Input:  symptom keywords via `searchGitHubIssues(keywords, token?)`
 *
 * Output shape:
 * [
 *   {
 *     "number": 3239,
 *     "title": "...",
 *     "state": "open" | "closed",
 *     "url": "https://github.com/codefori/vscode-ibmi/issues/3239",
 *     "body_excerpt": "<first 500 chars of issue body>",
 *     "comment_count": 14
 *   }
 * ]
 */

'use strict';

import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';

export interface Issue {
  number: number;
  title: string;
  state: string;
  url: string;
  created_at: string;
  updated_at: string;
  labels: string[];
  body_excerpt: string;
  comment_count: number;
}

interface GitHubApiItem {
  number: number;
  title: string;
  state: string;
  html_url: string;
  created_at: string;
  updated_at: string;
  labels: Array<{ name: string }>;
  body: string | null;
  comments: number;
}

interface GitHubSearchResponse {
  total_count: number;
  items: GitHubApiItem[];
}

interface MockGitHubResponse {
  search_mode: string;
  query: string;
  total_count: number;
  issues: Array<{
    number: number;
    title: string;
    state: string;
    url: string;
    created_at: string;
    updated_at: string;
    labels: string[];
    body_excerpt: string;
    comments: number;
  }>;
}

/**
 * Search GitHub issues in codefori/vscode-ibmi for the given keywords.
 * @param keywords - symptom keywords to search for
 * @param token    - optional GitHub personal access token (for higher rate limits)
 * @param mock     - when true, reads mock fixture instead of calling GitHub API
 */
export function searchGitHubIssues(
  keywords: string,
  token?: string,
  mock: boolean = process.env['IBM_I_MOCK'] === 'true',
): Promise<Issue[]> {
  if (mock) {
    // ── Mock mode ──────────────────────────────────────────────────────────────
    const mockFile = path.join(__dirname, '..', '..', 'test', 'fixtures', 'mock-github-issues.json');
    try {
      const raw  = fs.readFileSync(mockFile, 'utf8');
      const data = JSON.parse(raw) as MockGitHubResponse;
      return Promise.resolve(
        (data.issues ?? []).map(i => ({
          number:       i.number,
          title:        i.title,
          state:        i.state,
          url:          i.url,
          created_at:   i.created_at,
          updated_at:   i.updated_at,
          labels:       i.labels,
          body_excerpt: i.body_excerpt,
          comment_count: i.comments,
        })),
      );
    } catch (err) {
      return Promise.reject(new Error(`Failed to read mock file: ${(err as Error).message}`));
    }
  }

  if (!keywords.trim()) {
    return Promise.reject(new Error('keywords must not be empty'));
  }

  // ── Live mode ────────────────────────────────────────────────────────────────
  const query   = encodeURIComponent(`${keywords} repo:codefori/vscode-ibmi`);
  const headers: Record<string, string> = {
    'User-Agent': 'vscode-ibmi-detective/0.1.0',
    'Accept':     'application/vnd.github+json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return new Promise<Issue[]>((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.github.com',
        path:     `/search/issues?q=${query}&per_page=5&sort=relevance`,
        method:   'GET',
        headers,
      },
      res => {
        let body = '';
        res.on('data', (chunk: Buffer) => { body += chunk; });
        res.on('end', () => {
          if (res.statusCode !== 200) {
            reject(new Error(`GitHub API returned ${res.statusCode}: ${body}`));
            return;
          }
          try {
            const data = JSON.parse(body) as GitHubSearchResponse;
            const issues: Issue[] = (data.items ?? []).map(item => ({
              number:        item.number,
              title:         item.title,
              state:         item.state,
              url:           item.html_url,
              created_at:    item.created_at,
              updated_at:    item.updated_at,
              labels:        (item.labels ?? []).map(l => l.name),
              body_excerpt:  (item.body ?? '').slice(0, 500),
              comment_count: item.comments,
            }));
            resolve(issues);
          } catch (err) {
            reject(new Error(`Failed to parse GitHub API response: ${(err as Error).message}`));
          }
        });
      },
    );

    req.on('error', (err: Error) => {
      reject(new Error(`GitHub API request failed: ${err.message}`));
    });
    req.end();
  });
}

// ── CLI entrypoint ────────────────────────────────────────────────────────────
if (require.main === module) {
  const isMock   = process.env['IBM_I_MOCK'] === 'true';
  const symptom  = process.argv.slice(2).join(' ') || process.env['SYMPTOM'] || '';
  const token    = process.env['GITHUB_TOKEN'];

  if (!isMock && !symptom) {
    process.stderr.write('Usage: node search-github-issues.js "<symptom keywords>"\n');
    process.exit(1);
  }

  searchGitHubIssues(symptom, token, isMock)
    .then(issues => {
      const result = {
        search_mode: isMock ? 'mock' : 'live',
        query:       symptom,
        total_count: issues.length,
        issues,
      };
      process.stdout.write(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch(err => {
      process.stderr.write(`search-github-issues failed: ${(err as Error).message}\n`);
      process.exit(1);
    });
}

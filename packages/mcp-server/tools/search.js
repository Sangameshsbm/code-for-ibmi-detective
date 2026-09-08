/**
 * tools/search.js — search_ibmi_github_issues tool implementation
 *
 * Searches codefori/vscode-ibmi GitHub issues for the given symptom keywords.
 *
 * Mock mode (mock=true or IBM_I_MOCK=true env var):
 *   Returns pre-built fixture data from ../../test/fixtures/mock-github-issues.json.
 *   No internet or GitHub PAT required — safe for offline demos.
 *
 * Live mode:
 *   Calls GitHub Search API:
 *     GET https://api.github.com/search/issues
 *         ?q=<keywords>+repo:codefori/vscode-ibmi
 *   Set GITHUB_TOKEN env var for higher rate limits (5000 req/hr vs 60).
 *
 * Output: Issue[] JSON array
 * [
 *   {
 *     number:        number,
 *     title:         string,
 *     state:         "open" | "closed",
 *     url:           string,
 *     created_at:    string,
 *     updated_at:    string,
 *     labels:        string[],
 *     body_excerpt:  string,
 *     comment_count: number
 *   }
 * ]
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

/**
 * Search GitHub issues in codefori/vscode-ibmi for the given keywords.
 *
 * @param {string}           keywords - symptom keywords to search for
 * @param {string|undefined} token    - optional GitHub PAT for higher rate limits
 * @param {boolean}          mock     - when true, reads mock fixture instead of calling GitHub
 * @returns {Promise<object[]>} array of Issue objects
 */
export function searchGitHubIssues(
  keywords,
  token,
  mock = process.env.IBM_I_MOCK === 'true',
) {
  if (mock) {
    // ── Mock mode ─────────────────────────────────────────────────────────────
    const mockFile = path.join(REPO_ROOT, 'test', 'fixtures', 'mock-github-issues.json');
    try {
      const raw  = fs.readFileSync(mockFile, 'utf8');
      const data = JSON.parse(raw);
      const items = data.issues ?? [];
      return Promise.resolve(
        items.map(i => ({
          number:        i.number,
          title:         i.title,
          state:         i.state,
          url:           i.url,
          created_at:    i.created_at,
          updated_at:    i.updated_at,
          labels:        i.labels ?? [],
          body_excerpt:  i.body_excerpt ?? '',
          comment_count: i.comments ?? 0,
        })),
      );
    } catch (err) {
      return Promise.reject(new Error(`Failed to read mock fixture: ${err.message}`));
    }
  }

  if (!keywords || !keywords.trim()) {
    return Promise.reject(new Error('keywords must not be empty'));
  }

  // ── Live mode ────────────────────────────────────────────────────────────────
  const query = encodeURIComponent(`${keywords} repo:codefori/vscode-ibmi`);

  const headers = {
    'User-Agent': 'ibmi-detective-mcp/0.1.0',
    'Accept':     'application/vnd.github+json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.github.com',
        path:     `/search/issues?q=${query}&per_page=5&sort=relevance`,
        method:   'GET',
        headers,
      },
      res => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => {
          if (res.statusCode !== 200) {
            reject(new Error(`GitHub API returned ${res.statusCode}: ${body}`));
            return;
          }
          try {
            const data   = JSON.parse(body);
            const issues = (data.items ?? []).map(item => ({
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
            reject(new Error(`Failed to parse GitHub API response: ${err.message}`));
          }
        });
      },
    );

    req.on('error', err => {
      reject(new Error(`GitHub API request failed: ${err.message}`));
    });
    req.end();
  });
}

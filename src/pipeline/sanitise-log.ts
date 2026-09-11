/**
 * sanitise-log.ts
 *
 * Strips PII patterns from raw extension log text before any downstream
 * processing or transmission.  All replacements are applied in order so that
 * later patterns cannot accidentally re-expose data cleared by earlier ones.
 */

'use strict';

/**
 * Replace PII patterns in `raw` with neutral placeholders.
 *
 * Patterns applied (in order):
 *   1. IPv4 addresses                        → [IP]
 *   2. IPv6 addresses (full and compressed)  → [IP]
 *   3. IBM i job names  (nnnnn/user/job)     → [JOB]
 *   4. IBM i user profile names              → [IBMI-USER]
 *   5. IBM i hostnames                       → [HOST]
 */
export function sanitiseLog(raw: string): string {
  return raw
    // 1. IPv4
    .replace(/\b\d{1,3}(\.\d{1,3}){3}\b/g, '[IP]')
    // 2. IPv6 — matches full (8 groups) and compressed (contains ::) forms
    .replace(/\b(?:[0-9a-fA-F]{1,4}:){1,7}[0-9a-fA-F]{1,4}\b|\b(?:[0-9a-fA-F]{1,4}:)*::(?:[0-9a-fA-F]{1,4}:)*[0-9a-fA-F]{1,4}\b/g, '[IP]')
    // 3. IBM i job names: nnnnnn/username/jobname
    .replace(/\b\d{6}\/\w+\/\w+\b/g, '[JOB]')
    // 4. IBM i user profile names (word after User:, user profile, signed on as, QUSER)
    .replace(/(?:User:|user profile|signed on as|QUSER\s+)\s*(\S+)/g, (match, user) =>
      match.replace(user, '[IBMI-USER]'),
    )
    // 5. IBM i hostnames (word after Connecting to, Connected to, system:, host:)
    .replace(/(?:Connecting to|Connected to|system:|host:)\s*(\S+)/g, (match, host) =>
      match.replace(host, '[HOST]'),
    );
}

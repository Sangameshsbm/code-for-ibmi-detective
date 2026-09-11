# Plan: Symptom-aware matching + troubleshooting on No Match

## Top-Level Overview

Two related problems need solving:

1. **Matching is blind to the user's typed symptom.**  
   `matchSymptom` only searches the VS Code extension log. The user's typed symptom is sent to
   GitHub search but never used locally. If GitHub is unavailable (or the user didn't tick the
   consent box) the match is 0 for everything and "No Match Found" is shown even when a
   relevant entry exists.

2. **"No Match Found" is unhelpful.**  
   The page shows a GitHub issue scaffold and a manual link — no actionable troubleshooting
   steps. Users who just want to self-diagnose have nowhere to go.

3. **The "slow compile / actions performance" symptom has no entry in `known-issues.json`.**  
   GitHub issue [codefori/vscode-ibmi#3426](https://github.com/codefori/vscode-ibmi/issues/3426)
   covers exactly this, but the registry is missing it entirely.

### Scope

- Sub-task A: Add the "slow compile / actions performance" known issue to the registry.
- Sub-task B: Include the typed symptom in the local matching corpus so it influences the score.
- Sub-task C: Add a "Try These Steps First" troubleshooting section to the No-Match screen,
  driven by keyword matching against the typed symptom.

### Out of Scope

- Changing the GitHub issues expander on the match-found result screen.
- Any new network calls or AI inference.
- Changing the confidence band thresholds.

---

## Sub-Task A — Add slow-compile known issue to the registry

### Intent
`data/known-issues.json` has no entry for slow compile / slow actions performance.
This means even a perfect match between the user's symptom and a known problem scores 0.
Adding the entry makes the issue detectable once Sub-task B is also done.

### Expected Outcomes
- A new entry in `known-issues.json` with:
  - Keywords drawn from the GitHub issue #3426 and common user phrasings
  - At least 5 concrete resolution steps (check build output settings, Actions filter,
    network latency, large object lists, IBM i system values, etc.)
  - Link to GitHub issue #3426
- All existing entries remain unchanged.

### Todo List
1. Read GitHub issue #3426 content (already known from user's link) to extract symptom
   keywords and discussed workarounds.
2. Add a new JSON object to `data/known-issues.json` with:
   - `id`: `"slow-compile-actions"`
   - `title`: descriptive title matching the issue
   - `github_issue_number`: 3426
   - `github_issue_url`: `https://github.com/codefori/vscode-ibmi/issues/3426`
   - `keywords`: broad set covering "slow", "compile", "compile time", "actions",
     "longer than", "performance", "build", "CRTRPGMOD", "CRTBNDRPG", "slow action",
     "takes longer", "compile action", "compile duration"
   - `resolution_steps`: 5–7 concrete steps
   - `labels`: `["performance", "compile", "actions"]`

### Relevant Context
- File: `data/known-issues.json`
- All three existing entries follow the same JSON shape.

### Status
[ ] pending

---

## Sub-Task B — Include typed symptom in local match corpus

### Intent
`scoreIssue` in `match-symptom.ts` builds a text corpus from `diagnostic.output_log`,
`diagnostic.connection_trace`, and `diagnostic.error_summary`. The user's typed symptom is
**never included**. This means a match-worthy typed description (e.g. "compile takes longer")
contributes 0 to the score even when a known issue exists.

The fix: pass the typed symptom through the pipeline so `matchSymptom` can include it in
the scoring corpus.

### Expected Outcomes
- `DiagnosticResult` gains an optional `symptom_text` field (string, defaults to `''`).
- `collectDiagnostics` accepts and stores the symptom text in that field.
- `_runPipeline` in `detective-panel.ts` passes the symptom to `collectDiagnostics`.
- `scoreIssue` appends `diagnostic.symptom_text` to the corpus before scoring.
- A user typing "compile takes longer" now scores against the slow-compile entry's keywords
  and gets a MEDIUM or HIGH match.

### Todo List
1. In `collect-diagnostics.ts`:
   - Add `symptom_text: string` field to the `DiagnosticResult` interface.
   - Add optional `symptomText = ''` parameter to `collectDiagnostics(mock, scenario, symptomText)`.
   - Assign it to `result.symptom_text` in the returned object.
2. In `detective-panel.ts`:
   - Pass `symptom` as the third argument to `collectDiagnostics(false, 'mapepire-hang', symptom)`.
3. In `match-symptom.ts`:
   - Append `diagnostic.symptom_text` to the corpus array in `scoreIssue`.

### Relevant Context
- `src/pipeline/collect-diagnostics.ts` — `collectDiagnostics` function and `DiagnosticResult` interface
- `src/pipeline/match-symptom.ts` — `scoreIssue` function, corpus construction (lines 64–70)
- `src/detective-panel.ts` — `_runPipeline` method, the `collectDiagnostics(false)` call

### Status
[ ] pending

---

## Sub-Task C — "Try These Steps First" section on No-Match screen

### Intent
When no match is found, the current screen only links to GitHub and shows a blank issue
scaffold. The user gets no actionable help.

The plan: after scoring, if `matched === false`, run a second lighter pass that scores each
known issue's keywords against **only the typed symptom text**. If any issue scores ≥ 1
keyword hit, include its `resolution_steps` in the No-Match payload as "suggested steps".
The No-Match screen renders these as an expandable "Try These Steps First" section above the
GitHub scaffold.

This is purely client-side — no new API calls. The `suggest_steps` array (list of steps from
partially-matching issues) is computed in `matchSymptom` and added to the result payload.

### Expected Outcomes
- `MatchResult` gains an optional `suggest_steps: string[]` field.
- When `matched === false`, `matchSymptom` collects `resolution_steps` from any issue that
  has ≥ 1 keyword hit against the symptom text.
- The `phase-nomatch` HTML renders a "Try These Steps First" `<ol>` from `suggest_steps`
  before the divider and GitHub scaffold — only when the array is non-empty.
- When `suggest_steps` is empty the page looks exactly as today.

### Todo List
1. In `match-symptom.ts`:
   - Add `suggest_steps?: string[]` to `MatchResult`.
   - After the main scoring loop, if `matched === false`, do a second pass:
     - For each known issue, count keyword hits against `diagnostic.symptom_text` only.
     - Collect `resolution_steps` from any issue with ≥ 1 hit (deduplicated, flat list).
   - Add `suggest_steps` to the returned object.
2. In `detective-panel.ts`:
   - The result payload already spreads `matchResult`, so `suggest_steps` is automatically
     included — no change needed here.
3. In `media/detective-panel.html`:
   - Add a `<div id="nomatch-suggestions">` element inside `phase-nomatch`, above the
     `<hr class="divider">`, hidden by default.
   - Add CSS for it (same style as the existing `.steps-list` / `.resolution-title`).
   - In `renderResult`, when `matched === false` and `payload.suggest_steps?.length > 0`,
     populate the element and make it visible before calling `showPhase('nomatch')`.

### Relevant Context
- `src/pipeline/match-symptom.ts` — `MatchResult` interface, `matchSymptom` function
- `media/detective-panel.html` — `phase-nomatch` div, `renderResult` JS function
- `src/detective-panel.ts` — payload spread at line ~139

### Status
[ ] pending

---

## Sub-Task D — Rebuild and verify

### Intent
Compile, package a new VSIX, and confirm the three scenarios work end-to-end:
1. Typing "compile takes longer" → MEDIUM or HIGH match → result screen with resolution steps.
2. Typing a completely unknown symptom → No-Match screen with "Try These Steps First" if any
   partial keyword hits exist, otherwise the screen looks unchanged.
3. Fatal pipeline error → error message stays visible on the running phase.

### Todo List
1. Run `npm run compile` — must pass with no errors.
2. Run `npx vsce package --no-dependencies` — must produce a new VSIX.
3. Install and smoke-test all three scenarios above.

### Status
[ ] pending

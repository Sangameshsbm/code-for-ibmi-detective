# IBM i Detective — GitHub Action

Run the **IBM i Developer Detective** diagnostic pipeline as a single step in any GitHub Actions workflow.  
No live IBM i connection is required — the action runs entirely on mock fixture data.

---

## Quick start

```yaml
- name: Run IBM i Detective
  uses: sangamesh/vscode-ibmi-detective/.github/actions/ibmi-detective@main
  id: detective
  with:
    scenario: port449

- name: Print result
  run: |
    echo "Confidence : ${{ steps.detective.outputs.confidence_score }}"
    echo "Matched ID : ${{ steps.detective.outputs.matched_issue_id }}"
    echo "Summary    : ${{ steps.detective.outputs.report_summary }}"
```

---

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `scenario` | ✅ yes | — | Scenario to run. Supported values: `port449`, `3239` |
| `fail_on_low_confidence` | no | `false` | Set to `"true"` to fail the step when `confidence_score` is below `minimum_confidence` |
| `minimum_confidence` | no | `75` | Minimum confidence score (0–100). Only used when `fail_on_low_confidence` is `"true"` |

### Scenario reference

| Value | Fixture file | Known issue |
|---|---|---|
| `port449` | `mock-extension-logs-port449.json` | `port449-connection-refused` — ECONNREFUSED on port 449 |
| `3239` | `mock-extension-logs-mapepire-hang.json` | `mapepire-hang-post-upgrade` — Extension stuck at Starting Mapepire after upgrade |

---

## Outputs

| Output | Description |
|---|---|
| `confidence_score` | Numeric confidence score (0–100) for the best-matching known issue |
| `matched_issue_id` | ID of the best-matching registry entry, or `none` if no match |
| `report_summary` | One-line human-readable summary of the detection result |

---

## Example: hard-fail when confidence drops

```yaml
jobs:
  detective:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Detect port 449 issue
        uses: sangamesh/vscode-ibmi-detective/.github/actions/ibmi-detective@main
        id: detective
        with:
          scenario: port449
          fail_on_low_confidence: 'true'
          minimum_confidence: '75'

      - name: Show outputs
        run: |
          echo "Score    : ${{ steps.detective.outputs.confidence_score }}"
          echo "Issue ID : ${{ steps.detective.outputs.matched_issue_id }}"
          echo "Summary  : ${{ steps.detective.outputs.report_summary }}"
```

---

## Example: how `codefori/vscode-ibmi` could reference this action

```yaml
# In codefori/vscode-ibmi — .github/workflows/ibmi-detective-check.yml
name: IBM i Detective check

on:
  pull_request:
    paths:
      - 'src/**'
      - 'package.json'

jobs:
  detective-port449:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          repository: sangamesh/vscode-ibmi-detective

      - name: Run detective (port449 scenario)
        uses: sangamesh/vscode-ibmi-detective/.github/actions/ibmi-detective@main
        id: detective
        with:
          scenario: port449
          fail_on_low_confidence: 'true'
          minimum_confidence: '75'

      - name: Annotate PR
        run: |
          echo "### IBM i Detective Result" >> $GITHUB_STEP_SUMMARY
          echo "| Field | Value |" >> $GITHUB_STEP_SUMMARY
          echo "|---|---|" >> $GITHUB_STEP_SUMMARY
          echo "| Confidence | ${{ steps.detective.outputs.confidence_score }} |" >> $GITHUB_STEP_SUMMARY
          echo "| Matched issue | ${{ steps.detective.outputs.matched_issue_id }} |" >> $GITHUB_STEP_SUMMARY
          echo "| Summary | ${{ steps.detective.outputs.report_summary }} |" >> $GITHUB_STEP_SUMMARY
```

---

## Need more control?

Use the **reusable workflow** instead of this composite action.  
It exposes the same inputs and outputs but runs as a full, inspectable job:

```yaml
jobs:
  detect:
    uses: sangamesh/vscode-ibmi-detective/.github/workflows/detective-reusable.yml@main
    with:
      scenario: port449
      fail_on_low_confidence: true
      minimum_confidence: 75
```

See [`.github/workflows/detective-reusable.yml`](../../workflows/detective-reusable.yml) for the full source.

---

## CI badge

```markdown
![CI](https://github.com/sangamesh/vscode-ibmi-detective/actions/workflows/ci.yml/badge.svg)
```

![CI](https://github.com/sangamesh/vscode-ibmi-detective/actions/workflows/ci.yml/badge.svg)

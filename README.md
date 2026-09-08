# IBM i Detective

> **AI-assisted diagnostic layer for [Code for IBM i](https://github.com/codefori/vscode-ibmi).**
> Collects extension logs, searches known issues, and scores confidence — so you spend
> minutes diagnosing instead of hours guessing.

---

## The Problem

When Code for IBM i misbehaves — a hung Mapepire startup, a refused port 449 connection,
an SSH auth failure — the path from "something is wrong" to "here is the fix" typically
takes 15–30 minutes: opening the Output channel, searching GitHub issues, reading thread
after thread, and trying fixes one by one.

IBM i Detective reduces that to under 2 minutes by doing the investigation for you.

---

## Features

| Feature | Details |
|---|---|
| 📋 **Log collection** | Reads Code for IBM i extension logs from your local filesystem — no IBM i connection needed |
| 🔍 **GitHub issue search** | Searches `codefori/vscode-ibmi` issues for your symptom keywords |
| 🎯 **Confidence scoring** | Keyword-frequency matching against a curated Known Issue Registry |
| 🟢 **Colour-coded results** | GREEN ≥ 75, AMBER 40–74, RED < 40 |
| 📋 **One-click copy** | Copy the issue body or GitHub scaffold to clipboard |
| 🔒 **Secure token storage** | GitHub PAT stored in VS Code `SecretStorage` — never in settings |
| 🤝 **Soft dependency** | Works even if Code for IBM i is not installed (limited log collection) |

---

## Screenshot

<!-- TODO: replace with actual screenshot after first publish -->
```
┌─────────────────────────────────────────────────────────────┐
│  🔍 IBM i Detective — Results                               │
│                                                             │
│  85 / 100   [ HIGH ]                                        │
│                                                             │
│  ┌─ Extension stuck at 'Starting Mapepire' after upgrade ─┐ │
│  │  Known issue #3239 · bug, mapepire, upgrade            │ │
│  │                                                         │ │
│  │  RESOLUTION STEPS                                       │ │
│  │  1. End any lingering NOXDBSRV jobs on IBM i           │ │
│  │  2. Clear stale Mapepire service program objects       │ │
│  │  3. Run 'Reinstall Mapepire server on system'          │ │
│  │  4. Reconnect to IBM i                                  │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## How to Use

### 1. Install the extension

Search for **IBM i Detective** in the VS Code Marketplace, or install from the `.vsix`:

```bash
code --install-extension vscode-ibmi-detective-0.1.0.vsix
```

### 2. Run the investigation

Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and run:

```
IBM i: Investigate Extension Issue
```

### 3. Describe your symptom

In the panel that opens, type a short description of what you observe
(e.g. *"Extension hangs at Starting Mapepire after upgrading to v3"*), then click
**Investigate**.

You can also leave the symptom blank — the Detective will auto-detect from your
Code for IBM i output log.

### 4. Review the results

- **Phase 1 → Input:** describe the symptom
- **Phase 2 → Running:** watch the three pipeline steps execute in real time
- **Phase 3 → Results:** confidence badge, matched issue card, resolution steps,
  expandable GitHub issue body with Copy button
- **Phase 4 → No match:** GitHub issue scaffold to open a new report

### GitHub Token (optional but recommended)

Without a token, GitHub's unauthenticated API allows 60 requests/hour — enough for
occasional use. For teams or frequent diagnostics, add a token:

1. Create a GitHub Personal Access Token with `public_repo` read scope at
   https://github.com/settings/tokens
2. The first time you run an investigation, IBM i Detective will prompt you for the token.
3. The token is stored securely in VS Code's `SecretStorage` — never in `settings.json`.

---

## For Bob Users

If you use [IBM Bob](https://ibm.github.io/bob) as your AI assistant, the Detective
is also available as a Bob custom mode. Install the Bob mode from the
`Bob-builder-sangamesh` repository and run it directly from your Bob session — no VS Code
Webview required.

---

## Known Issue Registry

The heart of IBM i Detective is the **Known Issue Registry** at
[`data/known-issues.json`](data/known-issues.json). Every entry maps a set of error
keywords to a titled issue, confidence hint, and concrete resolution steps.

### Contributing a new entry

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full process. The short version:

1. Fork this repo
2. Add an entry to `data/known-issues.json`
3. Open a PR with title `known-issue: <description>`

New entries benefit every developer who hits the same problem. The registry is the
community's shared knowledge base.

---

## Architecture

```
VS Code Command
      │
      ▼
DetectivePanel (Webview)
      │
      ▼
pipeline/collect-diagnostics.ts   ← reads local filesystem logs
pipeline/search-github-issues.ts  ← calls GitHub Search API
pipeline/match-symptom.ts         ← scores against known-issues.json
      │
      ▼
Webview result message
```

All facts (logs, GitHub issues, confidence score) come from **deterministic scripts**.
The AI (Bob / Copilot) writes prose only — it never invents diagnostic data.

---

## Development

```bash
git clone https://github.com/<your-username>/vscode-ibmi-detective
cd vscode-ibmi-detective
npm install
npm run compile     # TypeScript type-check + esbuild bundle → dist/extension.js
npm test            # Unit tests (ts-node)
```

Press **F5** in VS Code to launch the Extension Development Host.

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

## Related Projects

- [codefori/vscode-ibmi](https://github.com/codefori/vscode-ibmi) — the extension this
  tool diagnoses
- [IBM Bob](https://ibm.github.io/bob) — AI assistant with a built-in IBM i Detective mode

# Contributing to IBM i Detective

Thank you for helping improve IBM i Detective! The most impactful way to contribute is by
adding entries to the **Known Issue Registry** — a curated list of common Code for IBM i
problems with deterministic resolution steps.

---

## How to Add a Known Issue Registry Entry

The registry lives at [`data/known-issues.json`](data/known-issues.json). It is a JSON
array of issue objects. Every entry you add becomes immediately available to all users of
the extension after a release.

### JSON Object Field Descriptions

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | ✅ | Unique kebab-case identifier. Used internally. |
| `title` | `string` | ✅ | Short human-readable title shown in the Webview results card. |
| `github_issue_number` | `number \| null` | ✅ | The GitHub issue number on `codefori/vscode-ibmi`, or `null` if no linked issue exists. |
| `github_issue_url` | `string \| null` | ✅ | Full URL of the linked GitHub issue, or `null`. |
| `confidence_hint` | `number` | ✅ | The expected minimum confidence score (0–100) when the keywords all match. Used in tests. |
| `keywords` | `string[]` | ✅ | List of strings to match against the diagnostic corpus (output log + error summary). Case-insensitive substring match. |
| `symptom_description` | `string` | ✅ | One or two sentences describing what the user observes. Shown in the expandable issue body panel. |
| `resolution_steps` | `string[]` | ✅ | Numbered list of concrete steps to resolve the issue. Shown as an ordered list in the results card. Be specific — include exact IBM i commands where applicable. |
| `labels` | `string[]` | ✅ | Categorisation tags (e.g. `"connection"`, `"mapepire"`, `"upgrade"`, `"ssh"`). Free-form. |

### Example Entry

```json
{
  "id": "ssl-certificate-expired",
  "title": "SSL handshake fails — certificate expired or not trusted",
  "github_issue_number": 2891,
  "github_issue_url": "https://github.com/codefori/vscode-ibmi/issues/2891",
  "confidence_hint": 78,
  "keywords": [
    "SSL",
    "TLS",
    "certificate",
    "handshake",
    "CWBCO1050",
    "certificate expired",
    "not trusted",
    "QIBM_CERT"
  ],
  "symptom_description": "The extension fails to connect because the SSL/TLS certificate on the IBM i has expired or is not trusted by the workstation's certificate store.",
  "resolution_steps": [
    "On the IBM i, open Digital Certificate Manager (DCM) at https://<system>:2010/QIBM/ICSS/Cert/Admin/qycuCertMain.html",
    "Check the expiry date of the certificate assigned to the *SYSTEM certificate store.",
    "If expired: renew or replace the certificate in DCM, then restart the host servers: ENDTCPSVR SERVER(*HTTP) HTTPSVR(ADMIN); STRTCPSVR SERVER(*HTTP) HTTPSVR(ADMIN)",
    "On the workstation: export the IBM i CA certificate from DCM and import it into your OS certificate store (Windows: certmgr.msc → Trusted Root CAs).",
    "Reconnect in VS Code."
  ],
  "labels": ["connection", "ssl", "certificate"]
}
```

### Step-by-Step PR Process

1. **Fork** the `vscode-ibmi-detective` repository on GitHub.

2. **Create a branch** with a descriptive name:
   ```
   git checkout -b known-issue/ssl-certificate-expired
   ```

3. **Edit `data/known-issues.json`** — append your new entry to the JSON array.
   Make sure the file is valid JSON (run `node -e "JSON.parse(require('fs').readFileSync('data/known-issues.json','utf8'))"` to check).

4. **Add keywords carefully.** Keywords must appear verbatim in the Code for IBM i output
   log or error summary. Test against a real log snippet before submitting. More keywords
   = higher potential score, but false keywords reduce precision.

5. **Write concrete resolution steps.** Each step should be independently actionable.
   Include IBM i command syntax where relevant (e.g. `STRHOSTSVR`, `ENDTCPSVR`, `WRKACTJOB`).

6. **Open a Pull Request** against the `main` branch. Use this PR title format:
   ```
   known-issue: <short description>  (e.g. "known-issue: SSL certificate expired")
   ```

7. In the PR description, paste a short excerpt of the log text that triggered the issue
   so reviewers can verify the keywords are correct.

---

## Other Contribution Areas

- **Bug reports:** Open a GitHub Issue describing the problem, the VS Code version, and
  the Code for IBM i version.
- **Feature requests:** Open a GitHub Issue tagged `enhancement`. Describe the use case
  before any implementation.
- **Pipeline improvements:** The core pipeline lives in `src/pipeline/`. Follow the
  existing TypeScript style — strict mode, explicit types, no `any`.
- **Webview UI:** The panel HTML is in `media/detective-panel.html` — plain HTML + inline
  CSS, no framework.

---

## Development Setup

```bash
git clone https://github.com/<your-username>/vscode-ibmi-detective
cd vscode-ibmi-detective
npm install
npm run compile      # TypeScript check + esbuild bundle
npm test             # Run unit tests (ts-node required)
```

To run the extension in a VS Code Extension Development Host:
1. Open the `vscode-ibmi-detective/` folder in VS Code.
2. Press **F5** — this launches a new VS Code window with the extension loaded.
3. Open the Command Palette (`Ctrl+Shift+P`) and run **IBM i: Investigate Extension Issue**.

---

## Code of Conduct

Be respectful. IBM i developers come from diverse backgrounds. Contributions that help
newer developers diagnose and fix problems faster are the goal.

# ibmi-detective-mcp

MCP server that exposes the IBM i Detective diagnostic engine to any MCP-compatible AI tool — IBM Bob, Claude Desktop, GitHub Copilot, and Cursor.

No VS Code installation required. Four tools cover the full diagnostic workflow: collect extension logs, search known GitHub issues, score confidence against the registry, and browse the full registry.

---

## Tools

| Tool | Description |
|---|---|
| `collect_ibmi_extension_diagnostics` | Reads Code for IBM i extension logs from the local filesystem (or returns mock fixture data) |
| `search_ibmi_github_issues` | Searches `codefori/vscode-ibmi` GitHub issues for given symptom keywords |
| `match_ibmi_symptom` | Scores a DiagnosticResult against the Known Issue Registry and returns a confidence band |
| `get_known_issues_registry` | Returns the full Known Issue Registry (keywords, resolution steps, GitHub links) |

---

## Install

```bash
# Run once with npx (no install needed)
npx ibmi-detective-mcp

# Or install globally
npm install -g ibmi-detective-mcp
```

---

## Configuration

### IBM Bob (`mcp_servers` in `bob-mcp.yaml` or Bob settings)

```yaml
mcp_servers:
  ibmi-detective:
    command: npx
    args:
      - ibmi-detective-mcp
```

### Claude Desktop (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS)

```json
{
  "mcpServers": {
    "ibmi-detective": {
      "command": "npx",
      "args": ["ibmi-detective-mcp"]
    }
  }
}
```

### Cursor (`.cursor/mcp.json` in your project root, or `~/.cursor/mcp.json` globally)

```json
{
  "mcpServers": {
    "ibmi-detective": {
      "command": "npx",
      "args": ["ibmi-detective-mcp"]
    }
  }
}
```

### With a GitHub token (recommended — raises rate limit to 5 000 req/hr)

```json
{
  "mcpServers": {
    "ibmi-detective": {
      "command": "npx",
      "args": ["ibmi-detective-mcp"],
      "env": {
        "GITHUB_TOKEN": "ghp_your_token_here"
      }
    }
  }
}
```

---

## Two-step diagnostic example

**Step 1 — Collect extension diagnostics (mock port-449 scenario)**

Call tool: `collect_ibmi_extension_diagnostics`
```json
{
  "mock": true,
  "scenario": "port449"
}
```

The tool returns a `DiagnosticResult` JSON object, for example:
```json
{
  "collected_at": "2024-01-15T10:30:00.000Z",
  "collection_mode": "mock",
  "vscode_version": "1.85.0",
  "extension_version": "2.14.0",
  "platform": "win32",
  "output_log": "... ECONNREFUSED 10.0.0.1:449 ...",
  "connection_trace": "...",
  "error_summary": ["Error: connect ECONNREFUSED 10.0.0.1:449"]
}
```

**Step 2 — Match the symptom against the known-issue registry**

Call tool: `match_ibmi_symptom`
```json
{
  "diagnostic_json": "<paste the full JSON string from step 1>"
}
```

The tool returns a `MatchResult`:
```json
{
  "matched": true,
  "confidence_score": 78,
  "confidence_band": "HIGH",
  "suggest_github_issue": false,
  "issue": {
    "id": "port449-connection-refused",
    "title": "ECONNREFUSED on port 449 — IBM i host servers not started",
    "resolution_steps": [
      "On the IBM i system, sign on and run: STRHOSTSVR SERVER(*ALL)",
      "..."
    ]
  }
}
```

Read `confidence_score` and `matched_issue_id` (= `issue.id`) to drive the next action.

---

## Tool reference

### `collect_ibmi_extension_diagnostics`

| Parameter | Type | Required | Description |
|---|---|---|---|
| `mock` | boolean | No (default: false) | Return fixture data instead of reading live VS Code logs |
| `scenario` | string | No (default: mapepire-hang) | `port449` or `mapepire-hang` (alias `3239`) — which fixture to load in mock mode |

### `search_ibmi_github_issues`

| Parameter | Type | Required | Description |
|---|---|---|---|
| `keywords` | string | Yes | Symptom keywords to search, e.g. `"port 449 ECONNREFUSED"` |
| `mock` | boolean | No | Return mock fixture instead of calling GitHub API |

Set `GITHUB_TOKEN` environment variable for 5 000 req/hr (vs 60 unauthenticated).

### `match_ibmi_symptom`

| Parameter | Type | Required | Description |
|---|---|---|---|
| `diagnostic_json` | string | Yes | JSON string of a `DiagnosticResult` (as returned by `collect_ibmi_extension_diagnostics`) |

### `get_known_issues_registry`

No inputs. Returns the full `KnownIssue[]` array from `data/known-issues.json`.

---

## Environment variables

| Variable | Description |
|---|---|
| `GITHUB_TOKEN` | GitHub personal access token — raises API rate limit to 5 000 req/hr |
| `IBM_I_MOCK` | Set to `true` to force all tools into mock mode |
| `IBM_I_MOCK_SCENARIO` | Default mock scenario (`mapepire-hang` or `port449`) |

---

## Requirements

- Node.js >= 18
- Internet access for live GitHub search (mock mode works offline)

---

## License

MIT — see [LICENSE](../../LICENSE) in the repository root.

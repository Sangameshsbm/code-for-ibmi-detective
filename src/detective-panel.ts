/**
 * detective-panel.ts — IBM i Detective Webview panel controller
 *
 * Message protocol (extension host → Webview):
 *   { type: 'progress', step: number, total: number, label: string }
 *   { type: 'result',   payload: MatchResult & { issues: Issue[] } }
 *   { type: 'error',    message: string }
 *
 * Message protocol (Webview → extension host):
 *   { type: 'investigate', symptom: string }
 *   { type: 'copyIssue' }
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

import { collectDiagnostics }  from './pipeline/collect-diagnostics';
import { searchGitHubIssues, Issue }  from './pipeline/search-github-issues';
import { matchSymptom }        from './pipeline/match-symptom';

// ── Privacy contract ──────────────────────────────────────────────────────
// 1. DiagnosticResult (diagnostic) is a local variable in _runPipeline().
//    It is never written to disk, globalState, workspaceState, or SecretStorage.
// 2. The sanitised output_log is sent to the WebView for display only.
//    The WebView does not call vscode.setState() with diagnostic data.
// 3. The only data that crosses the network boundary is the user-typed symptom
//    string, sent to api.github.com after explicit per-session consent.
// 4. _githubConsentGranted is an in-memory session flag — not persisted.
// ─────────────────────────────────────────────────────────────────────────

const VIEW_TYPE = 'ibmiDetective';

export class DetectivePanel {
  /** Singleton — only one panel at a time. */
  public static currentPanel: DetectivePanel | undefined;

  private readonly _panel: vscode.WebviewPanel;
  private readonly _context: vscode.ExtensionContext;
  private _disposables: vscode.Disposable[] = [];

  // ── Factory ────────────────────────────────────────────────────────────────

  public static createOrShow(context: vscode.ExtensionContext): void {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // Reveal existing panel
    if (DetectivePanel.currentPanel) {
      DetectivePanel.currentPanel._panel.reveal(column);
      return;
    }

    // Create a new panel
    const panel = vscode.window.createWebviewPanel(
      VIEW_TYPE,
      'IBM i Detective',
      column ?? vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, 'media'),
        ],
      },
    );

    DetectivePanel.currentPanel = new DetectivePanel(panel, context);
  }

  /** Dispose the singleton panel (called from deactivate). */
  public static dispose(): void {
    DetectivePanel.currentPanel?.disposeInstance();
    DetectivePanel.currentPanel = undefined;
  }

  // ── Constructor ───────────────────────────────────────────────────────────

  private constructor(panel: vscode.WebviewPanel, context: vscode.ExtensionContext) {
    this._panel   = panel;
    this._context = context;

    this._update();

    // Message handler: Webview → extension host
    this._panel.webview.onDidReceiveMessage(
      async (message: { type: string; symptom?: string; githubConsent?: boolean }) => {
        if (message.type === 'investigate') {
          await this._runPipeline(message.symptom ?? '', message.githubConsent ?? false);
        }
      },
      null,
      this._disposables,
    );

    // Clean up on panel close
    this._panel.onDidDispose(
      () => this.disposeInstance(),
      null,
      this._disposables,
    );
  }

  // ── Pipeline ──────────────────────────────────────────────────────────────

  private async _runPipeline(symptom: string, githubConsent: boolean): Promise<void> {
    const send = (msg: unknown): void => {
      void this._panel.webview.postMessage(msg);
    };

    try {
      // Step 1: Collect diagnostics
      send({ type: 'progress', step: 1, total: 3, label: 'Collecting extension logs…' });
      const diagnostic = await collectDiagnostics(false);

      // Step 2: Search GitHub issues (only when user ticked the consent checkbox)
      // GitHub search failure is non-fatal — we continue with local matching.
      let issues: Issue[] = [];
      let githubWarning: string | undefined;
      if (githubConsent && symptom.trim()) {
        send({ type: 'progress', step: 2, total: 3, label: 'Searching GitHub issues…' });
        try {
          const token = await this._context.secrets.get('ibmiDetective.githubToken');
          issues = await searchGitHubIssues(symptom, token);
        } catch (githubErr) {
          githubWarning = `GitHub search unavailable: ${(githubErr as Error).message}`;
        }
      } else {
        send({ type: 'progress', step: 2, total: 3, label: 'GitHub search skipped…' });
      }

      // Step 3: Score confidence
      send({ type: 'progress', step: 3, total: 3, label: 'Scoring confidence…' });
      const matchResult = matchSymptom(diagnostic);

      // Send combined result
      // PRIVACY: output_log is already sanitised by sanitiseLog() in collect-diagnostics.ts
      send({ type: 'result', payload: { ...matchResult, issues, github_warning: githubWarning, sanitised_log_preview: diagnostic.output_log } });
    } catch (err) {
      send({ type: 'error', message: (err as Error).message });
    }
  }

  // ── Webview content ───────────────────────────────────────────────────────

  private _update(): void {
    this._panel.title   = 'IBM i Detective';
    this._panel.webview.html = this._getWebviewContent();
  }

  private _getWebviewContent(): string {
    const webview = this._panel.webview;
    const nonce   = crypto.randomBytes(16).toString('hex');

    // CSP: only allow scripts with matching nonce
    const csp = [
      `default-src 'none'`,
      `script-src 'nonce-${nonce}'`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `img-src ${webview.cspSource} data:`,
    ].join('; ');

    // Read the HTML template
    const htmlPath = path.join(
      this._context.extensionPath,
      'media',
      'detective-panel.html',
    );

    let html: string;
    try {
      html = fs.readFileSync(htmlPath, 'utf8');
    } catch {
      html = this._fallbackHtml(nonce);
    }

    // Inject nonce and CSP
    html = html
      .replace(/{{nonce}}/g, nonce)
      .replace(/{{csp}}/g, csp);

    return html;
  }

  /** Minimal fallback if media/detective-panel.html cannot be read. */
  private _fallbackHtml(nonce: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>IBM i Detective</title></head>
<body>
  <p>Error: could not load media/detective-panel.html. Please reinstall the extension.</p>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
  </script>
</body>
</html>`;
  }

  // ── Disposal ──────────────────────────────────────────────────────────────

  private disposeInstance(): void {
    DetectivePanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const d = this._disposables.pop();
      d?.dispose();
    }
  }
}

/**
 * extension.ts — IBM i Detective VS Code extension entry point
 *
 * Activation:
 *   - Checks whether Code for IBM i (halcyontech.vscode-ibmi) is installed
 *   - Shows an informational message if Code for IBM i is absent (soft dependency)
 *   - Registers the `ibmiDetective.investigate` command
 *   - Creates / reveals the DetectivePanel on command fire
 *
 * Deactivation:
 *   - Disposes the panel if open
 */

import * as vscode from 'vscode';
import { DetectivePanel } from './detective-panel';

const CODEFORI_EXTENSION_ID = 'halcyontech.vscode-ibmi';

export function activate(context: vscode.ExtensionContext): void {
  // Soft dependency: warn if Code for IBM i is not installed
  const codeForIbmi = vscode.extensions.getExtension(CODEFORI_EXTENSION_ID);
  if (!codeForIbmi) {
    vscode.window.showInformationMessage(
      'IBM i Detective works best with the Code for IBM i extension installed. ' +
      'Some log collection features will be limited without it.',
    );
  }

  // Register the investigate command
  const investigateCmd = vscode.commands.registerCommand(
    'ibmiDetective.investigate',
    () => {
      DetectivePanel.createOrShow(context);
    },
  );

  context.subscriptions.push(investigateCmd);
}

export function deactivate(): void {
  DetectivePanel.dispose();
}

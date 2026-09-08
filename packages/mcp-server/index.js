#!/usr/bin/env node
/**
 * index.js — IBM i Detective MCP Server
 *
 * Exposes four MCP tools over stdio transport:
 *   collect_ibmi_extension_diagnostics
 *   search_ibmi_github_issues
 *   match_ibmi_symptom
 *   get_known_issues_registry
 *
 * Usage:
 *   npx ibmi-detective-mcp
 *   node index.js
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { collectDiagnostics } from './tools/collect.js';
import { searchGitHubIssues } from './tools/search.js';
import { matchSymptom } from './tools/match.js';
import { getKnownIssuesRegistry } from './tools/registry.js';

// ── Tool definitions ─────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'collect_ibmi_extension_diagnostics',
    description:
      'Collect diagnostic data from the Code for IBM i VS Code extension logs. ' +
      'Use mock=true and a scenario to return pre-built fixture data without needing VS Code installed.',
    inputSchema: {
      type: 'object',
      properties: {
        mock: {
          type: 'boolean',
          description: 'When true, returns pre-built fixture data instead of reading live VS Code logs.',
        },
        scenario: {
          type: 'string',
          enum: ['port449', '3239', 'mapepire-hang'],
          description:
            'Fixture scenario to load in mock mode. ' +
            '"port449" = ECONNREFUSED on port 449, ' +
            '"3239" or "mapepire-hang" = Mapepire hang after upgrade.',
        },
      },
      required: [],
    },
  },
  {
    name: 'search_ibmi_github_issues',
    description:
      'Search codefori/vscode-ibmi GitHub issues for the given symptom keywords. ' +
      'Set GITHUB_TOKEN env var for higher rate limits (5000 req/hr vs 60).',
    inputSchema: {
      type: 'object',
      properties: {
        keywords: {
          type: 'string',
          description: 'Symptom keywords to search for, e.g. "port 449 ECONNREFUSED".',
        },
        mock: {
          type: 'boolean',
          description: 'When true, returns pre-built mock GitHub issue fixture data.',
        },
      },
      required: ['keywords'],
    },
  },
  {
    name: 'match_ibmi_symptom',
    description:
      'Match a DiagnosticResult JSON against the Known Issue Registry and return a confidence score. ' +
      'Pass the JSON string returned by collect_ibmi_extension_diagnostics as diagnostic_json.',
    inputSchema: {
      type: 'object',
      properties: {
        diagnostic_json: {
          type: 'string',
          description:
            'JSON string of a DiagnosticResult object (as returned by collect_ibmi_extension_diagnostics).',
        },
      },
      required: ['diagnostic_json'],
    },
  },
  {
    name: 'get_known_issues_registry',
    description:
      'Return the full Known Issue Registry — a curated list of common Code for IBM i problems ' +
      'with keywords, resolution steps, and GitHub issue links.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
];

// ── Server setup ─────────────────────────────────────────────────────────────

const server = new Server(
  { name: 'ibmi-detective', version: '0.1.0' },
  { capabilities: { tools: {} } },
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

// Dispatch tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'collect_ibmi_extension_diagnostics': {
        const mock     = Boolean(args?.mock ?? false);
        const scenario = String(args?.scenario ?? 'mapepire-hang');
        const result   = await collectDiagnostics(mock, scenario);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'search_ibmi_github_issues': {
        const keywords = String(args?.keywords ?? '');
        const mock     = Boolean(args?.mock ?? (process.env.IBM_I_MOCK === 'true'));
        const token    = process.env.GITHUB_TOKEN;
        const issues   = await searchGitHubIssues(keywords, token, mock);
        return {
          content: [{ type: 'text', text: JSON.stringify(issues, null, 2) }],
        };
      }

      case 'match_ibmi_symptom': {
        const raw        = String(args?.diagnostic_json ?? '{}');
        const diagnostic = JSON.parse(raw);
        const result     = matchSymptom(diagnostic);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'get_known_issues_registry': {
        const registry = getKnownIssuesRegistry();
        return {
          content: [{ type: 'text', text: JSON.stringify(registry, null, 2) }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Error: ${err.message}` }],
      isError: true,
    };
  }
});

// ── Start server ─────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();

process.on('SIGINT', async () => {
  await server.close();
  process.exit(0);
});

await server.connect(transport);

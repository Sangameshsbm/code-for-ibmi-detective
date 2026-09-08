// esbuild.js — bundles src/extension.ts → dist/extension.js
// Usage:
//   node esbuild.js             (development — sourcemap, no minify)
//   node esbuild.js --production (production — minify, no sourcemap)

const esbuild = require('esbuild');

const isProduction = process.argv.includes('--production');

esbuild.build({
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  target: 'node16',
  sourcemap: !isProduction,
  minify: isProduction,
  logLevel: 'info',
}).catch(() => process.exit(1));

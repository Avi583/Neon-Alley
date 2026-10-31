// Performance baseline: builds the game, walks a fixed camera path at a fixed
// preset and viewport, saves the numbers and compares them with the last saved
// run. Use it before and after each performance change, on the same machine.
//
//   npm run perf                          High preset, visible window
//   npm run perf -- --q=low --frames=300
//   npm run perf -- --headless            software rendering: for checking the script, not for timing
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from '@playwright/test';
import { build, preview } from 'vite';

const OUT_DIR = 'node_modules/.cache/perf-build'; // not docs/, which is the deployed site
const RESULTS_DIR = 'perf-results';
const PORT = 5198;
const VIEWPORT = { width: 1280, height: 720 };

const { values: args } = parseArgs({
  options: {
    q: { type: 'string', default: 'high' },
    frames: { type: 'string', default: '600' },
    headless: { type: 'boolean', default: false },
  },
});

function lastResult(q) {
  mkdirSync(RESULTS_DIR, { recursive: true });
  const names = readdirSync(RESULTS_DIR).filter((n) => n.endsWith(`-${q}.json`)).sort();
  return names.length ? JSON.parse(readFileSync(join(RESULTS_DIR, names.at(-1)), 'utf8')) : null;
}

function report(result, previous) {
  console.log(`\n${args.q} preset, ${result.frames} frames, ${result.gpu}`);
  for (const [k, v] of Object.entries(result)) {
    if (typeof v !== 'number' || k === 'frames') continue;
    const old = previous?.[k];
    const diff = old ? ` (${v >= old ? '+' : ''}${(((v - old) / old) * 100).toFixed(1)}%, was ${old})` : '';
    console.log(`  ${k.padEnd(12)} ${v}${diff}`);
  }
  if (previous && previous.gpu !== result.gpu) console.log('  Different GPU from the last run, so timings do not compare.');
}

const previous = lastResult(args.q);
await build({ logLevel: 'warn', build: { outDir: OUT_DIR, emptyOutDir: true } });
const server = await preview({ logLevel: 'warn', build: { outDir: OUT_DIR }, preview: { port: PORT, strictPort: true } });

const browser = await chromium.launch({ headless: args.headless });
try {
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://localhost:${PORT}/?q=${args.q}&bench=${args.frames}`);
  await page.waitForFunction(() => window.__bench, null, { timeout: 600_000 });
  const result = await page.evaluate(() => window.__bench);
  if (errors.length) throw new Error(`Page errors during the run:\n${errors.join('\n')}`);

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  writeFileSync(join(RESULTS_DIR, `${stamp}-${args.q}.json`), JSON.stringify(result, null, 2) + '\n');
  report(result, previous);
} finally {
  await browser.close();
  await server.close();
}

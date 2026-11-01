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
const VIEWPORT = { width: 1920, height: 1080 };

const { values: args } = parseArgs({
  options: {
    q: { type: 'string', default: 'high' },
    frames: { type: 'string', default: '600' },
    headless: { type: 'boolean', default: false },
    stall: { type: 'string', default: '180' }, // seconds without progress before giving up
  },
});
// A covered or background window gets throttled, which stalls the run and skews its timings.
// Without a frame cap the GPU stays busy, so its clocks stay up rather than dropping between frames.
const BROWSER_ARGS = [
  '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--disable-background-timer-throttling',
  '--disable-gpu-vsync', '--disable-frame-rate-limit',
];

// The newest saved run this one can be compared with: timings from another GPU
// or buffer size mean nothing here.
function lastResult(q, result) {
  mkdirSync(RESULTS_DIR, { recursive: true });
  const names = readdirSync(RESULTS_DIR).filter((n) => n.endsWith(`-${q}.json`)).sort().reverse();
  for (const name of names) {
    const old = JSON.parse(readFileSync(join(RESULTS_DIR, name), 'utf8'));
    if (old.gpu === result.gpu && old.buffer === result.buffer) return old;
  }
  return null;
}

function report(result, previous) {
  console.log(`\n${args.q} preset, ${result.frames} frames at ${result.buffer}, ${result.gpu}`);
  if (result.gpuMsAvg === null) console.log('  No GPU timer here, so only cpuMs and frameMs were measured.');
  if (!previous) console.log('  No earlier run with this GPU and buffer size to compare with.');
  for (const [k, v] of Object.entries(result)) {
    if (typeof v !== 'number' || k === 'frames') continue;
    const old = previous?.[k];
    const diff = old ? ` (${v >= old ? '+' : ''}${(((v - old) / old) * 100).toFixed(1)}%, was ${old})` : '';
    console.log(`  ${k.padEnd(12)} ${v}${diff}`);
  }
}

// Waits for the result, failing at the first page error or once neither the
// loading status nor the frame count has moved for the stall time. Generating a
// texture blocks the page, so a poll can take a while to answer.
async function waitForBench(page, errors) {
  const stallMs = Number(args.stall) * 1000;
  const check = () => page.evaluate(() => ({
    result: window.__bench,
    progress: `${document.getElementById('status').textContent} ${window.__benchFrame ?? ''}`,
  }));
  let lastProgress = null, lastChange = Date.now();
  for (;;) {
    const left = Math.max(lastChange + stallMs - Date.now(), 0);
    let timer;
    const state = await Promise.race([
      check(),
      new Promise((r) => { timer = setTimeout(r, left, null); }),
    ]);
    clearTimeout(timer);
    if (errors.length) throw new Error(`Page errors during the run:\n${errors.join('\n')}`);
    if (state?.result) return state.result;
    if (state && state.progress !== lastProgress) {
      lastProgress = state.progress;
      lastChange = Date.now();
    } else if (Date.now() - lastChange >= stallMs) {
      throw new Error(`Run stalled: no progress for ${args.stall} s, last at "${lastProgress}". A hidden or minimised window can cause this.`);
    }
    await new Promise((r) => setTimeout(r, 500));
  }
}

await build({ logLevel: 'warn', build: { outDir: OUT_DIR, emptyOutDir: true } });
const server = await preview({ logLevel: 'warn', build: { outDir: OUT_DIR }, preview: { port: PORT, strictPort: true } });

const browser = await chromium.launch({ headless: args.headless, args: BROWSER_ARGS });
try {
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('crash', () => errors.push('The page crashed.'));
  await page.goto(`http://localhost:${PORT}/?q=${args.q}&bench=${args.frames}`);
  const result = await waitForBench(page, errors);

  const previous = lastResult(args.q, result);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  writeFileSync(join(RESULTS_DIR, `${stamp}-${args.q}.json`), JSON.stringify(result, null, 2) + '\n');
  report(result, previous);
} finally {
  await browser.close();
  await server.close();
}

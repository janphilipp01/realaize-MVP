// Route smoke test — loads every app route and fails on any uncaught page
// error or empty main content. It does NOT assert on backend/network 500s
// (the API may be offline); it catches real render crashes and blank routes.
//
// Usage:
//   SMOKE_START_SERVER=1 node scripts/smoke.mjs      # spins up its own dev server
//   node scripts/smoke.mjs                            # against SMOKE_BASE_URL (default :5199)
//
// Env:
//   SMOKE_BASE_URL   default http://127.0.0.1:5199
//   SMOKE_START_SERVER=1  start a Vite dev server (VITE_AUTH_DISABLED) and stop it after
//   SMOKE_CHROMIUM   chromium executable (default /opt/pw-browsers/chromium)

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import net from 'node:net';

const BASE = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5199';
const PORT = Number(new URL(BASE).port || 80);
const CHROMIUM = process.env.SMOKE_CHROMIUM || '/opt/pw-browsers/chromium';
const START = process.env.SMOKE_START_SERVER === '1';

const ROUTES = [
  '/', '/cashflow', '/assets', '/developments', '/debt', '/sales',
  '/acquisition', '/radar', '/markt', '/market-intelligence',
  '/documents', '/ai', '/news', '/settings',
];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const portOpen = (port) =>
  new Promise((res) => {
    const s = net.connect(port, '127.0.0.1');
    s.on('connect', () => { s.destroy(); res(true); });
    s.on('error', () => res(false));
  });

let server;
async function startServer() {
  server = spawn('npx', ['vite', '--config', 'vite.config.ts', '--host', '127.0.0.1', '--port', String(PORT)], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(PORT), BASE_PATH: '/', VITE_AUTH_DISABLED: 'true' },
    stdio: 'ignore',
  });
  for (let i = 0; i < 40; i++) {
    if (await portOpen(PORT)) return;
    await wait(500);
  }
  throw new Error('dev server did not start');
}

async function main() {
  if (START) await startServer();
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const failures = [];

  for (const route of ROUTES) {
    const errors = [];
    const onErr = (e) => errors.push(String(e?.message || e));
    page.on('pageerror', onErr);
    try {
      await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await wait(1200);
      const bodyLen = await page.evaluate(() => document.body?.innerText?.trim().length || 0);
      if (errors.length) failures.push(`${route}: pageerror → ${errors[0]}`);
      else if (bodyLen < 40) failures.push(`${route}: empty main content (len ${bodyLen})`);
      else console.log(`OK  ${route}  (${bodyLen} chars)`);
    } catch (e) {
      failures.push(`${route}: ${e.message}`);
    }
    page.off('pageerror', onErr);
  }

  await browser.close();
  if (START && server) server.kill();

  if (failures.length) {
    console.error('\nSMOKE FAILURES:\n' + failures.join('\n'));
    process.exit(1);
  }
  console.log('\nSMOKE PASS — all routes rendered without page errors.');
}

main().catch((e) => {
  if (START && server) server.kill();
  console.error(e);
  process.exit(1);
});

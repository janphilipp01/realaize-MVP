// Interaction tests — drive the high-value user flows end-to-end in a real
// browser and assert on behaviour (not just that a page renders, which is what
// smoke.mjs covers). Reuses the already-installed Playwright; no extra deps.
//
// Usage:
//   INT_START_SERVER=1 node scripts/interaction.mjs      # spins up its own dev server
//   node scripts/interaction.mjs                          # against INT_BASE_URL (default :5290)
//
// Env:
//   INT_BASE_URL      default http://127.0.0.1:5290
//   INT_START_SERVER=1  start a Vite dev server (VITE_AUTH_DISABLED) and stop it after
//   SMOKE_CHROMIUM    chromium executable (default /opt/pw-browsers/chromium)

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import net from 'node:net';

const BASE = process.env.INT_BASE_URL || 'http://127.0.0.1:5290';
const PORT = Number(new URL(BASE).port || 80);
const CHROMIUM = process.env.SMOKE_CHROMIUM || '/opt/pw-browsers/chromium';
const START = process.env.INT_START_SERVER === '1';

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
  for (let i = 0; i < 60; i++) {
    if (await portOpen(PORT)) return;
    await wait(500);
  }
  throw new Error('dev server did not start');
}

// Find and click a <button> whose trimmed text exactly equals `label`.
const clickButton = (page, label) =>
  page.evaluate((l) => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').trim() === l);
    if (b) { b.click(); return true; }
    return false;
  }, label);

async function newPage(browser) {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e?.message || e)));
  return { page, errors };
}

// ── Flow 1: create a deal through the wizard ────────────────────────────────
async function flowWizardCreate(browser) {
  const { page, errors } = await newPage(browser);
  const name = `PWTEST-${Date.now()}`;
  await page.goto(`${BASE}/acquisition`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => /Neue?r Deal|Deal erfassen/.test(b.textContent || '')), { timeout: 15000 });
  if (!(await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /Neue?r Deal|Deal erfassen/.test(x.textContent || '')); if (b) { b.click(); return true; } return false; })))
    throw new Error('new-deal trigger not found');
  await page.waitForFunction(() => /Stammdaten/.test(document.body.innerText), { timeout: 10000 });
  // Objektname is the first Field in the wizard; scope to its label so we don't
  // grab the /acquisition search box (which appears earlier in the DOM).
  await page.locator('label:has-text("Objektname") + input').fill(name);
  if (!(await clickButton(page, 'Speichern'))) throw new Error('wizard Speichern button not found');
  // handleCreateDeal navigates to /acquisition/<id>; assert we landed on the new deal
  await page.waitForFunction((n) => /\/acquisition\/deal-/.test(location.pathname) && document.body.innerText.includes(n), name, { timeout: 10000 });
  const landedPath = new URL(page.url()).pathname;
  await page.close();
  if (errors.length) throw new Error(`page error: ${errors[0]}`);
  return `created "${name}" → ${landedPath}`;
}

// ── Flow 2: edit + save a deal's underwriting assumptions ───────────────────
async function flowDealEditSave(browser) {
  const { page, errors } = await newPage(browser);
  await page.goto(`${BASE}/acquisition/deal-001`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForFunction(() => document.body.innerText.length > 300, { timeout: 15000 });
  if (!(await clickButton(page, 'Underwriting'))) throw new Error('Underwriting tab not found');
  await wait(250);
  if (!(await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /Bearbeiten/.test(x.textContent || '')); if (b) { b.click(); return true; } return false; })))
    throw new Error('Bearbeiten button not found');
  await wait(250);
  await page.locator('input[type=number]').first().fill('4321');
  if (!(await clickButton(page, 'Speichern'))) throw new Error('underwriting Speichern not found');
  // save exits edit mode → "Bearbeiten" is visible again
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => /Bearbeiten/.test(b.textContent || '')), { timeout: 8000 });
  await page.close();
  if (errors.length) throw new Error(`page error: ${errors[0]}`);
  return 'underwriting edit → save round-trips (edit mode exits, no errors)';
}

// ── Flow 3: development detail — switch through every tab ────────────────────
async function flowDevDetailTabs(browser) {
  const { page, errors } = await newPage(browser);
  const tabs = ['Übersicht', 'Rent Roll', 'Kosten & Budget', 'Gantt', 'Debt', 'Valuation', 'Construction Advisor', 'Hold / Sell', 'Cash Flow / IRR', 'Bilder', 'Dokumente'];
  await page.goto(`${BASE}/developments/dev-002`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForFunction(() => document.body.innerText.length > 300, { timeout: 15000 });
  let switched = 0;
  for (const label of tabs) {
    // tabs may render a trailing count (e.g. "Rent Roll 5"), so match by prefix
    const ok = await page.evaluate((l) => {
      const b = [...document.querySelectorAll('button,[role=tab]')].find((x) => (x.textContent || '').trim().startsWith(l));
      if (b) { b.click(); return true; }
      return false;
    }, label);
    if (ok) { switched++; await wait(120); }
  }
  const len = await page.evaluate(() => document.body.innerText.length);
  await page.close();
  if (errors.length) throw new Error(`page error: ${errors[0]}`);
  if (switched < 6) throw new Error(`only ${switched}/${tabs.length} dev tabs were clickable`);
  return `switched ${switched}/${tabs.length} development tabs, no errors (body ${len})`;
}

async function main() {
  if (START) await startServer();
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  const flows = [
    ['wizard-create', flowWizardCreate],
    ['deal-edit-save', flowDealEditSave],
    ['dev-detail-tabs', flowDevDetailTabs],
  ];
  const failures = [];
  for (const [name, fn] of flows) {
    try {
      const msg = await fn(browser);
      console.log(`OK  ${name}  —  ${msg}`);
    } catch (e) {
      failures.push(`${name}: ${e.message}`);
      console.log(`FAIL  ${name}  —  ${e.message}`);
    }
  }
  await browser.close();
  if (START && server) server.kill();
  if (failures.length) {
    console.error('\nINTERACTION FAILURES:\n' + failures.join('\n'));
    process.exit(1);
  }
  console.log('\nINTERACTION PASS — all flows behaved as expected.');
}

main().catch((e) => {
  if (START && server) server.kill();
  console.error(e);
  process.exit(1);
});

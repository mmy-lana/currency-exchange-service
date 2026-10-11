import puppeteer from 'puppeteer';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5173';
const MOBILE_VIEWPORTS = [
  { width: 360, height: 640 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
];

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    passed += 1;
    console.log(`PASS: ${label}`);
  } else {
    failed += 1;
    console.error(`FAIL: ${label}`);
  }
}

function section(name) {
  console.log(`\n=== ${name} ===`);
}

async function dismissGuide(page) {
  const visible = await page.$('[role="dialog"][aria-label="Platform Guide"]');
  if (visible) {
    await page.click('[data-testid="guide-finish"], button[aria-label="Close guide"]');
    await new Promise((r) => setTimeout(r, 250));
  }
}

async function testFrontendLoads(browser) {
  section('Frontend load and console hygiene');
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    // net::ERR_ABORTED is emitted when the app intentionally cancels a
    // superseded in-flight request via AbortController (300ms debounce).
    if (msg.text().includes('net::ERR_ABORTED')) return;
    consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(String(err)));

  await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 20000 });
  await dismissGuide(page);

  const title = await page.$eval('h1', (el) => el.textContent);
  assert(title && title.includes('FinTech FX Exchange'), 'Frontend renders dashboard heading');
  assert(
    !consoleErrors.some((e) => e.includes('NetworkError') || e.includes('Failed to fetch')),
    'No NetworkError / fetch failures in console'
  );
  assert(consoleErrors.length === 0, `Zero unhandled console errors (found: ${consoleErrors.length})`);
  await page.close();
}

async function testPlatformGuide(browser) {
  section('Platform Guide');
  await page_reduceGuideState(browser);
}

async function page_reduceGuideState(browser) {
  const page = await browser.newPage();
  await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 20000 });
  await page.evaluate(() => localStorage.setItem('fintech-fx:platform-guide-seen', '1'));

  // Open via header button
  await page.click('header button');
  await page.waitForSelector('[role="dialog"][aria-label="Platform Guide"]', { timeout: 5000 });
  assert(true, 'Guide opens from header button');

  const step1 = await page.$eval('[role="dialog"] h2', (el) => el.textContent);
  assert(step1.includes('USD Base Anchor'), 'Step 1 is USD Base Anchor');

  // Deterministic navigation: click the Next button by text
  let currentStep = step1;
  for (let i = 0; i < 3; i++) {
    const clicked = await page.evaluate(() => {
      const buttons = [...document.querySelectorAll('[role="dialog"] button')];
      const next = buttons.find((b) => b.textContent.trim() === 'Next');
      if (next) { next.click(); return true; }
      return false;
    });
    if (!clicked) break;
    await new Promise((r) => setTimeout(r, 150));
    currentStep = await page.$eval('[role="dialog"] h2', (el) => el.textContent);
  }
  assert(
    currentStep.includes('System Status'),
    `Navigation advances through all steps (final: ${currentStep})`
  );

  // Close via Escape
  await page.keyboard.press('Escape');
  await new Promise((r) => setTimeout(r, 200));
  const stillOpen = await page.$('[role="dialog"]');
  assert(!stillOpen, 'Escape closes the guide');
  await page.close();
}

async function testConverter(browser) {
  section('Live Currency Converter');
  const page = await browser.newPage();
  await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 20000 });
  await dismissGuide(page);

  await page.waitForSelector('#convert-amount', { timeout: 10000 });
  await page.evaluate(() => document.querySelector('#convert-amount').select());
  await page.type('#convert-amount', '2500');

  // Wait past the 300ms debounce for the converted amount to render.
  await page.waitForFunction(
    () => {
      const el = document.querySelector('[data-testid="copy-converted"]');
      return Boolean(el);
    },
    { timeout: 8000 }
  );
  // Compute the expected converted display value from the quoted unit rate.
  await page.waitForFunction(
    () => /1 USD = \d+\.\d+ EUR/.test(document.body.innerText),
    { timeout: 8000 }
  );
  const unitRateText = await page.evaluate(() => {
    const match = document.body.innerText.match(/1 USD = (\d+\.\d+) EUR/);
    return match ? match[1] : null;
  });
  const expected = (2500 * Number(unitRateText)).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
  const bodyText = await page.evaluate(() => document.body.innerText);
  assert(bodyText.includes(expected), `Converted amount displays expected value (${expected})`);
  assert(!bodyText.includes('NetworkError'), 'Conversion completes without NetworkError');
  assert(/\d[\d,\.]*\s*EUR/.test(bodyText), 'Converted amount renders with target currency');

  const before = await page.$eval('#from-currency-select', (el) => el.value)
    + '->' + await page.$eval('#to-currency-select', (el) => el.value);
  await page.click('button[aria-label="Swap Currencies"]');
  await new Promise((r) => setTimeout(r, 600));
  const after = await page.$eval('#from-currency-select', (el) => el.value)
    + '->' + await page.$eval('#to-currency-select', (el) => el.value);
  assert(before === 'USD->EUR' && after === 'EUR->USD', `Swap switches pair (${before} => ${after})`);
  await page.close();
}

async function testHistorical(browser) {
  section('Historical Analytics');
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 20000 });
  await dismissGuide(page);

  await page.click('[data-testid="range-90D"]');
  await page.waitForSelector('svg polyline', { timeout: 15000 });
  const poly = await page.$eval('svg polyline', (el) => el.getAttribute('points'));
  const hasNonZero = /\d+\.\d+,\d+\.\d+/.test(poly) && poly.split(' ').length > 5;
  assert(hasNonZero, 'SVG chart polyline renders with non-zero coordinates');

  // Scrub across the chart and confirm active value updates.
  const containerBox = await page.evaluate(() => {
    const r = document.querySelector('svg polyline').closest('div').getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
  const startX = containerBox.x + 20;
  const endX = containerBox.x + containerBox.width - 20;
  const y = containerBox.y + containerBox.height / 2;
  const readSelected = () => page.evaluate(() => {
    const labels = [...document.querySelectorAll('div')].map((d) => d.textContent);
    return labels.find((t) => t && t.startsWith('Selected:')) || '';
  });
  await page.mouse.move(startX, y);
  await new Promise((r) => setTimeout(r, 300));
  const startValue = await readSelected();
  await page.mouse.move(endX, y, { steps: 12 });
  await new Promise((r) => setTimeout(r, 300));
  const endValue = await readSelected();
  assert(
    startValue !== endValue && startValue.includes('Selected:') && endValue.includes('Selected:'),
    `Scrubbing updates active value (${startValue} -> ${endValue})`
  );
  await page.close();
}

async function testMobileViewports(browser) {
  section('Mobile viewports');
  for (const viewport of MOBILE_VIEWPORTS) {
    const page = await browser.newPage();
    await page.setViewport(viewport);
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 20000 });
    await dismissGuide(page);

    const scrollOk = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1
    );
    assert(scrollOk, `${viewport.width}x${viewport.height}: no horizontal overflow`);

    const targetsOk = await page.evaluate(() => {
      const els = [...document.querySelectorAll('button, select, input, a[role="button"]')];
      return els
        .filter((el) => el.offsetParent !== null)
        .every((el) => {
          const r = el.getBoundingClientRect();
          return r.width >= 44 && r.height >= 44;
        });
    });
    assert(targetsOk, `${viewport.width}x${viewport.height}: all interactive targets meet min size`);
    await page.close();
  }
}

async function main() {
  console.log(`E2E verification against ${BASE_URL}`);
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    await testFrontendLoads(browser);
    await testPlatformGuide(browser);
    await testConverter(browser);
    await testHistorical(browser);
    await testMobileViewports(browser);
  } finally {
    await browser.close();
  }

  console.log(`\n=== RESULTS: ${passed} passed, ${failed} failed ===`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('E2E runner crashed:', err);
  process.exit(1);
});

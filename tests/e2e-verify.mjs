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

  // Focus trap: tabbing forward from the last focusable element cycles back
  // into the dialog instead of escaping to the obscured dashboard.
  const trapped = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return false;
    const focusable = dialog.querySelectorAll('button');
    const last = focusable[focusable.length - 1];
    last.focus();
    return document.activeElement === last;
  });
  assert(trapped, 'Focus can move to the last dialog control');
  await page.keyboard.press('Tab');
  const focusStayedInDialog = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    return Boolean(dialog && dialog.contains(document.activeElement));
  });
  assert(focusStayedInDialog, 'Tab is trapped inside the dialog');

  const step1 = await page.$eval('[role="dialog"] h2', (el) => el.textContent);
  assert(step1.includes('System Architecture & USD Anchor'), 'Step 1 is System Architecture & USD Anchor');

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
    currentStep.includes('Financial Precision & Security'),
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


async function testIdentityAndRateLimits(browser) {
  section('Identity conversion and rate limiting headers');
  const page = await browser.newPage();
  // This page only exercises /v1/convert via fetch: abort its automatic
  // historical series load to preserve the 10 req/min historical budget for
  // the dedicated historical suites.
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    if (req.url().includes('/v1/rates/historical')) {
      req.abort('failed').catch(() => {});
    } else {
      req.continue().catch(() => {});
    }
  });
  await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 20000 });
  await dismissGuide(page);

  // Identity conversion via the same-origin API path: exact 1:1 semantics.
  const identity = await page.evaluate(async () => {
    const response = await fetch('/v1/convert?from=USD&to=USD&amount=10000');
    return {
      headers: {
        limit: response.headers.get('X-RateLimit-Limit'),
        remaining: response.headers.get('X-RateLimit-Remaining'),
      },
      body: await response.json(),
    };
  });
  assert(identity.body.data.unitRate === '1.00000000', 'Identity unit rate is exactly 1.00000000');
  assert(identity.body.data.convertedAmount === '10000.00', 'Identity converted amount equals input');
  assert(identity.headers.limit === '60', `Rate limit header present (X-RateLimit-Limit=${identity.headers.limit})`);
  assert(identity.headers.remaining !== null, 'Rate limit remaining header present');

  // Identity historical assertions run in the Node-side suite below to keep
  // the browser IP's 10 req/min historical budget for the UI suites.
  await page.close();
}


async function testProxyIpIsolation(browser) {
  section('Proxy IP rate limiter isolation');
  // Browser fetch forbids setting X-Forwarded-For, so proxy-header semantics
  // are exercised from the Node runtime against the mapped API port.
  const apiBase = process.env.E2E_API_URL || 'http://localhost:8000';
  const ipA = '203.0.113.195';
  const ipB = '198.51.100.42';

  const first = await fetch(`${apiBase}/v1/convert?from=USD&to=EUR&amount=1`, {
    headers: { 'X-Forwarded-For': ipA },
  });
  const limitA = first.headers.get('X-RateLimit-Limit');
  const remainingA = first.headers.get('X-RateLimit-Remaining');
  assert(limitA === '60', `Proxy IP bucket uses the 60 req/min limit (${limitA})`);
  assert(remainingA === '58' || remainingA === '59', `Proxy IP quota decrements independently (${remainingA})`);
  await first.json();

  const second = await fetch(`${apiBase}/v1/convert?from=USD&to=EUR&amount=1`, {
    headers: { 'X-Forwarded-For': ipB },
  });
  const remainingB = second.headers.get('X-RateLimit-Remaining');
  assert(remainingB === '59', `Second proxy IP receives a fresh quota (${remainingB})`);
  await second.json();

  // Identity historical timeseries from an isolated proxy IP: flat 1.0000
  // series resolved without any upstream vendor call.
  const identityHistory = await fetch(`${apiBase}/v1/rates/historical?base=USD&target=USD&range=7D`, {
    headers: { 'X-Forwarded-For': ipB },
  });
  const histLimit = identityHistory.headers.get('X-RateLimit-Limit');
  const identityHistoryBody = await identityHistory.json();
  assert(identityHistoryBody.success === true, 'Identity historical series succeeds');
  assert(
    identityHistoryBody.data.minRate === 1.0 &&
      identityHistoryBody.data.maxRate === 1.0 &&
      identityHistoryBody.data.averageRate === 1.0 &&
      identityHistoryBody.data.percentageChange === 0.0,
    'Identity historical metrics are exactly 1.0 / 0.0'
  );
  assert(
    identityHistoryBody.data.points.every((pt) => pt.rate === 1.0),
    'Identity historical points are all exactly 1.0'
  );
  assert(histLimit === '10', `Historical rate limit header present (X-RateLimit-Limit=${histLimit})`);
}

async function testImmutableHistoricalPersistence(browser) {
  section('Immutable historical persistence');
  const page = await browser.newPage();
  await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 20000 });
  await dismissGuide(page);

  const query = async () => page.evaluate(async () => {
    const response = await fetch('/v1/rates/historical?base=EUR&target=GBP&range=30D');
    const envelope = await response.json();
    return { meta: envelope.meta, data: envelope.data };
  });

  const first = await query();
  assert(first.data && first.data.points.length > 0, 'EUR/GBP 30D series resolves with data points');
  const second = await query();
  assert(second.meta.cached === true, 'Re-request resolves from local cache (meta.cached=true)');
  assert(
    JSON.stringify(first.data.points) === JSON.stringify(second.data.points),
    'Cached series is identical to the first resolution'
  );
  await page.close();
}

async function testErrorRetryRecovery(browser) {
  section('Error boundary and retry recovery');
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  let blockConvert = true;
  page.on('request', (req) => {
    if (blockConvert && req.url().includes('/v1/convert')) {
      req.abort('failed').catch(() => {});
    } else if (req.url().includes('/v1/rates/historical')) {
      req.abort('failed').catch(() => {});
    } else {
      req.continue().catch(() => {});
    }
  });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await new Promise((r) => setTimeout(r, 2500));
  const dlg = await page.$('[role="dialog"]');
  if (dlg) {
    await page.keyboard.press('Escape');
    await new Promise((r) => setTimeout(r, 300));
  }

  const sawError = await page.waitForFunction(
    () => document.body.innerText.includes('Conversion Unavailable') && document.body.innerText.includes('Retry Request'),
    { timeout: 10000 }
  ).then(() => true).catch(() => false);
  assert(sawError, 'Degraded state renders error alert with Retry Request button');

  blockConvert = false;
  await page.evaluate(() => {
    const buttons = [...document.querySelectorAll('button')];
    const retry = buttons.find((b) => b.textContent.trim() === 'Retry Request');
    if (retry) retry.click();
  });
  const recovered = await page.waitForFunction(
    () => Boolean(document.querySelector('[data-testid="copy-converted"]')),
    { timeout: 10000 }
  ).then(() => true).catch(() => false);
  assert(recovered, 'Retry Request recovers into a successful conversion');
  await page.close();
}

async function testMobileViewports(browser) {
  section('Mobile viewports');
  {
    const page = await browser.newPage();
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 20000 });
    await dismissGuide(page);
    for (const viewport of MOBILE_VIEWPORTS) {
      // Resize the same page instead of reloading: keeps the per-IP historical
      // request budget intact while revalidating layout at every viewport.
      await page.setViewport(viewport);
      await new Promise((r) => setTimeout(r, 400));

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
    }
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
    await testProxyIpIsolation(browser);
    await testIdentityAndRateLimits(browser);
    await testHistorical(browser);
    await testImmutableHistoricalPersistence(browser);
    await testErrorRetryRecovery(browser);
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

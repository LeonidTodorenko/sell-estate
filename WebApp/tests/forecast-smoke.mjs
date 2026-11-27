import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { forecastFixture, propertyId } from './forecast-fixture.mjs';

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:4175';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const errors = [];
const requests = [];
let mode = 'ready';
let releaseSlow;
const slowResponse = new Promise(resolve => { releaseSlow = resolve; });
try {
  for (const width of [1440, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 950 }, colorScheme: 'light', hasTouch: width < 500 });
    const page = await context.newPage();
    let releaseInitial;
    const initialResponse = new Promise(resolve => { releaseInitial = resolve; });
    page.on('pageerror', error => errors.push(error.message));
    await context.addInitScript(() => {
      const claims = btoa(JSON.stringify({ sub: 'fixture-investor', exp: 9999999999 }));
      localStorage.setItem('ownersclub.web.session.v1', JSON.stringify({
        accessToken: `header.${claims}.signature`, refreshToken: 'fixture-refresh', user: { id: 'fixture-investor' },
      }));
    });
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin === new URL(base).origin && !url.pathname.startsWith('/api/')) return route.continue();
      const send = (json, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(json) });
      if (url.pathname === `/api/properties/${propertyId}/investment-forecast`) {
        assert.equal(url.origin, process.env.SMOKE_API_ORIGIN || 'https://sell-estate.onrender.com');
        assert.equal(route.request().method(), 'POST');
        assert.match(route.request().headers().authorization, /^Bearer /);
        const body = route.request().postDataJSON();
        requests.push(body);
        if (body.shares === 1) await initialResponse;
        assert.deepEqual(body.horizons, [1, 3, 5, 10]);
        if (mode === 'error') return send({ message: 'Fixture unavailable' }, 503);
        if (body.shares === 3) await slowResponse;
        return send(forecastFixture(body));
      }
      if (!url.pathname.startsWith('/api/')) {
        errors.push(`Unexpected external request: ${url.origin}${url.pathname}`);
        return route.abort();
      }
      assert.equal(route.request().method(), 'GET');
      if (url.pathname.endsWith('/buyback-price')) return send({ buybackPrice: width === 320 ? null : 850 });
      if (url.pathname === '/api/properties') return send([{
        id: propertyId, title: 'Demo · Marina Residence (synthetic fixture)', location: 'Lisbon, Portugal', listingType: 'rental',
        status: 'available', about: 'Waterfront residences', price: 100000, totalShares: 100, availableShares: 24,
      }]);
      if (url.pathname.startsWith('/api/investment-workflow/properties/')) return send({ mode: 'immediate', pricePerShare: 1000, availableShares: 24, stages: [] });
      if (url.pathname.includes('/users/fixture-investor')) return send({ id: 'fixture-investor' });
      return send([]);
    });

    await page.goto(`${base}/properties/${propertyId}`, { waitUntil: 'domcontentloaded' });
    const planner = page.getByRole('region', { name: 'Investment Planner' });
    await planner.getByText('Calculating scenarios…').waitFor();
    releaseInitial();
    const value = planner.getByRole('region', { name: 'Value of your share position' });
    const cash = planner.getByRole('region', { name: 'Expected rent' });
    await value.waitFor();
    assert.equal(await value.locator('svg path').count(), 2);
    assert.match(await planner.innerText(), /Prices can fall.*lose money/);
    assert.match(await cash.innerText(), /Start date unknown/);
    const buybackPrice = width === 320 ? 'Saved buyback price unavailable.' : '$850.00';
    await planner.getByText(buybackPrice, { exact: true }).waitFor();
    assert.equal(await planner.getByRole('heading', { name: /Stress scenario/ }).isVisible(), false);

    const count = requests.length;
    for (const years of [1, 3, 5, 10]) {
      await planner.getByRole('button', { name: new RegExp(`^${years} years?$`) }).click();
      const point = value.getByRole('button', { name: `Year ${years}`, exact: true });
      if (width >= 500) await point.focus(); else await point.tap();
      assert.equal(await point.getAttribute('aria-pressed'), 'true');
      assert.match(await value.locator('.forecast-point').innerText(), new RegExp(String(2026 + years)));
    }
    assert.equal(requests.length, count);
    await planner.getByText('Risks & assumptions', { exact: true }).click();
    await planner.getByRole('heading', { name: /Stress scenario/ }).waitFor();
    await planner.getByLabel('Base growth (%)').fill('-5');
    await planner.getByLabel('Assumed rental start').fill('2028-05-27');
    await planner.getByLabel('Shares to model').fill('2');
    await planner.getByRole('button', { name: '1 year', exact: true }).click();
    await planner.getByText('2 shares · $1,000.00 per share').waitFor();
    assert.equal(requests.at(-1).growth.base, -5);
    assert.equal(requests.at(-1).rent.startDate, '2028-05-27');
    await cash.getByRole('button', { name: /Year 1/ }).click();
    assert.match(await cash.locator('.forecast-point').innerText(), /No accrual by this date/);
    assert.match(await cash.innerText(), /Assumed rental start 2028-05-27/);
    assert.doesNotMatch(await planner.innerText(), /Scheduled payment|Accumulated cash flow/);
    assert.match(await planner.innerText(), /Full cost is debited/);
    await planner.getByRole('button', { name: '5 years', exact: true }).click();
    await cash.getByRole('button', { name: /Year 3/ }).click();
    await cash.locator('.forecast-point').getByText('After the assumed start', { exact: true }).waitFor();
    assert.doesNotMatch(await cash.innerText(), /Gross rent|Net rent|\$60\.00/);

    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `page overflow at ${width}px`);

    if (process.env.FORECAST_SCREENSHOTS) {
      await planner.getByLabel('Base growth (%)').fill('6');
      await planner.getByLabel('Optimistic growth (%)').fill('10');
      await planner.getByLabel('Assumed rental start').fill('2027-05-27');
      await planner.getByLabel('Assumed club fee (%)').fill('10');
      await planner.getByRole('button', { name: '5 years', exact: true }).click();
      await value.getByText('Base (6%/yr)', { exact: true }).first().waitFor();
      await planner.getByRole('region', { name: 'Conditional rental income' }).getByText('After assumed club fee', { exact: true }).first().waitFor();
      await planner.evaluate(node => {
        const label = document.createElement('p');
        label.textContent = 'Demo · Synthetic test data · Illustrative rates';
        label.className = 'forecast-risk';
        node.prepend(label);
      });
      await mkdir(process.env.FORECAST_SCREENSHOTS, { recursive: true });
      const name = width >= 500 ? 'desktop-1440' : `mobile-${width}`;
      await planner.screenshot({ path: join(process.env.FORECAST_SCREENSHOTS, `investment-planner-${name}.png`) });
    }

    if (width === 1440) {
      const slowStarted = page.waitForRequest(request => request.url().endsWith('/investment-forecast') && request.postDataJSON().shares === 3);
      await planner.getByLabel('Shares to model').fill('3');
      await slowStarted;
      assert.equal(await value.isVisible(), false);
      await planner.getByLabel('Shares to model').fill('4');
      await planner.getByText('4 shares · $1,000.00 per share').waitFor();
      releaseSlow();
      await planner.getByLabel('Shares to model').fill('101');
      await planner.getByText(/Enter a whole number of shares/).waitFor();
      mode = 'error';
      await planner.getByLabel('Shares to model').fill('5');
      await planner.getByRole('alert').getByText('Fixture unavailable').waitFor();
      mode = 'ready';
      await planner.getByRole('button', { name: 'Retry forecast' }).click();
      await planner.getByText('5 shares · $1,000.00 per share').waitFor();
    }
    await context.close();
  }
  assert.deepEqual(errors, []);
  console.log('Forecast browser smoke passed at 1440px, 390px and 320px.');
} finally {
  releaseSlow();
  await browser.close();
}

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:4176';
const { PLANNER_TEST_ORIGIN: backend, PLANNER_TEST_ACTOR: actor, PLANNER_TEST_AUTH: auth } = process.env;
assert.equal(new URL(backend).hostname, '127.0.0.1');
const everywhere = process.env.AI_EVERYWHERE_SMOKE === '1';
const property = process.env.PLANNER_TEST_PROPERTY;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  for (const width of [1440, 390, 320]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, hasTouch: width < 500 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(({ actor, token, demo }) => localStorage.setItem('ownersclub.web.session.v1', JSON.stringify({
      accessToken: token, user: { id: actor }, isDemo: demo,
    })), { actor, token: auth.split(' ')[1], demo: everywhere });
    const replies = [];
    const reads = new Map();
    await page.route('**/*', async route => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin === origin && !url.pathname.startsWith('/api/')) return route.continue();
      if (url.pathname === '/api/assistant/ask' && request.method() === 'POST') {
        const response = await route.fetch({ url: new URL(url.pathname, backend).href, headers: {
          authorization: auth, 'content-type': 'application/json',
        } });
        assert.equal(response.status(), 200);
        replies.push(await response.json());
        return route.fulfill({ response });
      }
      if (everywhere && request.method() === 'GET') {
        if (url.pathname.startsWith('/api/investment-workflow/properties/')) return route.fulfill({ json: { stages: [] } });
        if (url.pathname === '/api/properties') return route.fulfill({ json: [{
          id: property, title: 'Demo Marina Residence', location: 'Test', status: 'available',
          price: 100000, totalShares: 100, availableShares: 80,
        }] });
        if (url.pathname.startsWith('/api/assistant/') || url.pathname === '/api/demo/monthly-reports') {
          const response = await route.fetch({ url: new URL(url.pathname, backend).href, headers: { authorization: auth } });
          assert.equal(response.status(), 200);
          reads.set(url.pathname, await response.json());
          return route.fulfill({ response });
        }
      }
      if (request.method() === 'GET' && url.pathname.startsWith('/api/')) return route.fulfill({ json: [] });
      return route.abort();
    });
    await page.goto(`${origin}/assistant`);
    const input = page.getByRole('textbox', { name: 'Ask about OwnersClub' });
    await input.fill('Show a forecast for Demo Marina Residence, 2 shares, 5 years' + (everywhere ? '' : ', rates -10 6 10'));
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    const log = page.getByRole('log');
    const chart = log.getByRole('region', { name: 'Scenario value', exact: true });
    await chart.first().waitFor();
    assert.equal(replies[0].forecast.data.shares, 2);
    await input.fill('Make it 4 shares and 7 years');
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    const answer = log.locator('.assistant-turn').last();
    await answer.getByText('4 shares · Upfront cost').waitFor();
    assert.equal(replies[1].forecast.horizon, 7);
    assert.equal(await answer.getByRole('button', { name: '7 years', exact: true }).getAttribute('aria-pressed'), 'true');
    assert.equal(await log.locator('.assistant-turn').first().getByRole('button', { name: '5 years', exact: true }).getAttribute('aria-pressed'), 'true');
    await answer.getByRole('button', { name: '3 years', exact: true }).click();
    assert.equal(await answer.getByRole('button', { name: '3 years', exact: true }).getAttribute('aria-pressed'), 'true');
    await answer.getByRole('button', { name: '7 years', exact: true }).click();
    assert.equal(replies.length, 2);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.deepEqual(errors, []);
    if (process.env.FORECAST_SCREENSHOTS) {
      await mkdir(process.env.FORECAST_SCREENSHOTS, { recursive: true });
      await page.locator('.assistant-page').screenshot({
        path: join(process.env.FORECAST_SCREENSHOTS, `demo-ai-dialog-${width}.png`),
        style: '.assistant-history { max-height: none; overflow: visible; }',
      });
    }
    if (everywhere) {
      assert.equal(replies[1].forecast.demo, true);
      assert.equal(replies[1].forecast.source, 'Demo fixture assumptions');
      assert.equal(await chart.last().getByText(/Stress/).count(), 0);
      await answer.getByText('Risk · stress scenario', { exact: true }).click();
      await answer.getByRole('region', { name: 'Stress scenario', exact: true }).waitFor();
      await page.goto(`${origin}/properties/${property}`);
      const insights = page.getByRole('region', { name: 'Property AI Insights' });
      await insights.getByText('Approved one-share forecast', { exact: true }).click();
      await insights.getByRole('region', { name: 'Scenario value', exact: true }).waitFor();
      if (process.env.FORECAST_SCREENSHOTS) await insights.screenshot({ path: join(process.env.FORECAST_SCREENSHOTS, `demo-property-insights-${width}.png`) });
      await page.goto(`${origin}/dashboard`);
      await page.getByRole('region', { name: 'Portfolio AI Insights' }).getByText(/Confirmed holdings across/).waitFor();
      await page.getByRole('button', { name: 'Dismiss insights' }).click();
      await page.goto(`${origin}/investments`);
      assert.equal(await page.getByRole('region', { name: 'Portfolio AI Insights' }).count(), 0);
      await page.goto(`${origin}/monthly-reports`);
      const commentary = page.getByText('About this Demo snapshot', { exact: true }).first();
      await commentary.click();
      await page.getByText(/investment value increased by 100.00 USD/).waitFor();
      if (width === 390 && process.env.ANDROID_FIXTURE_PATH) {
        await writeFile(process.env.ANDROID_FIXTURE_PATH, JSON.stringify({
          dialog: replies, forecast: reads.get(`/api/assistant/property-insights/${property}`),
          reports: reads.get('/api/demo/monthly-reports'), portfolio: reads.get('/api/assistant/portfolio-insights'),
        }));
      }
      if (process.env.FORECAST_SCREENSHOTS) await page.locator('.report-grid').screenshot({ path: join(process.env.FORECAST_SCREENSHOTS, `demo-monthly-report-${width}.png`) });
    }
    await page.close();
  }
  console.log('AI dialogue used the isolated API at 1440, 390 and 320 pixels.');
} finally {
  await browser.close();
}

// Box C only. Read-only browser diagnosis; does not sign in or create a player.
const { chromium } = require('/opt/pons-browser-qa/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
  try {
    for (const url of ['http://127.0.0.1:8123/?ws=ws://127.0.0.1:8132', 'https://prometheus7.com/ponsgarden/']) {
      const page = await browser.newPage(); const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
      page.on('requestfailed', r => errors.push(r.url() + ': ' + r.failure()?.errorText));
      await page.goto(url); await page.waitForTimeout(3000);
      console.log(JSON.stringify({ url, errors, state: await page.evaluate(() => ({ title: document.title, modal: !document.getElementById('name-modal')?.hidden, canvas: !!document.querySelector('canvas'), renderer: !!window.pons3d, lost: window.pons3d?.renderer.getContext().isContextLost(), ready: window.pons?.ready })) }));
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });

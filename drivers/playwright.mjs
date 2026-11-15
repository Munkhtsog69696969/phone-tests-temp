// Tier 1: the installed Chrome at phone sizes. Not a real phone, and labelled as such.
import { chromium } from 'playwright-core';

export async function createDriver(profile) {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({
    viewport: { width: profile.width, height: profile.height },
    screen: { width: profile.width, height: profile.height },
    deviceScaleFactor: profile.dpr || 2,
    // Desktop profiles (added 2026-11-15 to prove phone fixes leave desktop untouched).
    isMobile: profile.platform !== 'desktop',
    hasTouch: profile.platform !== 'desktop',
    userAgent: profile.platform === 'desktop'
      ? `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browser.version()} Safari/537.36`
      : `Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browser.version()} Mobile Safari/537.36`,
    colorScheme: profile.theme === 'dark' ? 'dark' : 'light',
    serviceWorkers: 'block',
  });
  const page = await context.newPage();
  page.on('crash', () => console.error('page crashed'));
  return {
    label: `Chrome ${browser.version()} at phone size`,
    browserVersion: browser.version(),
    async open(url) {
      const target = url.startsWith('http') ? url : `http://localhost:${profile.port}${url}`;
      await page.goto(target, { waitUntil: 'commit' });
    },
    async capture(fileBase) {
      const file = `${fileBase}.jpg`;
      await page.screenshot({ path: file, type: 'jpeg', quality: 70, caret: 'initial', animations: 'allow' });
      return file;
    },
    async tap({ probe, rect }) {
      if (probe) return {};
      await page.touchscreen.tap(rect.x + rect.w / 2, rect.y + rect.h / 2);
      return { mode: 'emulated touch, no keyboard appears' };
    },
    async close() { await browser.close(); },
  };
}

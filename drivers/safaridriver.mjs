// Tier 3 keyboard scenes only: drives Safari in the simulator so a tap is a real tap and
// the on-screen keyboard can appear. Raw WebDriver over fetch, no Selenium.
// Everything else on iOS works without this, so its failure only loses the keyboard result.
import { capture } from './simctl.mjs';

const BASE = 'http://127.0.0.1:4444';

async function call(method, path, body, ms = 60000) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(ms),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`${path}: ${json.value?.error || res.status} ${json.value?.message || ''}`.trim());
  return json.value;
}

export async function createDriver(profile) {
  const session = await call('POST', '/session', {
    capabilities: { alwaysMatch: { browserName: 'Safari', platformName: 'iOS', 'safari:useSimulator': true, 'safari:deviceUDID': process.env.E2E_SIM_UDID } },
  }, 180000);
  const id = session.sessionId;
  return {
    label: `Safari via safaridriver: ${process.env.E2E_SIM_LABEL || profile.label}`,
    browserVersion: session.capabilities?.browserVersion || null,
    // Navigation blocks until the page loads, and the page then drives itself, so don't wait here.
    async open(url) {
      const target = url.startsWith('http') ? url : `http://localhost:${profile.port}${url}`;
      call('POST', `/session/${id}/url`, { url: target }, 120000).catch((e) => console.error(`url: ${e.message}`));
    },
    capture,
    async tap(body) {
      if (body.probe) return {};
      const element = await call('POST', `/session/${id}/element`, { using: 'css selector', value: body.selector });
      const elementId = element['element-6066-11e4-a52e-4f735466cecf'];
      await call('POST', `/session/${id}/element/${elementId}/click`, {});
      return { mode: 'real safaridriver click' };
    },
    async close() { await call('DELETE', `/session/${id}`).catch(() => {}); },
  };
}

// Tier 3: real Mobile Safari in Apple's iOS Simulator, on a GitHub Mac runner.
// No automation inside Safari: simctl opens the URL and the page audits itself.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const UDID = () => {
  if (!process.env.E2E_SIM_UDID) throw new Error('E2E_SIM_UDID is not set');
  return process.env.E2E_SIM_UDID;
};

export async function capture(fileBase) {
  const file = `${fileBase}.jpg`;
  await run('xcrun', ['simctl', 'io', UDID(), 'screenshot', '--type=jpeg', file], { timeout: 30000 });
  return file;
}

export async function createDriver(profile) {
  // Start each batch from a fresh Safari, so the last batch's tab can't swallow the new URL.
  await run('xcrun', ['simctl', 'terminate', UDID(), 'com.apple.mobilesafari'], { timeout: 30000 }).catch(() => {});
  return {
    label: `Safari in simulator: ${process.env.E2E_SIM_LABEL || profile.label}`,
    browserVersion: process.env.E2E_SIM_LABEL || null,
    async open(url) {
      const target = url.startsWith('http') ? url : `http://localhost:${profile.port}${url}`;
      await run('xcrun', ['simctl', 'openurl', UDID(), target], { timeout: 60000 });
    },
    capture,
    async close() {},
  };
}

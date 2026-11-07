// Tier 2: real Chrome on the Android emulator. Plain adb, no automation inside Chrome.
// The page audits itself. Runs on http://localhost through adb reverse, a secure context.
import { execFile, spawn } from 'node:child_process';
import fs from 'node:fs';
import { promisify } from 'node:util';

const run = promisify(execFile);
const ADB = process.env.ADB || 'adb';
const serial = () => {
  if (!process.env.E2E_ADB_SERIAL) throw new Error('E2E_ADB_SERIAL is not set');
  return process.env.E2E_ADB_SERIAL;
};

export async function adb(...args) {
  const { stdout } = await run(ADB, ['-s', serial(), ...args], { maxBuffer: 1024 * 1024 * 16, timeout: 60000 });
  return stdout;
}
export const shell = (command) => adb('shell', command);

export async function chromeVersion() {
  const out = await shell('dumpsys package com.android.chrome');
  return /versionName=([\d.]+)/.exec(out)?.[1] || null;
}

export async function createDriver(profile) {
  const { wmSize, density, rotate = 0, fontScale = 1, port } = profile.android;
  const version = await chromeVersion();
  await shell(`wm size ${wmSize}`);
  await shell(`wm density ${density}`);
  await shell('settings put system accelerometer_rotation 0');
  await shell(`settings put system user_rotation ${rotate}`);
  await shell(`settings put system font_scale ${fontScale}`);
  await adb('reverse', `tcp:${profile.port}`, `tcp:${profile.port}`);
  void port;
  const [w, h] = wmSize.split('x').map(Number);
  const screen = rotate ? { w: h, h: w } : { w, h };
  return {
    label: `Chrome ${version} on ${process.env.E2E_ANDROID_LABEL || 'Android emulator'}`,
    browserVersion: version,
    async open(url) {
      const target = url.startsWith('http') ? url : `http://localhost:${profile.port}${url}`;
      await shell(`am start -a android.intent.action.VIEW -n com.android.chrome/com.google.android.apps.chrome.Main --es com.android.browser.application_id phone-tests -d '${target}'`);
    },
    capture(fileBase) {
      const file = `${fileBase}.png`;
      return new Promise((resolve, reject) => {
        const child = spawn(ADB, ['-s', serial(), 'exec-out', 'screencap', '-p']);
        const out = fs.createWriteStream(file);
        child.stdout.pipe(out);
        child.on('error', reject);
        out.on('finish', () => resolve(file));
      });
    },
    async tap(body) {
      if (body.probe) return { calibrate: true };
      if (body.calibrateTap) {
        const px = { x: Math.round(screen.w / 2), y: Math.round(screen.h / 2) };
        await shell(`input tap ${px.x} ${px.y}`);
        return { px };
      }
      if (!body.offset) throw new Error('no calibration, so a real tap would miss');
      const x = Math.round((body.rect.x + body.rect.w / 2) * body.dpr + body.offset.x);
      const y = Math.round((body.rect.y + body.rect.h / 2) * body.dpr + body.offset.y);
      await shell(`input tap ${x} ${y}`);
      return { mode: 'real adb tap', x, y };
    },
    async close() {
      await shell('wm size reset').catch(() => {});
      await shell('wm density reset').catch(() => {});
      await shell('settings put system user_rotation 0').catch(() => {});
      await shell('settings put system font_scale 1').catch(() => {});
    },
  };
}

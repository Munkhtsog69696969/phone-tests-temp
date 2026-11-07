#!/usr/bin/env node
// Creates a throwaway AVD, boots it headless, prepares Chrome, runs the self-test
// and the requested profiles, then shuts it down. One emulator at a time.
// Usage: node android/run.mjs --api 36 --profiles a36-320,a36-412 [--selftest-only] [--keep]
import { execFile, spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const { values: args } = parseArgs({
  options: {
    api: { type: 'string' }, profiles: { type: 'string', default: '' }, cells: { type: 'string', default: 'all' },
    only: { type: 'string' }, 'selftest-only': { type: 'boolean', default: false }, out: { type: 'string', default: 'D:/phone-tests/out/tier2' }, port: { type: 'string', default: '4173' },
    keep: { type: 'boolean', default: false }, 'boot-limit': { type: 'string', default: '420' },
  },
});

const SDK = process.env.ANDROID_SDK_ROOT || 'D:\\Android\\Sdk';
const AVD_HOME = 'D:\\phone-tests\\avd';
const ADB = path.join(SDK, 'platform-tools', 'adb.exe');
const EMU = path.join(SDK, 'emulator', 'emulator.exe');
const IMAGES = {
  36: { image: 'system-images;android-36;google_apis_playstore;x86_64', label: 'Android 16' },
  35: { image: 'system-images;android-35;google_apis;x86_64', label: 'Android 15' },
  31: { image: 'system-images;android-31;google_apis_playstore;x86_64', label: 'Android 12' },
  30: { image: 'system-images;android-30;google_apis;x86_64', label: 'Android 11' },
};
const spec = IMAGES[args.api];
if (!spec) throw new Error(`unknown api ${args.api}`);
const NAME = `pt${args.api}`;
const SERIAL = `emulator-${5500 + Number(args.api) * 2}`;
const env = { ...process.env, ANDROID_SDK_ROOT: SDK, ANDROID_AVD_HOME: AVD_HOME, ADB, E2E_ADB_SERIAL: SERIAL, E2E_ANDROID_LABEL: spec.label };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const adb = async (...a) => (await exec(ADB, ['-s', SERIAL, ...a], { env, maxBuffer: 16 * 1024 * 1024, timeout: 60000 })).stdout;
const log = (m) => console.log(`[api${args.api}] ${m}`);

function ensureAvd() {
  fs.mkdirSync(AVD_HOME, { recursive: true });
  const dir = path.join(AVD_HOME, `${NAME}.avd`);
  if (fs.existsSync(path.join(dir, 'config.ini'))) return dir;
  log(`creating AVD ${NAME}`);
  // Written directly: avdmanager can't see this SDK when run outside Android Studio.
  const [, platform, tag, abi] = spec.image.split(';');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(AVD_HOME, `${NAME}.ini`), `avd.ini.encoding=UTF-8\npath=${dir}\ntarget=${platform}\n`);
  const playStore = tag === 'google_apis_playstore';
  fs.writeFileSync(path.join(dir, 'config.ini'), [
    `AvdId=${NAME}`, `avd.ini.displayname=${NAME}`, 'avd.ini.encoding=UTF-8',
    `PlayStore.enabled=${playStore}`, `abi.type=${abi}`, `hw.cpu.arch=${abi}`, 'hw.cpu.ncore=2', 'hw.ramSize=2048', 'vm.heapSize=256',
    'disk.dataPartition.size=4G', 'hw.keyboard=no', 'hw.lcd.density=420', 'hw.lcd.height=2400', 'hw.lcd.width=1080',
    'hw.gpu.enabled=yes', 'hw.gpu.mode=swiftshader_indirect', 'hw.mainKeys=no', 'hw.trackBall=no', 'showDeviceFrame=no',
    `image.sysdir.1=system-images\\${platform}\\${tag}\\${abi}\\`, `tag.id=${tag}`, `tag.display=${tag}`, '',
  ].join('\n'));
  return dir;
}

async function boot() {
  const freeGb = os.freemem() / 1024 ** 3;
  log(`free RAM ${freeGb.toFixed(1)} GB`);
  if (freeGb < 4.5) throw new Error(`RAM_GATE: need 4.5 GB free, have ${freeGb.toFixed(1)} GB`);
  const child = spawn(EMU, ['-avd', NAME, '-port', String(5500 + Number(args.api) * 2), '-no-window', '-no-audio', '-no-boot-anim', '-no-snapshot', '-memory', '2048', '-cores', '2', '-gpu', 'swiftshader_indirect'], { env, stdio: ['ignore', 'ignore', 'pipe'], detached: true });
  child.stderr.on('data', (d) => { const s = String(d); if (/error|fatal|panic/i.test(s)) log(`emu: ${s.trim().slice(0, 200)}`); });
  child.unref();
  const limit = Date.now() + Number(args['boot-limit']) * 1000;
  while (Date.now() < limit) {
    await sleep(5000);
    const out = await adb('shell', 'getprop sys.boot_completed').catch(() => '');
    if (out.trim() === '1') { log(`booted in ${Math.round((Date.now() - limit + Number(args['boot-limit']) * 1000) / 1000)}s`); return; }
  }
  throw new Error('BOOT_TIMEOUT');
}

function pingServer(port) {
  let pings = 0;
  const server = http.createServer((req, res) => { if (req.url.startsWith('/__e2e/ping')) pings += 1; res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<!doctype html><title>ping</title>ok'); });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({ pings: () => pings, close: () => new Promise((r) => { server.closeAllConnections?.(); server.close(r); }) })));
}

async function prepareChrome() {
  const where = (await adb('shell', 'pm path com.android.chrome').catch(() => '')).trim();
  if (!where) throw new Error('NO_CHROME: this image has no Chrome');
  const version = /versionName=([\d.]+)/.exec(await adb('shell', 'dumpsys package com.android.chrome'))?.[1];
  log(`Chrome ${version}`);
  for (const c of [
    'settings put global window_animation_scale 0', 'settings put global transition_animation_scale 0', 'settings put global animator_duration_scale 0',
    'svc power stayon true', 'settings put secure show_ime_with_hard_keyboard 1',
    'am set-debug-app --persistent com.android.chrome',
    "echo '_ --disable-fre --no-default-browser-check --no-first-run --disable-features=Translate,TranslateUI' > /data/local/tmp/chrome-command-line",
    'pm grant com.android.chrome android.permission.POST_NOTIFICATIONS',
    'am force-stop com.android.chrome',
    'input keyevent 82',
  ]) await adb('shell', c).catch(() => {});
  await adb('reverse', `tcp:${args.port}`, `tcp:${args.port}`);
  const ping = await pingServer(Number(args.port));
  try {
    const open = () => adb('shell', `am start -a android.intent.action.VIEW -n com.android.chrome/com.google.android.apps.chrome.Main --es com.android.browser.application_id phone-tests -d 'http://localhost:${args.port}/__e2e/ping'`);
    await open();
    for (let round = 0; round < 6 && !ping.pings(); round++) {
      await sleep(5000);
      if (ping.pings()) break;
      // First-run dialogs, only if the flags file didn't remove them.
      await adb('shell', 'uiautomator dump /sdcard/ui.xml').catch(() => {});
      const xml = await adb('shell', 'cat /sdcard/ui.xml').catch(() => '');
      const nodes = [...xml.matchAll(/text="([^"]*)"[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/g)];
      const known = nodes.find((n) => /^(Accept & continue|Use without an account|Continue without an account|No thanks|No, thanks|Got it|OK|Continue|Skip|Not now|More|Yes, I'm in)$/i.test(n[1]));
      if (known) {
        log(`first-run dialog: tapping "${known[1]}"`);
        await adb('shell', `input tap ${Math.round((+known[2] + +known[4]) / 2)} ${Math.round((+known[3] + +known[5]) / 2)}`);
        await sleep(2000);
      }
      await open();
    }
    if (!ping.pings()) {
      await exec(ADB, ['-s', SERIAL, 'exec-out', 'screencap', '-p'], { encoding: 'buffer', maxBuffer: 32 * 1024 * 1024 }).then(({ stdout }) => {
        fs.mkdirSync(args.out, { recursive: true });
        fs.writeFileSync(path.join(args.out, `api${args.api}-chrome-stuck.png`), stdout);
      }).catch(() => {});
      throw new Error('CHROME_STUCK: Chrome never opened the test page');
    }
    log('Chrome opens the test page');
  } finally {
    await ping.close();
  }
  return version;
}

function runProfiles(cells, profiles, outSuffix = '', extra = []) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['run.mjs', '--driver', 'adb', '--profiles', profiles, '--cells', cells, '--out', `${args.out}/api${args.api}${outSuffix}`, '--port', args.port, ...extra], { env, stdio: 'inherit', cwd: new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/i, '$1') });
    child.on('exit', (code) => resolve(code));
  });
}

async function main() {
  ensureAvd();
  try {
    await boot();
    await prepareChrome();
    const first = args.profiles.split(',')[0];
    const stCode = await runProfiles('selftest', first, '-selftest');
    log(`self-test exit ${stCode}`);
    if (!args['selftest-only'] && args.profiles) {
      await runProfiles(args.cells, args.profiles, '', args.only ? ['--only', args.only] : []);
    }
  } finally {
    if (!args.keep) {
      await adb('emu', 'kill').catch(() => {});
      log('emulator stopped');
    }
  }
}

main().catch((e) => { console.error(`[api${args.api}] STOP ${e.message}`); process.exit(2); });

// Static + fake-API server for the phone tests. Binds to 127.0.0.1 only.
// Serves the compiled dashboard, answers /api/* from fixtures, and walks one
// browser through a queue of "cells" (one page on one phone profile).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleApi } from './fixtures/index.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CELL_TIMEOUT_MS = 45000;
const FIRST_CELL_TIMEOUT_MS = 150000;
const START_RETRY_MS = 200000;
const START_RETRIES = 3;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain',
};

export function assertSafeBundle(dist) {
  const hits = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (/\.(js|html)$/.test(entry.name) && fs.readFileSync(file, 'utf8').includes('web.khaansoft.com')) hits.push(file);
    }
  };
  walk(dist);
  if (hits.length) throw new Error(`Refusing to serve a bundle that points at the real API: ${hits.join(', ')}`);
}

export function startServer({ dist: distArg, port = 4173, cells = [], profile, outDir, driver, seed = {}, log = () => {} }) {
  const dist = path.resolve(distArg);
  assertSafeBundle(dist);
  const browserCode = ['boot.js', 'audit.js'].map((f) => fs.readFileSync(path.join(HERE, f), 'utf8')).join('\n');
  const indexHtml = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
  if (!/<meta charset=[^>]*>/i.test(indexHtml)) throw new Error('index.html has no charset meta to inject after');

  const results = [];
  let index = -1;
  let current = null;
  let finish;
  const done = new Promise((resolve) => { finish = resolve; });
  let pings = 0;
  const startedAt = Date.now();

  const urlFor = (cell) => (cell ? cell.path : '/__e2e/done');

  function beginCell(i) {
    index = i;
    const cell = cells[i] || null;
    current = cell && {
      cell, startedAt: Date.now(), stages: {}, requests: [], unmocked: [], screenshots: {},
    };
    if (!cell) {
      finish({ results, seconds: Math.round((Date.now() - startedAt) / 1000) });
    }
    return urlFor(cell);
  }

  function closeCell(extra = {}) {
    if (!current) return;
    results.push(judge({ ...current, ...extra, seconds: Math.round((Date.now() - current.startedAt) / 100) / 10 }, profile));
    log(`${String(results.length).padStart(3)}/${cells.length} ${current.cell.id} ${results[results.length - 1].valid ? 'valid' : 'INVALID ' + results[results.length - 1].invalidReasons.join('; ')}`);
  }

  // Nothing arrived at all: the browser never opened the start page.
  let openAttempts = 0;
  let lastOpenAt = Date.now();
  const startPath = `/__e2e/start?run=${Date.now()}`;

  const watchdog = setInterval(async () => {
    if (index < 0) {
      if (Date.now() - lastOpenAt < START_RETRY_MS || !driver?.open) return;
      openAttempts += 1;
      lastOpenAt = Date.now();
      log(`browser never arrived, retry ${openAttempts}/${START_RETRIES}`);
      if (openAttempts > START_RETRIES) {
        finish({ results, seconds: Math.round((Date.now() - startedAt) / 1000), neverStarted: true });
        return;
      }
      await driver.open(startPath).catch((e) => log(`open failed: ${e.message}`));
      return;
    }
    if (!current) return;
    // Safari's first launch on a fresh simulator is slow, so the first page gets longer.
    const limit = index === 0 ? FIRST_CELL_TIMEOUT_MS : CELL_TIMEOUT_MS;
    if (Date.now() - current.startedAt < limit) return;
    log(`timeout ${current.cell.id}`);
    closeCell({ timedOut: true });
    const next = beginCell(index + 1);
    if (cells[index] && driver?.open) await driver.open(next).catch((e) => log(`reopen failed: ${e.message}`));
  }, 2000);

  function injectFor(html, cell) {
    const config = {
      cell: cell && {
        id: cell.id, expectPath: cell.expectPath ?? null, forbid: cell.forbid || [], scene: cell.scene || null,
        css: cell.css || null, selftest: !!cell.selftest, stages: cell.stages || ['top', 'end'],
      },
      profile: profile && { id: profile.id, platform: profile.platform, width: profile.width, height: profile.height, theme: profile.theme || 'light' },
      seed: { ...seed, ...(cell?.seed || {}) },
    };
    const script = `<script>window.__E2E=${JSON.stringify(config).replace(/</g, '\\u003c')};\n${browserCode}\n</script>`;
    return html.replace(/<meta charset=[^>]*>/i, (m) => `${m}${script}`);
  }

  function readBody(req) {
    return new Promise((resolve) => {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        try { resolve(text ? JSON.parse(text) : undefined); } catch { resolve(text); }
      });
    });
  }

  const send = (res, status, body, headers = {}) => {
    res.writeHead(status, { 'Cache-Control': 'no-store', ...headers });
    res.end(body);
  };
  const json = (res, status, value) => send(res, status, JSON.stringify(value), { 'Content-Type': 'application/json' });

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const { pathname } = url;

      if (pathname === '/__e2e/ping') {
        pings += 1;
        return send(res, 200, '<!doctype html><meta charset="utf-8"><title>ping</title>ok', { 'Content-Type': 'text/html; charset=utf-8' });
      }
      if (pathname === '/__e2e/start') {
        if (index < 0) beginCell(0);
        return send(res, 302, '', { Location: urlFor(current?.cell) });
      }
      if (pathname === '/__e2e/done') {
        return send(res, 200, '<!doctype html><meta charset="utf-8"><title>done</title>done', { 'Content-Type': 'text/html; charset=utf-8' });
      }
      if (pathname === '/__e2e/result' && req.method === 'POST') {
        const body = await readBody(req);
        if (!current || body.cellId !== current.cell.id) return json(res, 200, { next: urlFor(current?.cell) });
        current.stages[body.stage] = body.metrics;
        const file = `${safeName(current.cell.id)}.${body.stage}`;
        if (driver?.capture && !current.cell.noCapture) {
          try { current.screenshots[body.stage] = await driver.capture(path.join(outDir, file)); }
          catch (e) { current.captureError = e.message; }
        }
        const stages = current.cell.stages || ['top', 'end'];
        if (body.stage !== 'watchdog' && stages.indexOf(body.stage) < stages.length - 1) return json(res, 200, { continue: true });
        closeCell();
        return json(res, 200, { next: beginCell(index + 1) });
      }
      if (pathname === '/__e2e/tap' && req.method === 'POST') {
        const body = await readBody(req);
        if (!driver?.tap) return json(res, 200, { ok: false, reason: 'driver has no real tap' });
        try { return json(res, 200, { ok: true, ...(await driver.tap(body)) }); }
        catch (e) { return json(res, 200, { ok: false, reason: e.message }); }
      }
      if (pathname.startsWith('/__e2e/selftest/')) {
        const file = path.join(HERE, 'selftest', path.basename(pathname));
        if (!fs.existsSync(file)) return send(res, 404, 'no such selftest');
        return send(res, 200, injectFor(fs.readFileSync(file, 'utf8'), current?.cell), { 'Content-Type': MIME['.html'] });
      }

      if (pathname === '/auth/facebook' || pathname === '/auth/instagram') {
        return send(res, 302, '', { Location: '/login' });
      }
      if (pathname === '/auth/logout') return json(res, 200, { success: true });
      if (pathname.startsWith('/socket.io')) return json(res, 404, { success: false, error: 'not_found' });
      if (pathname === '/sw.js') return send(res, 404, 'no service worker in tests');

      if (pathname.startsWith('/api/')) {
        const body = req.method === 'GET' ? undefined : await readBody(req);
        const cell = current?.cell;
        const line = `${req.method} ${pathname}${url.search}`;
        current?.requests.push(line);
        if (cell?.mock?.drop && new RegExp(cell.mock.drop).test(pathname)) {
          current?.unmocked.push(`${line} (dropped by test)`);
          return json(res, 404, { success: false, error: 'not_found' });
        }
        const answer = await handleApi({ method: req.method, pathname, url, body, cell });
        if (!answer) {
          current?.unmocked.push(line);
          log(`UNMOCKED ${line}`);
          return json(res, 404, { success: false, error: 'not_found' });
        }
        return json(res, answer.status || 200, answer.body);
      }

      // Static file, else SPA page. A missing /assets/* is a 404, as public/_redirects does in production.
      const file = path.join(dist, decodeURIComponent(pathname));
      if (file.startsWith(dist) && fs.existsSync(file) && fs.statSync(file).isFile() && pathname !== '/index.html') {
        const headers = { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' };
        if (pathname.startsWith('/assets/')) headers['Cache-Control'] = 'max-age=3600';
        res.writeHead(200, headers);
        return fs.createReadStream(file).pipe(res);
      }
      if (pathname.startsWith('/assets/')) return send(res, 404, 'not found');
      return send(res, 200, injectFor(indexHtml, current?.cell), { 'Content-Type': MIME['.html'] });
    } catch (e) {
      log(`server error ${req.url}: ${e.stack}`);
      if (!res.headersSent) json(res, 500, { success: false, error: 'harness_error', detail: e.message });
    }
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve({
      port,
      done,
      startUrl: `http://localhost:${port}${startPath}`,
      pingCount: () => pings,
      close: () => { clearInterval(watchdog); server.closeAllConnections?.(); return new Promise((r) => server.close(r)); },
    }));
  });
}

export function safeName(id) {
  return id.replace(/[^a-z0-9._-]+/gi, '_');
}

// A cell only counts when it really reached the page it was meant to test.
function judge(entry, profile) {
  const { cell, stages, requests, unmocked } = entry;
  const stage = stages.top || stages.scene || stages.watchdog || Object.values(stages)[0];
  const reasons = [];
  if (entry.timedOut) reasons.push('timed out');
  if (!stage) reasons.push('page never reported');
  if (stage && !cell.selftest) {
    if (profile?.width && Math.abs(stage.layoutWidth - profile.width) > 2) reasons.push(`viewport ${stage.layoutWidth} not ${profile.width}`);
    if (cell.expectPath && stage.path !== cell.expectPath) reasons.push(`landed on ${stage.path}, expected ${cell.expectPath}`);
    if (!stage.fontsOk) reasons.push('fonts did not load');
    if (!stage.settled) reasons.push('page did not settle');
    if (stage.watchdog) reasons.push('watchdog fired');
    if (stage.forbidHits?.length) reasons.push(`forbidden: ${stage.forbidHits.join(', ')}`);
    if (!stage.mounted) reasons.push('app never mounted');
    for (const need of cell.requires || []) {
      if (!requests.some((line) => new RegExp(need).test(line))) reasons.push(`endpoint not hit: ${need}`);
    }
    if (unmocked.length) reasons.push(`unmocked: ${[...new Set(unmocked)].slice(0, 4).join(', ')}`);
  }
  return {
    id: cell.id, path: cell.path, kind: cell.kind || 'route', selftest: !!cell.selftest, expect: cell.expect || null,
    valid: reasons.length === 0, invalidReasons: reasons, timedOut: !!entry.timedOut, seconds: entry.seconds,
    stages, screenshots: entry.screenshots, captureError: entry.captureError || null,
    requestCount: requests.length, unmocked: [...new Set(unmocked)],
  };
}

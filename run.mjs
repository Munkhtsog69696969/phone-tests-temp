#!/usr/bin/env node
// Runs one driver across profiles. Usage:
//   node run.mjs --driver playwright --profiles p320,p390 --cells selftest --out ../out/tier1
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { startServer, safeName } from './server.mjs';
import { ROUTES, SCENES, GATES, SELFTEST, SEED } from './routes.mjs';
import { PROFILES } from './profiles.mjs';

const { values: args } = parseArgs({
  options: {
    driver: { type: 'string', default: 'playwright' },
    profiles: { type: 'string', default: 'p390' },
    cells: { type: 'string', default: 'all' },
    only: { type: 'string' },
    dist: { type: 'string', default: process.env.E2E_DIST || 'D:/phone-tests/app/dist' },
    out: { type: 'string', default: 'D:/phone-tests/out/run' },
    port: { type: 'string', default: '4173' },
  },
});

const BUILD_JSON = process.env.E2E_BUILD || 'D:/phone-tests/build.json';

function pickCells(name) {
  const groups = { routes: ROUTES, scenes: SCENES, gates: GATES, selftest: SELFTEST, all: [...ROUTES, ...SCENES, ...GATES] };
  let cells = name.split(',').flatMap((n) => {
    if (!groups[n]) throw new Error(`unknown cell group ${n}`);
    return groups[n];
  });
  if (args.only) {
    const ids = new Set(args.only.split(','));
    cells = cells.filter((c) => ids.has(c.id));
  }
  return cells;
}

// The self-test verdict: defects must be caught and lookalikes must not.
export function selftestVerdict(results) {
  const rows = [];
  for (const r of results) {
    if (!r.expect) continue;
    const merged = {};
    for (const stage of Object.values(r.stages)) {
      for (const key of Object.keys(stage)) {
        const v = stage[key];
        const hit = Array.isArray(v) ? v.length > 0 : v && typeof v === 'object' ? (v.count === undefined ? true : v.count > 0) : false;
        merged[key] = merged[key] || hit;
      }
    }
    const problems = [];
    if (r.expect.invalid && r.valid) problems.push('should have been invalid but counted as valid');
    if (r.expect.onlyTouch && !Object.values(r.stages).some((s) => s.hoverNone)) { rows.push({ id: r.id, pass: true, note: 'skipped: not a touch browser' }); continue; }
    for (const key of r.expect.flag || []) if (!merged[key]) problems.push(`missed ${key}`);
    for (const key of r.expect.noFlag || []) if (merged[key]) problems.push(`false alarm ${key}: ${JSON.stringify(Object.values(r.stages).map((s) => s[key]))}`.slice(0, 400));
    rows.push({ id: r.id, pass: problems.length === 0, problems, invalidReasons: r.invalidReasons });
  }
  return rows;
}

async function main() {
  const { createDriver } = await import(`./drivers/${args.driver}.mjs`);
  const port = Number(args.port);
  for (const id of args.profiles.split(',')) {
    const profile = { ...PROFILES[id], id, port };
    if (!PROFILES[id]) throw new Error(`unknown profile ${id}`);
    const outDir = path.join(args.out, safeName(id));
    fs.mkdirSync(outDir, { recursive: true });
    const cells = pickCells(args.cells);
    const driverRef = {};
    const server = await startServer({
      dist: args.dist, port, cells, profile, outDir, seed: SEED,
      driver: { capture: (f) => driverRef.d.capture(f), tap: (b) => driverRef.d.tap(b), open: (u) => driverRef.d.open(u) },
      log: (line) => console.log(`[${id}] ${line}`),
    });
    driverRef.d = await createDriver(profile);
    console.log(`[${id}] ${driverRef.d.label}: ${cells.length} cells`);
    await driverRef.d.open(server.startUrl);
    const { results, seconds, neverStarted } = await server.done;
    if (neverStarted) {
      await driverRef.d.capture(path.join(outDir, 'never-started')).catch(() => {});
      await driverRef.d.close();
      await server.close();
      throw new Error(`NEVER_STARTED: the browser never opened the test page on ${id}`);
    }
    const report = {
      profile, driver: args.driver, driverLabel: driverRef.d.label, browserVersion: driverRef.d.browserVersion || null,
      build: JSON.parse(fs.existsSync(BUILD_JSON) ? fs.readFileSync(BUILD_JSON, 'utf8') : '{}'),
      seconds, valid: results.filter((r) => r.valid).length, total: results.length, results,
    };
    if (results.some((r) => r.expect)) report.selftest = selftestVerdict(results);
    fs.writeFileSync(path.join(outDir, 'results.json'), JSON.stringify(report, null, 1));
    console.log(`[${id}] finished in ${seconds}s, valid ${report.valid}/${report.total}`);
    if (report.selftest) for (const row of report.selftest) console.log(`  ${row.pass ? 'PASS' : 'FAIL'} ${row.id} ${row.note || ''} ${(row.problems || []).join(' | ')}`);
    await driverRef.d.close();
    await server.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

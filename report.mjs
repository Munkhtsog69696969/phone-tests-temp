#!/usr/bin/env node
// Reads every results.json under --in, writes findings.json and report.html into --in.
// Usage: node report.mjs --in D:/phone-tests/out [--title "..."]
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

const { values: args } = parseArgs({
  options: { in: { type: 'string', default: 'D:/phone-tests/out' }, title: { type: 'string', default: 'Phone test results' }, skip: { type: 'string', default: 'fixtures-a,fixtures-b,selftest-t1' } },
});
const ROOT = path.resolve(args.in);
const SKIP = new Set(args.skip.split(','));

const METRICS = {
  docOverflow: { label: 'Page wider than the screen', severity: 'fail' },
  offEdge: { label: 'Content past the screen edge', severity: 'fail' },
  clipped: { label: 'Text cut off with no ellipsis', severity: 'fail' },
  truncated: { label: 'Text shortened with an ellipsis', severity: 'warn' },
  tapFail: { label: 'Tap target under 24 px', severity: 'fail' },
  tapWarn: { label: 'Tap target under 44 px', severity: 'warn' },
  smallInput: { label: 'Input text under 16 px', severity: (p) => (p === 'ios' ? 'fail' : 'warn') },
  behindNav: { label: 'Stuck behind the bottom nav', severity: 'fail' },
  obscured: { label: 'Control covered by something else', severity: 'fail' },
  hoverHidden: { label: 'Control invisible without a mouse', severity: 'fail' },
  doubleScroll: { label: 'Page and inner area both scroll', severity: 'fail' },
  keyboard: { label: 'Keyboard: zoomed in or field hidden', severity: 'fail' },
  errors: { label: 'JavaScript error', severity: 'fail' },
  badText: { label: 'Broken value shown (possible fake-data fault)', severity: 'check' },
};

function findRuns(dir, found = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (dir === ROOT && SKIP.has(entry.name)) continue;
      findRuns(full, found);
    } else if (entry.name === 'results.json') found.push(full);
  }
  return found;
}

const severityOf = (metric, platform) => {
  const s = METRICS[metric].severity;
  return typeof s === 'function' ? s(platform) : s;
};

function hitsFor(stage, metric, platform) {
  const v = stage[metric];
  if (!v) return [];
  if (metric === 'keyboard') {
    if (!stage.scene?.tap?.ok && !stage.scene?.tap?.mode) return [];
    return v.zoomed || v.fieldBelowView ? [{ d: v.focused || 'focused field', n: 1, scale: v.scale, vvHeight: v.vvHeight, bottom: v.focusedBottom }] : [];
  }
  if (metric === 'docOverflow') return [{ d: `page is ${v.pageWidth}px on a ${v.width}px screen`, n: 1 }];
  if (metric === 'doubleScroll') return [{ d: `window ${v.pageHeight}px vs view ${v.viewport}px, inner ${v.inner?.[0] || ''}`, n: 1 }];
  if (metric === 'errors') return v.map((m) => ({ d: m, n: 1 }));
  if (metric === 'badText') return v.map((m) => ({ d: m, n: 1 }));
  return (v.items || []).map((item) => ({ ...item, n: item.n || 1 }));
}

const runs = findRuns(ROOT).map((file) => ({ file, dir: path.dirname(file), data: JSON.parse(fs.readFileSync(file, 'utf8')) }));
const findings = new Map();
const matrix = [];
const coverage = [];
const selftests = [];

for (const run of runs) {
  const { data, dir } = run;
  const profile = data.profile;
  const platform = profile.platform;
  const label = `${profile.label}`;
  if (data.selftest) {
    selftests.push({ driver: data.driverLabel, profile: label, pass: data.selftest.filter((r) => r.pass).length, total: data.selftest.length, failed: data.selftest.filter((r) => !r.pass).map((r) => `${r.id}: ${(r.problems || []).join(', ')}`) });
    if (data.results.every((r) => r.selftest || r.kind === 'negative')) continue;
  }
  const row = { profile: label, driver: data.driverLabel, id: profile.id, cells: {} };
  coverage.push({ profile: label, driver: data.driverLabel, browser: data.browserVersion, sha: data.build?.sha?.slice(0, 7), valid: data.valid, total: data.total, seconds: data.seconds, invalid: data.results.filter((r) => !r.valid).map((r) => `${r.id}: ${r.invalidReasons.join('; ')}`) });
  for (const cell of data.results) {
    if (cell.selftest || cell.kind === 'negative') continue;
    let fail = 0, warn = 0;
    for (const [stageName, stage] of Object.entries(cell.stages)) {
      for (const metric of Object.keys(METRICS)) {
        for (const hit of hitsFor(stage, metric, platform)) {
          const sev = severityOf(metric, platform);
          if (sev === 'fail') fail += 1; else if (sev === 'warn') warn += 1;
          if (!cell.valid) continue;
          const key = `${metric}|${cell.id}|${hit.d}`;
          if (!findings.has(key)) findings.set(key, { metric, label: METRICS[metric].label, severity: sev, cell: cell.id, path: cell.path, what: hit.d, detail: null, profiles: new Set(), browsers: new Set(), stages: new Set(), example: null });
          const f = findings.get(key);
          f.profiles.add(label);
          f.browsers.add(data.driverLabel);
          f.stages.add(stageName);
          f.detail = f.detail || { w: hit.w, h: hit.h, font: hit.font, by: hit.by, rect: hit.rect, full: hit.full, shown: hit.shown, scale: hit.scale };
          f.example = f.example || relShot(cell, stageName, dir);
          if (sev === 'fail') f.severity = 'fail';
        }
      }
    }
    row.cells[cell.id] = { fail, warn, valid: cell.valid, reasons: cell.invalidReasons, top: relShot(cell, 'top', dir) || relShot(cell, 'scene', dir), end: relShot(cell, 'end', dir), kind: cell.kind };
  }
  matrix.push(row);
}

function relShot(cell, stage, dir) {
  const file = cell.screenshots?.[stage];
  if (!file) return null;
  const abs = path.isAbsolute(file) ? file : path.join(dir, path.basename(file));
  const candidate = fs.existsSync(abs) ? abs : path.join(dir, path.basename(file));
  return path.relative(ROOT, candidate).replace(/\\/g, '/');
}

const list = [...findings.values()].map((f) => ({ ...f, profiles: [...f.profiles], browsers: [...f.browsers], stages: [...f.stages] }));
const rank = { fail: 0, check: 1, warn: 2 };
list.sort((a, b) => rank[a.severity] - rank[b.severity] || b.profiles.length - a.profiles.length || a.metric.localeCompare(b.metric));

const summary = {};
for (const f of list) {
  summary[f.metric] = summary[f.metric] || { label: f.label, severity: f.severity, things: 0, pages: new Set() };
  summary[f.metric].things += 1;
  summary[f.metric].pages.add(f.cell);
}
const summaryRows = Object.values(summary).map((s) => ({ ...s, pages: s.pages.size })).sort((a, b) => rank[a.severity] - rank[b.severity] || b.things - a.things);
fs.writeFileSync(path.join(ROOT, 'findings.json'), JSON.stringify({ generatedAt: new Date().toISOString(), summary: summaryRows, coverage, selftests, findings: list }, null, 1));

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const cellIds = [...new Set(matrix.flatMap((row) => Object.keys(row.cells)))];
const matrixHtml = `<table class="m"><thead><tr><th>Page</th>${matrix.map((r) => `<th>${esc(r.profile)}</th>`).join('')}</tr></thead><tbody>${cellIds.map((id) => `<tr><th>${esc(id)}</th>${matrix.map((r) => {
  const c = r.cells[id];
  if (!c) return '<td class="na">–</td>';
  if (!c.valid) return `<td class="inv" title="${esc(c.reasons.join('; '))}">invalid</td>`;
  const cls = c.fail ? 'bad' : c.warn ? 'warn' : 'ok';
  return `<td class="${cls}">${c.top ? `<a href="${esc(c.top)}">` : ''}${c.fail}/${c.warn}${c.top ? '</a>' : ''}${c.end ? ` <a class="e" href="${esc(c.end)}">end</a>` : ''}</td>`;
}).join('')}</tr>`).join('')}</tbody></table>`;

const findingsHtml = list.slice(0, 400).map((f) => `<tr class="${f.severity}"><td>${esc(f.severity)}</td><td>${esc(f.label)}</td><td>${esc(f.cell)}</td><td class="w">${esc(f.what)}${f.detail?.by ? `<br><small>covered by ${esc(f.detail.by)}</small>` : ''}${f.detail?.font ? ` <small>${f.detail.font}px</small>` : ''}${f.detail?.w ? ` <small>${f.detail.w}×${f.detail.h}</small>` : ''}</td><td>${f.profiles.length}</td><td>${f.example ? `<a href="${esc(f.example)}">view</a>` : ''}</td></tr>`).join('');

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(args.title)}</title><style>
:root{color-scheme:light dark;--bg:#fff;--fg:#1a1a1a;--line:#ddd;--bad:#fbe3e3;--warn:#fdf3d7;--ok:#e3f5e6;--inv:#e8e8e8}
@media (prefers-color-scheme:dark){:root{--bg:#141414;--fg:#eee;--line:#333;--bad:#4a2020;--warn:#463a14;--ok:#1f3d24;--inv:#333}}
body{font:14px/1.45 system-ui,sans-serif;background:var(--bg);color:var(--fg);margin:0;padding:16px}table{border-collapse:collapse;margin:8px 0 24px}th,td{border:1px solid var(--line);padding:4px 8px;text-align:left;vertical-align:top}
.wrap{overflow-x:auto}.bad,.fail{background:var(--bad)}.warn{background:var(--warn)}.ok{background:var(--ok)}.inv{background:var(--inv)}.na{color:#888}a{color:inherit}.e{opacity:.7;font-size:12px}.w{max-width:520px;word-break:break-word}small{opacity:.75}
</style></head><body><h1>${esc(args.title)}</h1>
<h2>Summary</h2><div class="wrap"><table><tr><th>Check</th><th>Severity</th><th>Distinct things</th><th>Pages</th></tr>${summaryRows.map((s) => `<tr class="${s.severity}"><td>${esc(s.label)}</td><td>${esc(s.severity)}</td><td>${s.things}</td><td>${s.pages}</td></tr>`).join('')}</table></div>
<h2>Coverage</h2><div class="wrap"><table><tr><th>Profile</th><th>Runner</th><th>App</th><th>Valid</th><th>Seconds</th><th>Invalid cells</th></tr>${coverage.map((c) => `<tr><td>${esc(c.profile)}</td><td>${esc(c.driver)}</td><td>${esc(c.sha)}</td><td>${c.valid}/${c.total}</td><td>${c.seconds}</td><td class="w">${esc(c.invalid.join(' | '))}</td></tr>`).join('')}</table></div>
<h2>Harness self-test</h2><div class="wrap"><table><tr><th>Runner</th><th>Profile</th><th>Passed</th><th>Failed</th></tr>${selftests.map((s) => `<tr class="${s.pass === s.total ? 'ok' : 'bad'}"><td>${esc(s.driver)}</td><td>${esc(s.profile)}</td><td>${s.pass}/${s.total}</td><td class="w">${esc(s.failed.join(' | '))}</td></tr>`).join('')}</table></div>
<h2>Page by phone (fails/warnings, click for screenshot)</h2><div class="wrap">${matrixHtml}</div>
<h2>Findings (${list.length})</h2><div class="wrap"><table><tr><th>Severity</th><th>Check</th><th>Page</th><th>What</th><th>Profiles</th><th>Shot</th></tr>${findingsHtml}</table></div>
</body></html>`;
fs.writeFileSync(path.join(ROOT, 'report.html'), html);
console.log(`runs ${runs.length}, findings ${list.length}`);
for (const s of summaryRows) console.log(`${s.severity.padEnd(6)} ${String(s.things).padStart(4)} things on ${String(s.pages).padStart(2)} pages  ${s.label}`);
for (const c of coverage) console.log(`${c.profile}: valid ${c.valid}/${c.total} ${c.invalid.slice(0, 3).join(' | ')}`);

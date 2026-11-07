// Fake API. Each group file exports `routes`: [method, regex, handler(ctx, match)].
// A handler returns the `data` value; use raw() or status() for anything else.
// Returning nothing unknown: an unmatched request is logged and fails the cell.
import { routes as core } from './core.mjs';
import { routes as groupA } from './group-a.mjs';
import { routes as groupB } from './group-b.mjs';

const ALL = [...core, ...groupA, ...groupB];

export function raw(body, status = 200) { return { __raw: true, body, status }; }
export function status(code, error = 'not_found') { return { __raw: true, status: code, body: { success: false, error } }; }

export async function handleApi(ctx) {
  for (const [method, pattern, handler] of ALL) {
    if (method !== ctx.method) continue;
    const match = pattern.exec(ctx.pathname);
    if (!match) continue;
    const value = await handler(ctx, match);
    if (value && value.__raw) return { status: value.status, body: value.body };
    return { status: 200, body: { success: true, data: value === undefined ? null : value } };
  }
  return null;
}

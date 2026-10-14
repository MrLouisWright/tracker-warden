import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { check, vendorForUrl, VENDORS, RULES, toCsv } from '../src/index.js';
import { vendorsInScript } from '../src/vendors.js';

const fx = (n) => new URL(`./fixtures/${n}`, import.meta.url).pathname;
const rules = (r) => r.findings.map((f) => f.rule);
const site = (files) => { const d = mkdtempSync(join(tmpdir(), 'tw-')); for (const [p, c] of Object.entries(files)) { mkdirSync(join(d, p, '..'), { recursive: true }); writeFileSync(join(d, p), c); } return d; };
const page = (h) => `<!doctype html><html><head><title>t</title><link rel="canonical" href="https://me.example/">${h}</head><body></body></html>`;

test('good fixture is clean', () => { assert.deepEqual(check(fx('good')).findings, []); });
test('bad fixture reports every rule except unapproved', () => { const r = rules(check(fx('bad'))); for (const k of Object.keys(RULES).filter((k) => k !== 'tracker-unapproved')) assert.ok(r.includes(k), k); });
test('vendor DB: unique ids, url matching, inline signatures', () => {
  assert.equal(new Set(VENDORS.map((v) => v.id)).size, VENDORS.length); assert.ok(VENDORS.length >= 45);
  assert.equal(vendorForUrl('https://www.google-analytics.com/analytics.js').id, 'google-analytics');
  assert.equal(vendorForUrl('https://www.facebook.com/tr?id=1').id, 'meta-pixel');
  assert.equal(vendorForUrl('https://example.com/x.js'), null);
  assert.ok(vendorsInScript("fbq('init')").some((v) => v.id === 'meta-pixel'));
});
test('approved vendor gate', () => {
  const d = site({ 'index.html': page('<script src="https://static.hotjar.com/c/x.js"></script><script src="https://plausible.io/js/script.js"></script>') });
  const r = check(d, { approved: ['plausible'] });
  assert.ok(r.findings.some((f) => f.rule === 'tracker-unapproved' && f.subject === 'hotjar'));
  assert.ok(!r.findings.some((f) => f.rule === 'tracker-unapproved' && f.subject === 'plausible'));
  assert.equal(r.findings.find((f) => f.subject === 'plausible' && f.rule === 'tracker-analytics').severity, 'info');
});
test('first party: same host, subdomains, configured hosts', () => {
  const d = site({ 'index.html': page('<script src="https://static.me.example/a.js"></script><script src="https://assets.mycdn.net/b.js"></script>') });
  assert.deepEqual(rules(check(d)), ['tracker-unknown']);
  assert.deepEqual(rules(check(d, {}, { firstParty: ['mycdn.net'] })), []);
});
test('inventory file JSON and CSV', () => {
  const d = site({ 'index.html': page('<script src="https://connect.facebook.net/x.js"></script>') });
  const j = join(d, 'inv.json'); check(d, { inventoryFile: j });
  assert.equal(JSON.parse(readFileSync(j, 'utf8'))[0].id, 'meta-pixel');
  assert.match(toCsv(check(d).info.inventory), /^vendor,company/);
});
test('allowlist with expiry by vendor subject', () => {
  const d = site({ 'index.html': page('<script src="https://connect.facebook.net/x.js"></script>') });
  const r = check(d, { now: new Date('2026-10-14') }, { allowlist: [{ subject: 'meta-pixel', reason: 'DPA signed', expires: '2027-06-30' }] });
  assert.equal(r.findings.length, 0); assert.equal(r.suppressed.length, 1);
});
test('CLI exit codes and formats', () => {
  const bin = new URL('../bin/tracker-warden.js', import.meta.url).pathname;
  const run = (...x) => spawnSync(process.execPath, [bin, ...x], { encoding: 'utf8' });
  assert.equal(run(fx('good'), '--fail-on', 'info').status, 0);
  assert.equal(run(fx('bad'), '--fail-on', 'medium').status, 1);
  assert.equal(run(fx('bad'), '--fail-on', 'none').status, 0);
  assert.equal(run(fx('bad'), '--approved', 'google-fonts').status, 1);
  assert.equal(run('/nonexistent-dir-xyz').status, 2);
  const s = JSON.parse(run(fx('bad'), '--format', 'sarif', '--fail-on', 'none').stdout); assert.equal(s.version, '2.1.0');
  assert.match(run(fx('bad'), '--format', 'markdown', '--fail-on', 'none').stdout, /\| Severity \|/);
});

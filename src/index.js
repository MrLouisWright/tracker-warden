// tracker-warden: third-party tracker inventory for built static sites. Louis Wright, MIT.
import { writeFileSync } from 'node:fs';
import { runBeacon, finder, SITE_OPTIONS, SITE_HELP, siteOptions } from './site.js';
import { buildReport, UsageError } from './core.js';
import { VENDORS, TRACKING, thirdPartyResources, vendorForUrl } from './vendors.js';

export * from './core.js';
export { SITE_OPTIONS, SITE_HELP, siteOptions, VENDORS, vendorForUrl };

export const RULES = {
  'tracker-unapproved': { severity: 'high', title: 'Third party is not on your approved vendor list' },
  'tracker-advertising': { severity: 'medium', title: 'Advertising / retargeting pixel or SDK' },
  'tracker-session-replay': { severity: 'medium', title: 'Session-replay or heatmap SDK (records user interactions)' },
  'tracker-pixel': { severity: 'medium', title: 'Tracking pixel (1x1, hidden or <noscript> image) to a third party' },
  'tracker-social': { severity: 'medium', title: 'Social widget that tracks visitors across sites' },
  'tracker-analytics': { severity: 'low', title: 'Analytics, tag manager or marketing automation SDK' },
  'tracker-unknown': { severity: 'low', title: 'Script or iframe from an unrecognised third-party domain' },
  'tracker-third-party': { severity: 'info', title: 'Other third party (fonts, CDN, video, maps, payments, chat, consent)' },
};
const RULE_FOR = { advertising: 'tracker-advertising', 'session-replay': 'tracker-session-replay', social: 'tracker-social', analytics: 'tracker-analytics', 'tag-manager': 'tracker-analytics', marketing: 'tracker-analytics' };

/** Build the inventory: [{ id, name, company, category, sells, pages:[], urls:[], kinds:[] }]. */
export function inventory(site, config = {}) {
  const siteHost = site.origin ? new URL(site.origin).host : (config.firstParty?.[0] ?? null);
  const fpExtra = (config.firstParty || []).map((h) => h.toLowerCase());
  const inv = new Map();
  for (const pg of site.pages) {
    for (const r of thirdPartyResources(pg.doc, siteHost)) {
      if (fpExtra.some((h) => r.host === h || r.host.endsWith('.' + h))) continue;
      const v = r.vendor || { id: `domain:${r.host}`, name: r.host, company: null, category: (r.kind === 'script' || r.kind === 'iframe') ? 'unknown' : 'other', sells: false, unknown: true };
      if (!inv.has(v.id)) inv.set(v.id, { id: v.id, name: v.name, company: v.company, category: v.category, sells: !!v.sells, cookieless: !!v.cookieless, unknown: !!v.unknown, pages: new Set(), urls: new Set(), kinds: new Set(), first: { file: pg.file, line: r.line } });
      const e = inv.get(v.id); e.pages.add(pg.path); if (r.url) e.urls.add(r.url); e.kinds.add(r.kind);
      if (r.kind === 'pixel') e.pixel = true;
    }
  }
  return [...inv.values()].map((e) => ({ ...e, pages: [...e.pages].sort(), urls: [...e.urls].sort(), kinds: [...e.kinds].sort() })).sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
}
export function toCsv(inv) {
  const q = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  return ['vendor,company,category,sells_or_shares,kinds,pages,example_url', ...inv.map((e) => [e.name, e.company, e.category, e.sells ? 'yes' : 'no', e.kinds.join(' '), e.pages.length, e.urls[0] || ''].map(q).join(','))].join('\n') + '\n';
}

export function analyze(site, opts = {}, config = {}) {
  const { findings, add } = finder(RULES);
  const inv = inventory(site, config);
  const approved = [...(config.approved || []), ...(opts.approved || [])].map((x) => x.toLowerCase());
  for (const e of inv) {
    const where = `${e.pages.length} page(s), e.g. ${e.pages.slice(0, 3).join(', ')}`;
    const desc = `${e.name}${e.company ? ` (${e.company})` : ''}`;
    const isApproved = approved.includes(e.id.toLowerCase()) || approved.includes(e.name.toLowerCase()) || approved.some((a) => e.id === `domain:${a}`);
    if (approved.length && !isApproved) add('tracker-unapproved', e.id, `${desc} [${e.category}] is not an approved vendor; on ${where}`, `Remove it, or add "${e.id.replace(/^domain:/, '')}" to "approved" after a vendor review.`, e.first);
    if (e.pixel && TRACKING.has(e.category) || (e.pixel && e.unknown)) add('tracker-pixel', e.id, `Tracking pixel for ${desc} on ${where}`, 'Load pixels only after consent, or remove them.', e.first);
    if (e.pixel && e.unknown) continue;
    const rule = e.unknown ? (e.category === 'unknown' ? 'tracker-unknown' : 'tracker-third-party') : (RULE_FOR[e.category] || 'tracker-third-party');
    const sev = isApproved && rule !== 'tracker-third-party' ? 'info' : undefined;
    add(rule, e.id, `${desc} [${e.category}${e.sells ? ', sells/shares data' : ''}${e.cookieless ? ', cookieless' : ''}] on ${where}`, rule === 'tracker-third-party' ? 'Inventory only. Self-host where practical.' : rule === 'tracker-unknown' ? 'Identify the vendor and add it to your inventory, or remove the script.' : 'Make sure it is disclosed in your privacy policy and only loads after consent.', { ...e.first, severity: sev });
  }
  return { findings, info: { vendors: inv.length, inventory: inv.map(({ first, ...x }) => x) }, summary: `${site.pages.length} page(s); ${inv.length} third part${inv.length === 1 ? 'y' : 'ies'}: ${[...new Set(inv.map((e) => e.category))].join(', ') || 'none'}` };
}

export function check(dir, opts = {}, config = {}, configFile) {
  const tool = { name: 'tracker-warden', version: opts.toolVersion || '1.0.0', rules: RULES, emoji: '🕵️', defaultFile: 'index.html' };
  const r = runBeacon(tool, dir, { ...opts, UsageError }, config, configFile, analyze, buildReport);
  if (opts.inventoryFile) writeFileSync(opts.inventoryFile, /\.csv$/i.test(opts.inventoryFile) ? toCsv(r.info.inventory) : JSON.stringify(r.info.inventory, null, 2) + '\n');
  return r;
}

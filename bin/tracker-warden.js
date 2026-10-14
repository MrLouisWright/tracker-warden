#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { mainCli, check, RULES, SITE_OPTIONS, SITE_HELP, splitList } from '../src/index.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
mainCli({
  name: 'tracker-warden', version: pkg.version, configKey: 'trackerWarden', rules: RULES,
  tagline: 'inventory third-party trackers, pixels and SDKs in your built site',
  usage: 'Usage: tracker-warden [site-dir] [options]',
  help: `${SITE_HELP}Inventory
      --inventory <file>       Write the vendor inventory as JSON, or CSV if the name ends in .csv
      --approved <vendors>     Approved vendor ids/names/domains; anything else is reported high
      --first-party <hosts>    Extra hosts that count as first party (your CDN, subdomains)
`,
  options: { ...SITE_OPTIONS, inventory: { type: 'string' }, approved: { type: 'string', multiple: true }, 'first-party': { type: 'string', multiple: true } },
  run: async ({ dir, values: o, config, configFile }) => check(dir, { cli: o, inventoryFile: o.inventory, approved: splitList(o.approved), toolVersion: pkg.version }, { ...config, firstParty: [...(config.firstParty || []), ...splitList(o['first-party'])] }, configFile),
});

# tracker-warden

[![npm version](https://img.shields.io/npm/v/tracker-warden.svg)](https://www.npmjs.com/package/tracker-warden) [![CI](https://github.com/MrLouisWright/tracker-warden/actions/workflows/ci.yml/badge.svg)](https://github.com/MrLouisWright/tracker-warden/actions/workflows/ci.yml) [![Node](https://img.shields.io/node/v/tracker-warden.svg)](https://nodejs.org) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> Inventory every third-party tracker, pixel and SDK your built static site loads, with vendor, company and category, and gate CI on an approved-vendor list.

Privacy notices, cookie banners and DPIAs all start with the same question: which third parties does the site actually load? Tags get added through templates, CMS embeds and marketing snippets, and the list drifts. `tracker-warden` reads every built HTML page, finds third-party scripts, inline SDK snippets (`fbq(`, `gtag(`, `_hsq`, ...), tracking pixels, iframes, stylesheets and media, matches them to a vendor database, and produces an inventory plus findings with the file, line, severity and a **concrete fix**.

CLI, library and GitHub Action. Node.js 18+, **zero runtime dependencies**. Works on any static build output (Astro, Next.js `output: 'export'`, Eleventy, Hugo, Jekyll, Docusaurus, VitePress, plain HTML) and runs offline: point it at the folder your build writes. By Louis Wright.

## Features

- **Vendor database:** 45 common vendors (Google Analytics/Ads/Tag Manager, Meta, TikTok, LinkedIn, X, Pinterest, Snap, Microsoft, Criteo, Taboola, Hotjar, Clarity, FullStory, Mixpanel, Segment, Amplitude, Heap, Plausible, Fathom, HubSpot, Intercom, YouTube, Vimeo, Google Fonts, Stripe, reCAPTCHA, Cookiebot, OneTrust, AddThis, Disqus, ...) with company, category, whether the vendor sells or shares data and whether it is cookieless.
- **Detection:** `<script src>`, inline snippets by signature, `<iframe>`, `<link>` stylesheets and resource hints, `<img>` pixels (1x1, hidden, inside `<noscript>`), media and embeds. Unknown third-party domains are reported too.
- **Categories:** advertising, session replay and social widgets (medium), tracking pixels (medium), analytics/tag managers/marketing (low), unknown script domains (low), other third parties such as fonts, CDNs, video, maps, payments (info).
- **Approved vendors:** list your reviewed vendors in `approved`; anything else is reported high, and approved trackers drop to info.
- **Inventory:** `--inventory vendors.json` or `vendors.csv` for your records of processing, DPIA or privacy policy (see policy-drift-warden).
- Text/JSON/SARIF/Markdown output, `--fail-on`, exit codes 0/1/2, allowlist with expiry, severity overrides, GitHub Action with job summary.

### Scope

tracker-warden inventories what the built HTML loads; it does not run a browser, so tags injected at runtime by a tag manager are only visible as the tag manager itself. Cookie attributes are covered by cookie-sentinel, consent behaviour by consent-warden, GPC by gpc-warden and script weight by thirdparty-pulse.

## Rules

| Rule | Default severity | What it means |
|---|---|---|
| `tracker-unapproved` | high | Third party is not on your approved vendor list |
| `tracker-advertising` | medium | Advertising / retargeting pixel or SDK |
| `tracker-session-replay` | medium | Session-replay or heatmap SDK (records user interactions) |
| `tracker-pixel` | medium | Tracking pixel (1x1, hidden or <noscript> image) to a third party |
| `tracker-social` | medium | Social widget that tracks visitors across sites |
| `tracker-analytics` | low | Analytics, tag manager or marketing automation SDK |
| `tracker-unknown` | low | Script or iframe from an unrecognised third-party domain |
| `tracker-third-party` | info | Other third party (fonts, CDN, video, maps, payments, chat, consent) |
| `allowlist-expired` | medium | An allowlist entry is past its `expires` date |
| `allowlist-unused` | info | An allowlist entry matched nothing |

## Install and run

```bash
npx tracker-warden dist
npx tracker-warden dist --inventory vendors.csv
npx tracker-warden dist --approved plausible,stripe,google-fonts --fail-on high
npx tracker-warden public --first-party cdn.example.net --format sarif > trackers.sarif
```

Pages are mapped to URLs the way static hosts serve them: `index.html` → `/`, `blog/index.html` → `/blog/`, `about.html` → `/about.html` (or `/about` with `--clean-urls`). Pass `--base-url` with your public URL, or let it be inferred from canonical / `og:url` tags. Meta-refresh redirect stubs and `404.html` are skipped. `X-Robots-Tag` and `Link` headers are read from Netlify/Cloudflare `_headers` and `vercel.json`.

### Sample output

```text
tracker-warden — https://acme.example
2 page(s); 10 third parties: advertising, analytics, fonts, other, session-replay, social, tag-manager, unknown, video

MEDIUM   about.html:1 LinkedIn Insight Tag (LinkedIn) [advertising, sells/shares data] on 1 page(s), e.g. /about.html [tracker-advertising]
         ↳ fix: Make sure it is disclosed in your privacy policy and only loads after consent.
MEDIUM   about.html:1 AddThis (Oracle) [social, sells/shares data] on 1 page(s), e.g. /about.html [tracker-social]
         ↳ fix: Make sure it is disclosed in your privacy policy and only loads after consent.
MEDIUM   index.html:3 Tracking pixel for Meta Pixel (Meta) on 1 page(s), e.g. / [tracker-pixel]
         ↳ fix: Load pixels only after consent, or remove them.
MEDIUM   index.html:3 Meta Pixel (Meta) [advertising, sells/shares data] on 1 page(s), e.g. / [tracker-advertising]
```

## Options

```text
tracker-warden 1.0.0 — inventory third-party trackers, pixels and SDKs in your built site

Usage: tracker-warden [site-dir] [options]

Site
      --base-url <url>        Public URL of the site, e.g. https://example.com (default: inferred from canonical/og:url)
      --include <globs>       Only check these pages (file or URL path globs, comma-separated)
      --exclude <globs>       Skip these pages
      --clean-urls            Pages are served without .html (about.html -> /about)
Inventory
      --inventory <file>       Write the vendor inventory as JSON, or CSV if the name ends in .csv
      --approved <vendors>     Approved vendor ids/names/domains; anything else is reported high
      --first-party <hosts>    Extra hosts that count as first party (your CDN, subdomains)

Common
  -c, --config <file>     JSON config (default: .tracker-warden.json or "trackerWarden" in package.json)
  -f, --format <fmt>      text (default) | json | sarif | markdown
      --json <file>       Also write a JSON report
      --sarif <file>      Also write SARIF 2.1.0
      --markdown <file>   Also write Markdown (e.g. for a job summary)
      --fail-on <sev>     critical | high | medium | low | info | none (default: high)
      --list-rules        Print rules and default severities
      --no-fixes          Hide fix suggestions in text output
      --no-color          Disable colours
  -v, --version / -h, --help

Exit codes: 0 = passed, 1 = findings at or above --fail-on, 2 = usage, config or read error.
```

## Configuration and allowlist

Options can live in `.tracker-warden.json` (or a `"trackerWarden"` key in `package.json`, or `--config <file>`):

```json
{
  "failOn": "medium",
  "severity": {
    "tracker-unapproved": "low"
  },
  "allowlist": [
    {
      "rule": "tracker-advertising",
      "subject": "meta-pixel",
      "reason": "Meta DPA signed, consent-gated",
      "expires": "2027-03-31"
    }
  ],
  "approved": [
    "plausible",
    "stripe",
    "google-fonts"
  ],
  "firstParty": [
    "cdn.example.net"
  ]
}
```

- **`severity`** changes a rule's severity, or turns it `"off"`.
- **`allowlist`** entries suppress matching findings. Each needs a `reason` and matches on any combination of `rule`, `file`, `subject` (globs with `*`) and `match` (a substring of the message). Add `expires` (`YYYY-MM-DD`) so the exception is time-boxed: once it lapses the finding comes back along with an `allowlist-expired` finding (medium). Entries that no longer match anything are reported as `allowlist-unused` (info).

Config can also set `baseUrl`, `include`, `exclude` and `cleanUrls`. The config file is looked up in the site directory first, then in the current directory, so `.tracker-warden.json` can live at your repository root. Other keys: `approved` (vendor ids, names or domains) and `firstParty` (hosts that count as your own).

## Output and exit codes

- `--format text` (default), `json`, `sarif` (SARIF 2.1.0 for GitHub code scanning) or `markdown` (for job summaries and PR comments). `--json`, `--sarif` and `--markdown` write extra report files in the same run.
- `--fail-on <severity>` sets the threshold (`critical`, `high`, `medium`, `low`, `info`, `none`; default `high`).
- Exit codes: **0** passed, **1** findings at or above `--fail-on`, **2** usage, config or read error.

## GitHub Action

```yaml
permissions:
  contents: read
  security-events: write   # only needed for the SARIF upload
jobs:
  tracker-warden:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4
        with: { persist-credentials: false }
      - run: npm ci && npm run build   # produce the static site first
      - uses: MrLouisWright/tracker-warden@v1
        with:
          path: dist
          fail-on: high
          sarif: tracker-warden.sarif
      - uses: github/codeql-action/upload-sarif@v3
        if: always()
        with: { sarif_file: tracker-warden.sarif }
```

| Input | Description | Default |
|---|---|---|
| `path` | Built site directory (e.g. dist, public, _site) | `.` |
| `base-url` | Public URL of the site, e.g. https://example.com | |
| `fail-on` | Failure threshold | `high` |
| `config` | Config file path | |
| `sarif` / `json` | Write SARIF / JSON report to this path | |
| `job-summary` | Add the Markdown report to the job summary | `true` |
| `args` | Extra CLI arguments | |

The action runs the bundled CLI with Node 20; it has no dependencies to install. Pin it to a commit SHA if your policy requires it.

## Library

```js
import { check, inventory, VENDORS, vendorForUrl } from "tracker-warden";
const report = check("dist", { approved: ["plausible"] });
console.log(report.info.inventory);
vendorForUrl("https://connect.facebook.net/en_US/fbevents.js").name; // "Meta Pixel"
```

Types are included.

## Requirements

Node.js 18 or newer. Zero runtime dependencies.

## Support

If this project is useful to you, you can support its development with a donation: [Buy me a coffee](https://donate.stripe.com/aFa00lek3cvX4Ds2Fk9EI0b). It helps keep these tools maintained, documented and free for everyone.

## Credit (optional)

Free to use under MIT, no attribution required. If tracker-warden helps you, a link back is appreciated:

```html
<a href="https://louiswright.co.uk">Built with tracker-warden by Louis Wright</a>
```

```markdown
[![Built with tracker-warden by Louis Wright](https://img.shields.io/badge/built%20with-tracker--warden-blue)](https://louiswright.co.uk)
```

## Licence

MIT © Louis Wright ([Louis Wright](https://github.com/MrLouisWright))

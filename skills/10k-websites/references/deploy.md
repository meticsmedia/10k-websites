# Deploy: Hostinger from approved site to verified launch

Read at launch. Preserve the user's address and publishing authorization across turns. Continue an already authorized launch without another design review, upgrade pitch or mandatory new chat.

## Accounts, costs and connection

OpenArt generation, GPT usage and hosting are separate. Follow [production.md](production.md) for GPT/media choices; Full throttle does not by itself require an oversized hosting plan. Verify current Hostinger plan features, price, renewal, domain/mailbox eligibility and site limits before recommending a purchase. A plain site needs static file serving; the real inbox also needs PHP with private writable storage. Use the appropriate existing plan when it fits. Do not promise fixed free mailbox counts or unverified discounts beyond the creator-link disclosure in SKILL.md.

If Hostinger already responds, skip setup. Otherwise use the current connector/plugin installation and authentication path exposed by the app. Run supported configuration steps yourself; the user signs in and authorizes access. Ask for a restart only if required by the actual installation state. Verify a read call returns account data. Never print access tokens or edit unrelated app configuration. Use the sign-up link and disclosure from SKILL.md when the user actually needs hosting.

## Discover narrowly, follow actual schemas

The current connector may expose `search`, `execute` and `multi_execute` rather than hundreds of direct tools. Discover only the operation needed and inspect its returned input schema. Old operation names are hints, not authoritative APIs. Do not print the full catalogue.

Typical operation purposes and recent names (verify before use):

| Purpose | Recent operation |
|---|---|
| List sites and existing plan | `hosting_websites_list`, hosting order listing returned by search |
| Inspect available domains | domain portfolio listing returned by search |
| Generate a free address | `hosting_domains_generate-free-subdomain` |
| Create on the selected plan | `hosting_websites_create` with domain and order_id |
| Wait for website setup | `hosting_websites_list-setups` for the domain |
| Upload prebuilt files | `hosting_deploy-static-website` with domain and archivePath |

Verify the account/plan and exact target before mutation. A queued/accepted response is not completion. Follow setup status with bounded waits/backoff before uploading. Do not repeat a create/deploy request simply because it is taking time. Keep progress messages short. Never overwrite an existing unrelated site or guess that an available domain belongs to this brand.

## Address and deployment package

Use the user's already chosen domain/free address. Otherwise inspect their account, then offer a simple choice. A free `*.hostingersite.com` address is valid for preview/launch on eligible hosting; it does not imply a purchased domain or mailbox. Verify actual eligibility. Purchases remain the user's action.

Once the actual address exists, patch canonical, OG, structured-data and backend site URLs. Generate search files without starting a static PHP preview:

```sh
node .10k/tools/report.mjs site review --seo https://their-address --seo-only
```

Use file tools or explicit UTF-8 scripts for patches. Bump changed CSS/JS URL versions before redeployment so cached assets cannot hide the update.

Archive the CONTENTS of `site/`, with `index.html` at the top and all necessary assets beside it. Follow the current deploy tool's archive naming/schema requirements (for example `site_YYYYMMDD_HHMMSS.zip`). Inspect the archive, including hidden `.htaccess` files. With the real inbox include `api/`, protected configuration, `admin/`, `data/.htaccess` and `forms.js`; never package stored enquiries, logs, credentials unrelated to this backend, source masters, `.10k/`, node_modules, review files, or the archive itself. Preserve the existing backend secret/configuration on redeploy so private storage and passwords continue to work. Keep credentials out of version control.

Use the connector's prebuilt/static deploy operation for this plain site and PHP files, when supported by its schema. It needs no Node build. Record the exact target, archive hash, deployment response and subsequently verified version. Wait for completion rather than equating successful upload with a live site.

## Verify independently of the deployment response

- Homepage loads over HTTPS with expected content/version.
- Intended desktop and portrait media return successfully; phones request the intended variant rather than both large files.
- Actual browser forward/reverse scrub, readable captions, navigation, custom interaction, reduced motion and media fallback work without console/resource errors.
- With the real inbox, health reports writable private storage, config/data URLs do not expose source/data, and unauthenticated admin is a setup/login surface. Health does not establish email delivery.
- Run the live phone and desktop report from [launch.md](launch.md). Separately inspect the live `robots.txt`, response noindex headers and page robots tags. Hostinger may override uploaded robots on temporary addresses; a Lighthouse SEO score of 100 does not establish Google indexability. Describe the actual restriction without treating a user-selected preview address as a failed launch.

A new address may need time for DNS/HTTPS setup. Verify the cause and wait with backoff; do not bypass browser certificate protections. Report uncertainty honestly.

## Measure, present and hand over

Measure actual HTML/assets and each video size/arrival time. An HTML fetch alone is not total page weight or real-user speed. The site can contain PHP for the inbox, so do not claim there is no server code. The hero engine may fetch video as a Blob; do not describe it as network streaming without verifying its implementation. Lighthouse lab scores and local request times are evidence for this run, not guarantees for every connection.

Open the verified public HTTPS URL directly and label it as the live site; keep local preview and report links distinct. When an actual browser is part of the user's acceptance workflow, verify that address there when available rather than assuming a local HTML file or embedded preview represents the deployment. Open the phone report separately. Invite a check on the user's physical phone: ordinary scrolling, faster flicks, reverse scroll, the film's entry/exit and the CTA. Record physical-device confirmation separately from emulation.

For the real inbox, finish the distinct owner-activation and delivery steps in [backend.md](backend.md). Hand over the live site while clearly identifying any remaining owner-only action. Future authorized updates use the same target, preserve approved assets/backend state, bump versions, redeploy and verify the changed live content.

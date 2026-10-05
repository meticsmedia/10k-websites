# The Launch Kit: Brand Assets, the Launch Report, and the Client Kit

## Brand kit (every build, end of Phase 8)

Run from the website folder:
```sh
node .10k/tools/brand.mjs site --name "Your Business" --tagline "One line about what you do" \
  --bg "#f4efe6" --ink "#241d16" --accent "#b5652e" --image site/assets/hero-poster.webp [--logo site/assets/logo.svg] [--font fonts/Display.ttf]
```
It writes the favicons, app icons, the web manifest and `og.jpg` (the picture shown when the link is shared), and prints the `<head>` tags. Look at `og.jpg` yourself: the name must be readable and the photo must be the brand's best frame. With no logo it draws a monogram in the brand colours; when the user sent a logo, save it as SVG (trace simple marks by hand as clean SVG paths) or pass a PNG. `--font` takes the display font's .ttf or .otf file (Google Fonts offers a download) so the share picture uses the brand's own type.

## Search basics (every build)

- On every page: `<title>` under 65 characters, a meta description of 50 to 160 characters, `lang` on `<html>`, exactly one `<h1>`, alt text on every meaningful image, and a canonical link.
- On the home page, structured business data as JSON-LD, with the most specific type that fits: `Hotel`, `Restaurant`, `Store`, `Dentist`, `LegalService`, `HomeAndConstructionBusiness`, `ProfessionalService`, or `LocalBusiness`. Include name, description, address, telephone, opening hours, price range and `sameAs` social links when they are real. Never invent any of them.
- Canonical, hreflang and og addresses must be full `https://` addresses. They are patched in at the DEPLOY STEP comments.
- After the address is settled: `node .10k/tools/report.mjs site review --seo https://their-domain.com --seo-only` writes `sitemap.xml` and `robots.txt`.

## The launch report (after going live, Phase 10)

```sh
node .10k/tools/report.mjs https://their-domain.com review
```
It runs Lighthouse for phone and desktop (installed once, about 170 MB) and prints Speed, Accessibility, Best practices and SEO, plus the search basics per page. Fix anything under 90 that the report names (usually image sizes, contrast, a missing label), redeploy, and run it again. Then open `review/lighthouse-mobile.report.html` in the browser for the user. Treat technical scores separately from creative quality and actual inbox delivery; a high score does not prove a distinctive design or working email. Scores vary between runs; report measured results without promising 100. The report also checks live robots rules, robots meta and noindex response headers. Inspect any Googlebot restriction separately: hosting can override uploaded robots even when Lighthouse SEO passes. A preview-domain indexing restriction is a disclosed limitation, not a reason to purchase a domain without authorization.

## Client mode (Phase 2 asks: your business, or a client's?)

When the site is for a client, three things change:
1. **The preview link.** Before the client pays for a domain, use an eligible temporary Hostinger address (`deploy.md`, Address and deployment package) so the builder can share a real link. Follow the existing publishing authorization. When the client approves, connect their domain.
2. **Ownership.** The client's hosting and domain should be in the client's own Hostinger account, with the builder added as a collaborator if Hostinger offers it. Say this plainly: the client owns their site.
3. **The client kit**, made at the end of Phase 10. Write `.10k/kit.json` from the design package and the plan file (the format is at the top of `tools/kit.mjs`), then run:
```sh
node .10k/tools/kit.mjs .10k/kit.json site client-kit
```
It writes `client-kit/brand-guide.pdf` (colours, type, voice, words, photo style, share picture) and `client-kit/handover.pdf` (their addresses, what they own, renewals, how to ask for changes, what is not included), with PNG previews. Look at both previews before showing the user. The kit is outside `site/` and never goes online.

## Private backend and local tooling

Use `--seo-only` to generate sitemap/robots without serving the backend or running Lighthouse. The safe local server blocks PHP, private folders, dotfiles and escapes; it cannot execute a PHP inbox. Use the live URL for final reporting. Never publish local reports, tool dependencies or private configuration as a preview artifact. If brand rendering ignores a supplied font, verify the generated image; configure the project-local font renderer or use the supported font file rather than shipping the fallback silently.

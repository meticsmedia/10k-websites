# Upgrades After the First Build: More Pages and a Second Language

Start with the scope the user requested, commonly one complete page. Offer additional pages/languages only when relevant after preview, without delaying an already authorized launch. Estimate actual additional writing, imagery and review effort for this project; do not promise fixed fractions of GPT usage or generation cost.

## More pages (multi-page site)

Offer it when the business has several things a visitor wants to look at closely: rooms, dishes or menus, services, projects, products. A detail page per item is what makes a site feel like a $10,000 site rather than a landing page.

**Structure:**
```
site/index.html             the home page (the scroll scene stays here)
site/services/consultation.html   one page per item, in a folder named for the group
site/about.html             optional: the people and the story
site/contact.html           optional: when the form deserves its own page
```
- Use root-relative links and assets on every page (`/style.css`, `/assets/consultation.webp`, `/services/consultation.html`), so pages in folders find them.
- One shared header and footer, copied onto every page identically, with the header marked `class="site-header"`.
- Every page gets its own `<title>`, meta description, one `<h1>`, canonical link, and share picture.
- Inner pages do not repeat the scroll scene. Give them an `expand` or a large still hero instead (`effects.md`).
- Add `pages.css` (from the skill's `engine/`) to every page. It makes page changes flow smoothly. For the "photo grows into the next page" moment, give the card photo on the home page and the hero photo on the detail page the same `style="view-transition-name: item-consultation"`. Each name once per page.
- Keep the one call to action on every page, linking to the same form.

`check.mjs` checks every page and every link between them. `report.mjs --seo https://their-domain.com --seo-only` lists every page in the sitemap.

## A second language

Offer it when the business serves customers who speak another language (tourists, a bilingual city, cross-border customers), or when the owner's own language is not English.

**Structure:** the main language at the root, the second in its own folder with the same file names:
```
site/index.html        (lang="en")
site/es/index.html     (lang="es")
site/es/services/consultation.html
```
- On every page: `<html lang="..">`, and `<link rel="alternate" hreflang="en" href="https://domain/">` plus `hreflang="es"` pointing at each version, with full https addresses.
- A language switch in the header that links to the same page in the other language (not the home page), labelled with the language's own name ("Español", "English").
- Write the second language as a native copywriter would, in the brand's voice, from the design package. Do not translate brand names, product or place names that are proper names, or the owner's quotes. Adapt dates, prices and phone formats.
- Ask the owner (or someone they trust) to read the second language before it goes live, and say so plainly: "I write good Spanish, but a native speaker should read it once before launch."
- Forms work the same in both languages; give each form its own `data-k-form` name (`booking-es`) so the inbox shows which language the visitor used.

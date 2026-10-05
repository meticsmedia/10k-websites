# The Effects Library

`engine/fx.js` and `engine/fx.css` hold ready-made effects modelled on the most-used patterns in today's premium component libraries, rebuilt for plain HTML so they run on any host with no build step. Copy both files into `site/` unchanged, like the scene engine. Switch an effect on with `data-fx="name"` (several names can share one element: `data-fx="glass magnet"`), tune it with `data-fx-*` attributes, and theme it with CSS variables (`--fx-accent`, `--fx-radius`, `--fx-gap`, `--fx-ease`). Never rewrite an effect by hand: it costs usage and the result is worse.

Every effect already handles reduced motion (final state, no movement), phones (pointer effects switch off on touch screens, pinned effects become swipeable rows) and off-screen pausing.

## Choosing effects

- **Choose effects for the story.** Plan a signature interaction (see `design.md`) and supporting motion with a clear purpose. There is no effect quota; quieter passages let stronger moments land.
- **Match the effect to the business's job**, not to what looks impressive:
  - Places (hotels, restaurants, venues): `expand`, `rail`, `shift`, `reveal`
  - Services and trust (clinics, consultants, trades): `split`, `count` (only real numbers), `columns` for real reviews, `spotlight`
  - Products and apps: `tilt` for a screen or product shot, `spotlight`, `marquee` for real press or partner names, `aurora`
  - Makers and portfolios: `reveal`, `rail`, `hover-tilt`, `paths`
- **Never fake content to fill an effect.** `count` needs a true number, `columns` needs real reviews (or clearly labelled samples on a demo), `marquee` needs real names.
- Put the call-to-action button in `glass` (over pictures) or `magnet` (on plain grounds). Not both styles on one page.

## The catalogue

**expand**: a picture or clip starts as a card and grows to fill the screen as the visitor scrolls, while two halves of a headline slide apart. The best "second hero" after the scroll scene, or the hero itself on inner pages.
```html
<section data-fx="expand" data-fx-span="2">
  <div class="fx-expand-stage">
    <div class="fx-expand-media"><img src="assets/workshop.webp" alt="Describe the photo"></div>
    <div class="fx-apart" aria-hidden="true"><h2>First</h2><h2>Word</h2></div>
    <div class="fx-expand-text"><p>One line that the full picture earns.</p></div>
  </div>
</section>
```
`data-fx-span` is the scroll length in screens (1 to 3).

**tilt**: a framed screen or product shot leans back and settles flat as it arrives. Ideal for app screenshots and menus.
```html
<section data-fx="tilt"><div class="fx-tilt-frame"><img src="assets/app.webp" alt="The booking screen"></div></section>
```

**rail**: a row of pictures moves sideways while the section stays pinned. On phones it becomes a swipeable row.
```html
<section data-fx="rail"><div class="fx-rail-stage"><div class="fx-rail-track">
  <figure class="item">...</figure><figure class="item">...</figure><figure class="item">...</figure>
</div></div></section>
```
Size the items in `vw` (for example `width: 38vw`) so the track is wider than the screen.

**shift**: the whole page's background and text colour change as the visitor scrolls, for example from a light ground to a dark one for the closing sections. Put it on `<body>`, then use `var(--fx-bg)` and `var(--fx-ink)` wherever a section should follow it.
```html
<body data-fx="shift" data-fx-stops="0 #f4efe6 #241d16, 0.6 #f7e3c8 #241d16, 1 #221b25 #f3ece2">
```
Each stop is: position (0 to 1), background, text colour. Check contrast at every stop.

**spotlight**: a soft light follows the pointer across a grid of cards and lights their edges.
```html
<div class="cards" data-fx="spotlight" style="--fx-accent:#f3c98b"> <article class="card">...</article> ... </div>
```
Cards need a border radius and a background; it looks best on darker grounds.

**hover-tilt**: a card leans toward the pointer with a moving glare. One row of cards at most. `data-fx-max="8"` sets the angle.

**magnet**: a button pulls gently toward the pointer. `data-fx-strength="0.35"`.

**glass**: a glassy button or badge with a moving sheen, for use over pictures and the scroll scene. Style its text colour and padding as usual.

**reveal**: a list where hovering a row shows a floating photo beside the pointer. Great for rooms, dishes, projects, services.
```html
<ul data-fx="reveal"><li data-fx-img="assets/consultation.webp"><a href="services/consultation.html">Consultation</a></li> ... </ul>
```

**split**: a headline whose words rise into place when it first appears. `data-fx-split="chars"` animates letters instead (short headlines only). Use where an entrance helps the reading rhythm. The splitter preserves authored inline elements and line breaks, keeps one accessible name, and avoids assigning an invalid aria-label to a generic span. Do not place interactive content inside split text.

**words**: one word in a sentence cycles through a list. `data-fx-words="calm,warm,yours"` and optional `data-fx-every="2400"` (milliseconds). Screen readers hear the whole list once.

**count**: a number counts up when it appears. `data-fx-to="12480"`, optional `data-fx-prefix="€"`, `data-fx-suffix="+"`, `data-fx-decimals="1"`. Only true numbers.

**columns**: two or three columns of reviews drift upward forever and pause on hover. Phones show one column.
```html
<div data-fx="columns" style="--fx-height:620px">
  <div class="fx-col"><blockquote class="review">...</blockquote>...</div>
  <div class="fx-col" data-fx-seconds="46">...</div>
</div>
```

**marquee**: a row that drifts sideways forever (press names, partner logos, dishes). `data-fx-seconds="40"`.

**paths**: slow flowing lines drawn behind a section, in `currentColor`. Set the section's `color` to a quiet brand tone. `data-fx-lines="18"`.

**aurora**: a soft moving colour field behind a section, initialized only near the viewport, with drawing paused off screen and on hidden tabs. Reduced motion uses the static CSS fallback without creating a WebGL context. Measure real startup/scroll cost; a graphics effect is not inherently cheap. `data-fx-colors="#f3d9b1,#e9a87c,#7a9ea8"` (three brand tones). Keep text over it high-contrast.

## Page changes (multi-page sites)

`engine/pages.css` makes moving between pages feel like one continuous site in Chrome, Edge and Safari; other browsers load pages normally. See `pages.md`.

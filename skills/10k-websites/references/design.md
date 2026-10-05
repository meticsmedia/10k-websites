# Design: what makes it look like $10,000

The engine keeps the page from breaking. This file keeps it from looking like a template. Read it in Phase 3 (before proposing concepts) and again in Phase 8 (before building). Every production level gets ambitious art direction. The selected `production_level` changes the resources available for exploration, generation and refinement, not the standard of taste.

## Start from the visitor's job

Before any layout, answer one question: what does a visitor come here to do? The answer sets the order of the page, and it is why two sites built with this skill should never share a skeleton.

- **To choose between options** (rooms, dishes, services, products): the options come early, shown side by side, each with its real price or a clear "from" price.
- **To trust someone** (a coach, a clinic, a lawyer, a builder): the people and the proof come early; the method follows.
- **To feel a place** (a hotel, a restaurant, a venue, a studio): the hero carries it, then details for planning the visit: rooms, menu, hours, location.
- **To understand something new** (an app, a new kind of service): a plain-words "what it is" right after the hero, then how it works in three steps, then what it costs.
- **To see the work** (portfolios, makers, photographers): the work itself fills the page, with few words between pieces.

Then write the section list as sentences ("Rooms: three side-by-side cards with the view each room gets"), not as generic labels. If the list reads like every landing page (features, testimonials, pricing, FAQ, contact), rearrange it around the visitor's job until it does not.

## One world

Commit to one direction pulled from the subject's own world, and let it drive palette, type, motion and imagery together, so the page and the hero read as one place.

- **Palette with roles:** a ground, a raised surface, primary text, softer text (tinted toward the ground, never flat grey), a line colour, and one accent. Sample the ground and text tones from the hero itself. The canvas is never pure black or pure white.
- **The accent is rare:** the call to action, focus rings, and one or two moments of emphasis. An accent that is everywhere is not an accent.
- **Two type families, maybe a third for small labels.** A display face with real character and a quiet body face. Never Inter or Roboto as display. Load only the weights in use.
- **One environment:** carry the subject's light, materials and atmosphere through the page. A background texture or slow glow can help when it belongs; a mandatory animated backdrop cannot create coherence on its own.

## One signature, one peak

- **Invent one signature element** that exists only on this site, drawn from the subject (the effects in `effects.md` are a toolbox for it, not a substitute): a line that traces the route a delivery takes, a menu that opens like a folded card, a price that counts like a till. Test it: if you removed it, would the page change? If not, it is decoration, not a signature.
- **Choose where the page peaks.** One moment gets the best image, the most room, and quiet around it. Usually that is the hero's ending or the first section after it. Supporting moments sustain interest through the whole page, with differences in scale and intensity so the climax still lands.
- **End well.** People remember the ending. The last screen is designed, not a leftover footer: the call to action, a closing line in the brand's voice, and the footer beneath.

## Composing the page like a studio

Treat layout recipes as a vocabulary, not a quota. A strong page has an intentional sequence of scale, density, image, type and interaction. Judge the whole experience by these outcomes:

- **Confident scale and hierarchy.** Let the brand's display type and best imagery take up real space. Use dramatic scale contrasts when they suit the idea, while preserving legibility and useful content. A large headline is not an excuse for six screens of empty space.
- **A distinct rhythm.** Give neighbouring sections different jobs and pacing. A statement, an immersive image, a pinned story, a gallery, an index and a quiet proof section are possibilities, not a compulsory sequence. Repeat a structure when comparison benefits from consistency, not because it was easy to copy.
- **Composition with depth.** Consider full bleed, asymmetric alignment, overlap, layered captions and pictures that break the grid. Choose them because they strengthen the subject, not to meet a count. Check their phone equivalents at the same time.
- **Substance throughout.** Every section has a meaningful focus: something worth seeing, an explanation worth understanding, or an action worth taking. Names, materials, times, prices and real proof support that purpose; clearly mark samples for an invented brand. A spectacular hero cannot carry a generic lower page. Type and generous space alone do not establish premium composition, and adding an ornament or button to every section is no remedy.
- **Purposeful imagery.** When the approved direction calls for supporting imagery, commission a coherent set of distinct pictures for the page, not crops of the hero reused as filler. A deliberate repeated motif or comparison is fine when it has a clear purpose. Large products, work and interfaces should be visible enough to assess. An intentionally image-light direction can earn its impact through type, content and composition.
- **One recognizable signature.** The custom interaction, mark, composition or motion device grows from the brand's idea. The effects library supports that invention; checking off a set of effects does not replace it.
- **A composed ending.** Give the final action, brand and real contact details the same care as the first screen.

Prefer the bolder treatment when both versions communicate equally well. Readability, accessibility and loading performance remain the floor. When an independent reviewer is available, have them identify the weakest non-hero section and explain what fails for the visitor. Otherwise, perform a separate critical pass and record it as self-review. Compare at least one relevant alternative composition there or at another moment with greater creative leverage; within Full throttle's approved exploration allowance, compare genuinely different art directions rather than cosmetic variations. Implement the stronger treatment within the accepted direction and allowance without adding an approval gate. Escalate only a material change in direction or scope.

## Prove the direction visually

Before completing the page, show a small working visual treatment: the hero with its actual type and intended motion, one representative lower section, and a phone view. Use approved assets as soon as they are available. Temporary imagery must be labeled; it cannot establish final fidelity or film approval.

The user should be able to judge the scale, composition, atmosphere and movement by looking. A storyboard table alone is insufficient. Fold this review into the existing creative gates, carry prior approvals forward, and request a new decision only when the direction materially changes. Record the selected treatment and what changed in `.10k/design-package.md`.

Before accepting the finished page, inspect settled viewport crops of every lower section with fonts, imagery and entrances complete. Use relevant wide, ultrawide and phone widths; a full-page thumbnail can hide weak focus, excess empty space and unreadable detail. Judge each crop and its transition to the next section against the visitor's job. Keep the strongest evidence and the alternative's rationale with the review.

## Type as part of the scene

Motion-linked hero typography is required. Plan it with the storyboard, then remap it to observable cues in the actual selected film before final implementation. For each principal headline, identify the camera or subject motion it responds to, its starting position/scale, the direction and timing of its transform, and where it settles for reading. A travelling line might follow a subject's path, separate as an opening appears, change scale with an approach, or sit on a surface in the scene (a wall, a street, a table, a product face) and move exactly as that surface does. These are examples, not a prescribed direction or effect. When storyboarding, give each headline's moment a flat, textured, calm surface held long enough to read on, and away from the main action: it makes the type trackable (see `engine.md`, "Words fixed to the film"). A deliberate stationary reading plateau belongs within the choreography; an otherwise generic rise/fade does not satisfy it.

The relationship must be visible and specific to the footage, with the action lane clear. Do not move every word continuously or copy every camera movement literally. Author the phone path, amplitude and line breaks against its own film framing; shrinking desktop type is insufficient. If a film changes, revisit its cue map and verify the replacement.

Use the existing engine and effect outputs with project CSS/JavaScript; never rewrite the supplied engine. Type must reproduce the same state at the same media/progress position after forward, reverse or arbitrary seeks, without a separate running clock. Keep body copy and primary controls easy to read and use. Give reduced motion and unavailable media a complete static composition, preserve emphasis such as italics, and expose each animated heading as one complete accessible name. Ship a real font file for every style the page uses, including the italic: with only the upright file, browsers fake the slant and the type looks cheap. Implementation and synchronization checks are in `engine.md`.

## Composing the hero picture (before generating)

Plan the hero as a film with distinct narrative beats; opening, event and reveal are a useful starting structure (`shots.md`). Compose each like a stage set:
- **The reveal frame is the poster.** It is where the page comes to rest, so compose it first: the subject in its finished state, a calm zone for the header and one line of words, light that feels arrived. Repeat it lower down only for a deliberate narrative purpose.
- **The opening and the event are new shots of the same world:** from the sky, as parts flying apart, a drop about to explode. Each is a picture worth a screenshot by itself, with a different camera position, scale and state from the reveal. Big difference, same world.
- **A calm zone for the words** in the opening and the reveal, decided before generating: sky, a plain wall, soft shadow, dark space above a product. The action keeps out of it. The event can fill the frame; the motion speaks there.
- **Phones get their own composition.** Plan the complete wide and portrait story before final assets. A crop can work when every beat and transition survives, not merely the last frame. Pass the crop position as `--focus`; use a dedicated portrait treatment when it improves the experience within the selected production allowance (see `mobile.md`). Recompose headlines for phones rather than just shrinking them.

## Type and spacing that feel expensive

- **Tight, but readable.** Set display spacing for the actual font, weight and size. Inspect word separation, collisions and wrapping across phone and wide layouts; a universal tracking number cannot judge every typeface. Headline motion must preserve that readability while moving and at rest.
- Body text 17 to 20 px, line length 45 to 75 characters, line height about 1.5 to 1.65. Size text measures in `ch` on the text element itself, never on a container.
- Big headlines get tighter letter spacing and a line height near 1; small caps and labels get looser spacing.
- Light text on dark grounds looks heavier than it is: use a slightly lighter weight, a touch more spacing, and a little more line height.
- Use one spacing scale (for example 4, 8, 12, 16, 24, 32, 48, 64, 96, 128) and more space above a heading than below it. Section padding grows with the screen, so phones do not inherit desktop air: `padding-block: clamp(64px, 12vw, 160px)`.
- Rows of text align on the baseline, not centred boxes.
- Depth comes from overlap, soft offset shadows, a fine edge light, and scale. Not from borders around everything.

## Motion outside the hero

- **Nothing snaps.** Two easing curves as tokens, used everywhere.
- **Entrances are choreography:** `data-k-in` adds `.is-in`; children arrive in sequence 60 to 150 ms apart (`style="--d:1"` and so on). Retire the stagger delays after the entrance so hovers do not lag.
- **Movement has a purpose.** A light sweep, slow turn or drifting detail can sustain the world; quiet sections can stay quiet. Avoid compulsory loops in every section. Defer expensive effects until they are near the viewport, and stop motion on hidden tabs or for reduced motion.
- **Animate only `transform` and `opacity`.** For a glow, animate the opacity of a pseudo-element that holds the shadow.
- **A designed interaction, when it serves the visitor,** lets them act out the brand's idea: drag a slider to compare a room before and after a renovation, press and hold to let the dough rise, hold to let steam rise off a cup. Progress eases back if they let go early; finishing reveals something real. Reduced motion gets the finished state.

## Things that make a page look machine-made (avoid unless the brand truly calls for it)

- Rows of identical cards with an icon, a title and two lines, repeated section after section.
- Two neighbouring sections with the same skeleton (small label, big headline, paragraph, same grid). Reshape one.
- Numbered labels on every section ("01 / Rooms"), "scroll down" arrows, and gradient-filled headline text.
- Invented numbers, logos of companies that are not customers, fake reviews, and dashboards that show nothing real. For a real business, never fabricate testimonials, awards or counts; use clearly marked placeholders. For an invented brand, label sample content as sample.
- The default palettes: cream with a serif and terracotta, near-black with acid green or with warm amber, violet-to-blue gradients, and hairline-border brutalism. They are fine when they truly are the subject's world (a pottery studio really lives in clay tones); then sample the tones from the photos and make the signature element carry the page.
- Emoji as icons, glass cards on everything, and everything centred.

## Copy

Write in the buyers' own words (from the Phase 3 research), in the brand's voice. Short lines sized to one flick of scroll. No em dashes. No stock words: leverage, seamless, empower, unlock, robust, actionable, data-driven, solutions, elevate, testament, landscape, delve. No "it's not just X, it's Y". One call to action, repeated at most three times, always worded the same.

## The quality floor (every build)

- Semantic landmarks: `<nav>`, `<main id="main" tabindex="-1">`, `<footer>`, a skip link, one `<h1>`, a real heading order, `aria-hidden="true"` on decoration.
- Contrast computed, not guessed: 4.5:1 for body text, 3:1 for large text and control borders.
- Styled `:focus-visible` in the accent. Touch targets at least 44 px under `(pointer: coarse)`.
- `overflow-x: clip` on both `html` and `body`, with `hidden` declared first as a fallback.
- Real `<title>`, meta description, `theme-color`, an inline SVG favicon, and og tags marked `<!-- DEPLOY STEP -->` for the live URL.
- Images in WebP at the size they display, `loading="lazy"` below the hero, with `width` and `height` set.
- Reduced motion honoured completely: final states shown, no stagger, no loops.

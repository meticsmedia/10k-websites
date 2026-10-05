# The Design Package

Written in Phase 5 and saved as `.10k/design-package.md`. One living document that records the creative plan before generation and the approved decisions as production progresses. The build in Phase 8 consumes it directly. Save it for continuity without making the user open a new chat. If a handoff is needed, the next agent should have enough context here to continue.

Two rules govern it:

- **Every line of copy in the package ships verbatim.** The package is where the writing happens; the build is where the wiring happens. Build passes wire the authored lines in exactly and never paraphrase them.
- **Numbers are starting points.** Band ranges and plateau numbers here are labeled starting points. `check.mjs` (see `engine.md`) validates them later, and the ranges move if the test says so.

A single-scene hero (video or depth) gets the same package, trimmed: fewer bands, same sections.

The user sees a concise **Visual Story** and an early working visual treatment, rather than needing to read the production document. Keep them in sync: each story row maps to a band or section with the same words. The treatment shows the hero, a representative lower section and a phone view with actual typography and intended movement. Incorporate it into the existing creative gates and carry approvals forward.

## 0. The page backbone

The visitor's job (from `design.md`), the section list written as sentences, the signature element, the page's climax and its supporting moments.

Record `production_level` (`focused`, `studio` or `full-throttle`), the selected current GPT model and reasoning setting, image and video models with selection evidence, the approved cost estimate, creative exploration and repair allowance, and the mobile plan. Full throttle keeps the strongest current GPT available throughout and uses the strongest current suitable photo/video models at high-quality settings. Track approval and actual spend separately from ChatGPT usage limits; never silently downgrade.

## 1. The brand premise

One short paragraph built on ONE real word or idea from the subject's world, and the whole site teaches and sells that one idea. Every section, the interactive moment, and the closing line all serve it. If a section does not serve the premise, it does not belong on the page.

## 2. The palette as CSS tokens

Sampled from the world of the footage, so page and video read as one place. Before generation the package names the palette direction from the storyboard's world; the exact token values get finalized from the approved footage after the video gate. Named roles, ready to paste into the build:

```css
:root{
  --canvas:#___;        /* page background, tinted toward the footage's grade, never pure black or white */
  --panel:#___;         /* cards and raised surfaces */
  --accent:#___;        /* the CTA and rare emphasis */
  --accent-hover:#___;  /* the accent's hover state */
  --accent-muted:#___;  /* the accent at whisper level: borders, glows, particles */
  --text-secondary:#___;
  --text-primary:#___;
}
```

## 3. The type and motion direction

Choose a distinctive display face and quiet body face, with a label face only if useful. Never Inter or Roboto as a habitual display default. Name the faces, exact weights, scale relationships and wide/phone line breaks. For each principal hero headline, record the actual film cue, the corresponding text transform and settled reading state; motion-linked type is mandatory, not an optional entrance effect. For words fixed to the film, also record the surface, its reference frame and region, masks, motion model, tracked frame range and proof-sheet result (`track.mjs`). Name every font file shipped, including italics. Include authored phone choreography and the accessible static composition for reduced motion or unavailable media. Preserve semantic headings and authored emphasis through split effects.

## 4. The shot and the band map

**The shot** comes first, written clearly enough to produce without asking the user to write prompts:
- The original shot idea or adapted inspiration from `shots.md`, and the story beats: opening, event, reveal.
- **REST frame prompt** (verbatim, text to image).
- **OPEN and EVENT frame prompts**, plus any additional story beat. Each is a new composition; record identity references and the traits they must preserve separately from the camera position and state that must change.
- **The product in words:** the signature details every keyframe prompt repeats (shape, materials, colours, the detail people recognise).
- **Scene contract:** authoritative source versions and invariants such as component counts, design, materials, topology and relative placement. For each view, distinguish intentional changes from matched, changed, occluded or uncertain details. Assign each reference an identity, composition or detail-quality role; follow [visual-validation.md](visual-validation.md) rather than treating multiple views as interchangeable camera instructions.
- **Route and take contract:** start distance/height and bearing, travel or transformation path, expected parallax, physical passage, arrival bearing, pace curve and required velocity at any join. Explain continuous-take versus chain selection. Identify which story frames are actual model inputs and which are guides; an endpoint picture does not establish speed. Record the representative pilot, its hardest requirement and the evidence required before dependent clips/formats proceed.
- **One video prompt per clip** (verbatim), model and quality settings, current capability evidence, exact preflighted cost and which approved allowance covers it.
- The complete portrait story: crop position (`--focus`, 0 to 1) when suitable, or dedicated portrait keyframes/clips when that improves the result within the approved plan.
- Approved source filenames, clip durations, chosen joins and final-film duration; record any user-approved pacing changes.
- **Asset dependencies:** link each selected film version to its source frames/references, and each delivery file, poster and wide/phone type cue map to that film. Record acceptance evidence, intentional departures and unresolved limits. A replacement invalidates affected downstream review until rechecked under [visual-validation.md](visual-validation.md); retain rejected/superseded versions distinctly.

Then the hero choice's `data-k-span` and one table, one row per hero band:

| Band | Range (starting point) | Film cue and time | Copy (verbatim) | Linked type motion and resting state |
|---|---|---|---|---|
| 1 | 0 to 0.28 | identifiable camera/subject movement; provisional time | "The exact words." | transform direction/scale, readable hold, authored phone path |
| 2 | 0.36 to 0.62 | ... | "..." | ... |

- **Range:** a starting point in scroll progress, sized with the rule in `engine.md` and validated later by `check.mjs`.
- **Film cue:** the observable camera/subject movement and its time window in the selected film. Before footage exists, mark these provisional. Finalize against the actual wide and phone films, record their source/version, and map their cue times to the media/progress driver used by the implementation. Keep the action lane clear.
- **Copy:** the exact final words, in the brand's register.
- **Type choreography:** how text travel, scale or orientation responds to that cue, plus its readable plateau, legibility system, separate phone values and static state. Opacity may support the motion but does not establish the relationship alone. Record how reverse/arbitrary seeking restores the same state (see `engine.md`). For tracked type: the surface name, the frames it fades in and out, and whether it is seen through an opening.

## 5. The static-hero copy block

The composed copy for visitors who get the static hero (reduced motion, unavailable video or the chosen phone fallback): headline, subline, and CTA, written to stand over the poster or ending frame with no journey behind them.

## 6. The below-fold outline

The sections after the settle, in order. Each records its purpose, composition, imagery and verbatim copy. Use the layout ideas in `design.md` as a vocabulary, not quotas; explain deliberate repetition when it helps comparison or storytelling. Every section funnels to ONE call-to-action anchor. The outline includes:

- The signature interaction or visual device, its purpose, and where it lives.
- The representative lower section used in the early visual treatment, including how its type and motion continue the art direction.
- The FAQ, answering the real objections found in research, in the buyers' own words.
- The quotes or testimonials copy.
- Form labels, placeholders, button, honest success/error states and the selected handling route from `backend.md`. A preview form cannot claim that an enquiry was sent. Record the real inbox recipient, owner activation and email-delivery verification separately from website deployment.
- The footer, with the fictional-brand disclosure when the brand is invented.

## 7. The vector layer plan

The SVG elements you will draw by hand (motifs, self-drawing lines, dividers), the whisper-level particles, and where each one lives on the page. All of it honors reduced motion: final states shown, drives stopped.

## 8. The engineering list

The engine files copied unchanged, the hero markup (from `encode.mjs` or `depth.mjs` output), the legibility layers per band, any `--k-p` touches, the planes, the static-hero layout, and the quality floor in `design.md`.

## 9. Review evidence

Record the early visual treatment, selected direction, reviewed desktop and phone screenshots, approved film and join checks, functional checks and before/after design scores. Include playback evidence for the film-cue/type map: cue time, expected movement, observed result, forward/reverse and arbitrary-seek checks, and static fallback. Name concrete changes and their evidence; do not raise a score merely because a tool passed. Keep limitations explicit, including a physical-phone check or unverified email delivery.

## 10. The copy gate line

End the package with the gate, stated so the build inherits it: every viewer-facing line above ships verbatim, and review copy for uninvited stock phrasing before presentation. Apply the Phase 9 copy checks to the finished site; they do not block the earlier working visual treatment. Deliberate brand devices written in this package (a designed triplet, a planned staccato punch) are craft and stay; the sweep hunts what drifted in uninvited.

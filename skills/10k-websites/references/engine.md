# The Scene Engine: building the hero

The hero runs on two files that ship with this skill: `engine/scene.js` and `engine/scene.css`. Copy both into `site/` unchanged. Never edit them for a project and never rewrite them from memory: that is where most bugs and most wasted usage came from. The page's own look lives in its own stylesheet, and anything bespoke reads the `--k-p` variable the engine publishes.

What the engine already handles, so you never write it: the pinned stage, smoothed progress, video loading as a Blob (works on hosts without partial downloads) with a loading ring, gated seeks, captions that fade on scroll ranges, the WebGL depth scene, pointer drift, phone and reduced-motion gates that update live, reveals below the hero, and a render loop that rests when nothing moves.

## Project layout

```
my-site/
  site/            the only folder that goes online
    index.html
    scene.js       copied from the skill's engine/
    scene.css      copied from the skill's engine/
    fx.js, fx.css  the effects library, copied from the skill's engine/ (see effects.md)
    filmtype.js, filmtype.css   words fixed to the film, copied from engine/ (optional)
    filmtrack.js   written by tools/track.mjs (optional)
    pages.css      only for multi-page sites (see pages.md)
    style.css      this site's own look
    assets/        web-ready images and clips only
  photos/          the user's originals (never online)
  review/          candidates, raw renders, check output (never online)
  .10k/
    plan.md        decisions, budget, spend, phase reached
    tools/         copied from the skill's tools/, with node_modules
```

Set up the tools once before their first use (including early visual/film review): copy the skill's `tools/` folder to `.10k/tools/`, then run `npm install --ignore-scripts` inside it (about 1 to 2 minutes). Add `.10k/`, `photos/` and `review/` to nothing that gets zipped.

## Choosing the hero (Phase 4, decided per concept)

Use `shots.md` as inspiration and choose a structure for this story. These are useful starting points, not fixed lengths or a closed menu. Quote the actual supported durations and exact model settings:

- **Story journey.** For example, three designed keyframes (the opening, the event and the reveal) and two clips: the camera plunges through the clouds, bursts out over the valley and lands at the front door; the parts rush in from every side and assemble; a drop explodes into spray and the bottle forms out of it. Price the actual stills and clips through `openart.md`.
- **Epic journey.** Four keyframes and three clips, about 15 seconds, when the story has a fourth moment worth seeing.
- **Single shot.** Two keyframes and one 5-second clip. A valid compact story when it suits the brief; do not substitute it for approved Full throttle production to save credits.
- **Layered depth scene.** One still (often the user's real photo, polished) plus a locally generated depth map. The camera pushes in slowly as the visitor scrolls and near things move more than far things. Choose it for an appropriate still-image concept or an explicitly agreed lower-cost route. A credit shortfall does not automatically replace Full throttle video with depth; preserve the selected production policy.

Say it like this: "Your opening scene is a 10-second film: [the opening], then [the event], and it lands on [the reveal]. About X credits, with room for redos. I recommend it because..."

## Hero markup

**Video scene:**
```html
<section class="hero" data-k-hero data-k-span="5" aria-label="Your Business, a short description of the scene">
  <div class="k-stage">
    <video data-k-scrub data-src="assets/hero.mp4" data-src-mobile="assets/hero-m.mp4"
           data-poster="assets/hero-poster.webp" data-poster-mobile="assets/hero-m-poster.webp"
           data-bytes="5400000" muted playsinline></video>
    <div class="shade" aria-hidden="true"></div>
    <div class="k-ring" aria-hidden="true"></div>
    <div class="k-band" data-k-band="0 0.28"><h1>...</h1></div>
    <div class="k-band" data-k-band="0.36 0.62"><p>...</p></div>
    <div class="k-band" data-k-band="0.72 1"><p>...</p><a class="btn" href="#book">...</a></div>
  </div>
</section>
```
`encode.mjs` prints the exact `<video>` tag. `--mobile` cuts the free portrait clip (`hero-m.mp4`) from the same video: inspect that crop across the entire film, not only the poster. Keep `data-src-mobile` when it tells the story well. For a dedicated portrait source, encode separately with `--name hero-m` and use that clip/poster in the mobile attributes. Full throttle includes deliberate portrait production when it materially improves the result, even if a crop technically fits. See `mobile.md`.

**Layered depth scene:**
```html
<section class="hero" data-k-hero data-k-span="3">
  <div class="k-stage">
    <canvas data-k-depth data-image="assets/hero.webp" data-depth="assets/hero-depth.png"
            data-image-mobile="assets/hero-m.webp" data-depth-mobile="assets/hero-m-depth.png"
            data-strength="0.035" data-push="0.06"></canvas>
    <div class="k-plane haze" data-k-layer="0.25" data-k-drift="10" aria-hidden="true"></div>
    <div class="k-band" data-k-band="0 0.45"><h1>...</h1></div>
    <div class="k-band" data-k-band="0.55 1"><p>...</p></div>
  </div>
</section>
```
`depth.mjs` prints the exact `<canvas>` tag. The depth scene also runs on phones (from the portrait crop), and reduced motion gets the still.

## Sizing the journey

- `data-k-span` is the hero's length in screen heights. The scroll distance is `span - 1` screens. Use 3 for a depth scene with two captions, 4 for a single shot with three, 5 for a story journey (the default) with three or four, and 6 for an epic journey.
- **Every caption needs about 80 to 130% of a screen of scroll at full strength.** A band's length in screens is `(b - a) * (span - 1)`. On span 5, a band of 0.25 is a full screen. Leave gaps of about 0.08 between bands so one leaves before the next arrives.
- The first band starts visible and the last stays visible to the end. Put the headline first and the call to action last.
- Fewer, longer beats beat many short ones. If a band fails the check, merge it with a neighbour instead of shrinking it.

## Keeping words readable over moving pictures

Live footage is a background you do not control frame to frame. Every hero caption gets these layers, tuned against its worst frame:

1. **A base shade** over the whole stage, always on, so no frame is ever raw behind text:
   `.shade{position:absolute;inset:0;z-index:1;pointer-events:none;background:radial-gradient(ellipse 120% 90% at 50% 45%,transparent 35%,rgb(10 9 8/.55) 100%)}`
2. **A local shade per caption** that rides the band's own fade, so the picture dims only while that caption is on. Dim, never flatten: let it die out before the edges.
   `.k-band::before{content:"";position:absolute;inset:-30% -12%;z-index:-1;background:radial-gradient(closest-side,rgb(10 9 8/.6),transparent)}`
   Peak alphas of 0.5 to 0.72 are the usual range. For a centred subject with text on both sides, use two local shades, one per column, and leave the subject bright.
3. **A layered text shadow** on hero text (a tight edge, a middle glow, a wide falloff), switched off on buttons:
   `--k-tshadow:0 1px 2px rgb(8 7 6/.9),0 3px 12px rgb(8 7 6/.7),0 10px 40px rgb(8 7 6/.6)`
4. **Small labels get a chip**: a small blurred backing (`.k-scrim` in scene.css is a starting point).

Dark text on a light scene works too; the same layers, inverted. The check script measures every caption against its worst frame and fails anything under 3.5:1.

## Words that move with the picture

Implement the design package's film-cue/type map in the project's own CSS/JavaScript, or with the shipped `filmtype.js` below. Principal hero type must have an observable travel, scale or orientation relationship to the selected film's camera/subject motion, with readable plateaus. A generic entrance, fade or stagger by itself is insufficient. Choose the direction from the actual film; there is no universal descent, tilt or scatter treatment.

Compute every transform from the frame the visitor actually sees, never from elapsed time, one-way class triggers or scroll alone: the engine gates seeks, so scroll runs ahead of the picture and type driven by `--k-p` slides against the film during fast scrolling. `filmtype.js` already follows the presented frame. Hand-written choreography should read it the same way (`requestVideoFrameCallback` media time, plus `seeked`), with `--k-p` only for effects that do not need to sit on the picture. The same frame must give the same type state after reverse scroll, jumps or revisiting the hero. Keep the supplied engine unchanged; put extra transforms on project-owned inner elements.

Author phone transforms, line breaks and reading positions against the portrait film. Use `transform` and `opacity` only. Keep the primary action and controls clear of moving words, and hide or move a control that a word would cross. In static, reduced-motion and media-failure states, the custom driver and transforms switch off and complete readable type sits over the poster. Keep each heading as one accessible name: the visual copy is `aria-hidden="true"` and the real heading stays in the page (`data-ft-replaces` keeps it readable for screen readers and brings it back in the still hero). Use seeded randomness for any intentional scatter.

Example, letters gathering from a scatter (set `--t`, `--x`, `--y` per letter at split time):
```css
.ch{--c:clamp(0,(var(--k,1) - var(--t,0))*2.6,1);display:inline-block;opacity:var(--c);
  transform:translate(calc((1 - var(--c))*var(--x,0px)),calc((1 - var(--c))*var(--y,0px)))}
```
Never animate `filter` itself. For blur-to-sharp, stack a statically blurred copy under the sharp one and crossfade their opacity.

## Words fixed to the film

The strongest film/type relationship is words that sit IN the scene: carved into a wall, standing in a street, lying on a table, riding a product face. They grow, slide and turn exactly as that surface does. Guessing the motion by eye never holds; measure it. Two shipped pieces do this for any hero film:

- `.10k/tools/track.mjs` measures how a chosen surface moves in every frame and writes `site/filmtrack.js`.
- `engine/filmtype.js` + `engine/filmtype.css` (copy into `site/` unchanged, like `scene.js`) place the words on those surfaces on the frame the visitor is seeing.

**1. Choose surfaces from the actual film.** Step through it (`review.mjs`) and list the flat, visibly textured things the camera sees for long enough to read words on: walls, signs, shop fronts, floors, table tops, the ground, the face of a box, bottle or device. For each one, note the frame where it is largest and clearest (the reference frame) and its rectangle on that frame in film pixels. Note anything inside it that moves on its own (people, flames, water, screens, reflections, leaves, a window showing outdoors) so it can be masked. Choose the motion model the surface needs:

| Camera / subject movement | Model |
|---|---|
| Straight push in or pull out, face-on surface | `scale` |
| Push with a slight turn or roll; sideways move | `similarity` |
| Surface seen at an angle that stays about the same | `affine` |
| Orbit, crane, tilt, or a surface at a changing angle (floors, the ground, a turning product face) | `perspective` |
| Pan across a distant backdrop | `translate` |

Use the simplest model that holds; a more flexible model also follows noise.

**2. Measure.** Track the clip the page plays (`site/assets/hero.mp4`, not the raw master), so the frame numbers match the visitor's:
```sh
node .10k/tools/track.mjs surface site/assets/hero.mp4 --name wall --ref 240 --region 712,0,428,425 --mask 645,110,60,330 --model scale
node .10k/tools/track.mjs proof site/assets/hero.mp4 --name wall     # review/track-wall.jpg
node .10k/tools/track.mjs crop site/assets/hero.mp4 site/assets/hero-m.mp4
```
It tracks outward from the reference frame in both directions, drops details that move on their own, smooths the result without smoothing away real moves, holds still across repeated frames, and keeps only the stretch where the picture still matches. It reports the frames kept and a picture check. **Open the proof sheet every time**: the grid must stay glued to the same features in every tile. If it slides, add masks, choose a clearer region or reference frame, try a different model, or limit the range with `--from`/`--to`. Re-run it whenever the film, its encode or the phone clip changes.

The phone clip from `encode.mjs --mobile` is a crop of the wide film: `crop` finds it, and the wide tracks then drive the phone layout too. A dedicated portrait film needs its own tracks: `track.mjs surface site/assets/hero-m.mp4 ... --variant phone`.

**3. Place the words.** Write positions and sizes in film pixels on the surface's reference frame (where the region was drawn). Each `data-ft-at` is a baseline point, with optional alignment:
```html
<div class="k-stage">
  <video data-k-scrub ...></video>
  <div class="ft-layer" data-ft-layer aria-hidden="true">
    <div data-ft="wall" data-ft-for="wide" data-ft-fade="178 198 - -">
      <span class="wall-type" data-ft-at="955,244,center" style="font-size:110px">The evening</span>
      <span class="wall-type gold" data-ft-at="955,345,center" style="font-size:110px"><em>is yours.</em></span>
    </div>
    <div data-ft="wall" data-ft-for="phone" ...>...</div>
  </div>
  <div class="k-band" data-k-band="0.7 1"><p class="settle-heading" data-ft-replaces>The evening is yours.</p>...</div>
</div>
<script src="scene.js" defer></script><script src="filmtrack.js" defer></script><script src="filmtype.js" defer></script>
```
- `data-ft-fade="a b c d"`: fade in over frames a to b and out over c to d (`-` for none). A track that ends before the film fades out by itself over its last 6 frames.
- `data-ft-depth="1.2"`: a plane nearer than the surface (above 1) or farther (below 1). Use it for words standing in front of a building as the camera pushes towards it, or for parallax on a sideways move. It needs a `scale`, `similarity` or `translate` track.
- `data-ft-window="front:862,250,196,470:open"`: the words are on a far surface seen through an opening (a door, window or arch) on a nearer surface. They show only inside that opening and appear after the opening's own track ends (`open`) or never (`hide`). Without it, far words float in front of the door frame.
- `data-ft-for="wide|phone"`: separate wide and phone groups, with their own sizes, line breaks and positions. A phone group sits on the same surface in the crop, so re-place it inside the phone's visible strip.
- Words leaving the screen fade out before they reach the edge (`data-ft-edge="off"` keeps them).
- Words that grow more than about 15% are painted once at their largest size and then only scaled. Live text re-renders at every size and shimmers or pulses as it grows. `data-ft-paint="on|off"` overrides this.

Fonts, colours and text shadows come from the site's own CSS on the spans, and painting copies them. Ship real font files for every style used, including a separate italic file (an upright file alone gives a fake, browser-slanted italic). Mark the captions the film type stands in for with `data-ft-replaces`.

**When there is nothing flat to hold on to** (clouds, liquid, smoke, abstract morphs, a close shape with no texture), fix the words to the most stable thing nearby, such as the background or the ground, so they still share the camera's motion. Or choreograph them by hand against the film's cues, driven by the presented frame as above. Across a hard cut, a track ends: plan a fade over the cut or a separate surface in the next shot.

**4. Verify.**
```sh
node .10k/tools/typesync.mjs site review
```
On desktop and phone, it scrolls forward, backward and in jumps, and compares the frame the words are on with the frame painted on screen. It checks that the same frame always gives the same word position, and that reduced motion returns the normal captions. It also writes `review/typesync-desk.jpg` and `review/typesync-phone.jpg`. Look at both sheets: words in place, readable over their worst frame, clear of the main action and controls. Then scroll the real page slowly and quickly yourself; a still image cannot show jitter or pulsing. `check.mjs` still measures contrast and timing for the normal captions.

## Planes and scroll-linked touches

- `data-k-layer="0.3"` moves an element up by 0.3 screens across the hero; negative values move it down. `data-k-drift="12"` makes it follow the desktop pointer by up to 12 px. Use planes for haze, light shafts, dust, a foreground frame, or a headline that should feel like it sits in the scene.
- **A plane that travels must be taller than the stage by its travel, or fade out at both ends.** Otherwise its edge slides into view as a hard line.
- Anything else can read `--k-p` in CSS: `.hero .shade{opacity:calc(.4 + var(--k-p)*.4)}` deepens the shade as the story ends; a warm overlay can fade in as the story ends. This is how each site gets its own touches without touching the engine.

## Tuning the depth scene

- `data-strength` is how far near things move: 0.02 is subtle, 0.035 is the default, 0.06 is bold. `data-push` is the slow zoom: 0.04 to 0.1.
- Depth reads best with a clear near element, a middle subject and a far backdrop (plan the start frame that way; see `design.md`). Flat, face-on scenes show little depth.
- Thin near details (hair, railings, plant leaves against the sky) can smear at the edges. If the contact sheet shows smearing, lower `data-strength`, or re-run `depth.mjs` with `--blur 4`.
- A real photo works as well as a generated one. Polish it first, then make its depth map.

## The static hero

Phones without a phone clip, reduced motion, and failed loads show the poster with every caption stacked over it. It is a designed layout, not an apology: check it at 390 px wide, give the stacked captions room, and make sure the call to action is visible without scrolling far.

## Tools

Run from the project folder:
```sh
node .10k/tools/encode.mjs review/hero-raw.mp4 site/assets --mobile --focus 0.5   # scrub-ready clip, poster, phone crop
node .10k/tools/depth.mjs review/hero-still.png site/assets --mobile --focus 0.5  # web image + depth map + phone crop
node .10k/tools/check.mjs site review                                        # desktop and phone journey checks
node .10k/tools/preview.mjs site --port 8080                                # safe local site preview
node .10k/tools/review.mjs review/hero-joined.mp4 --port 8081                 # film playback, seeking, frame steps
node .10k/tools/track.mjs surface site/assets/hero.mp4 --name wall --ref N --region x,y,w,h   # measure a surface
node .10k/tools/typesync.mjs site review                                     # words stay on the frame shown
```
- `encode.mjs` uses the actual final decoded frame as its poster by default. `--poster last|SECONDS` selects intentionally; `--poster-only` repairs posters without changing movies. A supported WebP fallback handles FFmpeg builds without libwebp.
- `--focus` is where the phone crop centres, from 0 (left) to 1 (right). Set it from the full film’s subject/action positions, then inspect the whole portrait contact sheet.
- The first `depth.mjs` run downloads a small depth model (about 27 MB) once.
- `check.mjs` uses the Chrome or Edge already on the computer. It walks the hero, measures dead scroll, caption timing and contrast, checks phones and reduced motion, and writes `review/contact-sheet.png`, `review/phone-top.png` and `review/phone.png`. It also traverses the phone film at multiple viewports and writes portrait contact sheets. Inspect those for subject framing throughout the story; automatic seeking checks do not certify composition. Use lower-page crops if the full-page image is too tall to read.

## The self-test (before the user sees anything)

1. Run `check.mjs` until it reports nothing to fix, then inspect its desktop and phone journey images plus readable lower-page captures.
2. Exercise every button and link, and submit the form.
3. In an isolated preview, block the hero asset request and reload: the page must remain complete over the poster. Restore normal loading afterward; do not rename live assets.
4. Check letter tails (g, y, p) in any clipped text, and that nothing pushes the page sideways.
5. Review every authored type/film cue in desktop and phone playback. Test forward/reverse movement, arbitrary seeks, resize and return to the hero; verify the same positions reproduce the same type states without drift. Run `typesync.mjs` when the site uses `filmtype.js`, and inspect every `track.mjs proof` sheet. Check readable holds and the static/reduced-motion/media-failure compositions. Automatic checks and still captures do not establish motion synchronization by themselves: also watch the real page.
6. The fresh-eyes pass, last: look as a first-time visitor. Does every element earn its place? Are parallel items equal? Does any stretch read as filler? Fix what you find, then report what you fixed.

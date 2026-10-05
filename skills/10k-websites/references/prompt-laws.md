# The Hero-Video Laws and Prompt Construction

Design every shot by these laws BEFORE generating. They help turn an ambitious concept into controllable imagery. They are practical starting points, not guarantees of first-try success; model selection and exploration follow the chosen production level.

## The twelve laws

1. **The motion agrees with the scroll.** Scrolling down must read as going down, opening up, or arriving: a pour, a descent, a teardown, an approach. Ask of every concept: "when the visitor scrolls down, does this motion feel like down?" A subject that flies UP while the visitor scrolls down fights the page and always loses.

2. **One coherent story.** Choose a continuous take or a chain to suit the required motion and available model controls, not a fixed clip count. Shared keyframes constrain appearance, not endpoint speed. A matched hard cut can be the cleanest join; inspect actual frames and velocity. A complex plain-view transformation needs evidence that the model can hold identity and anatomy; a motivated occlusion can provide control within one take or between segments. Carry compatible heading and speed through a chained transition. Use the route and take method in `shots.md` and the evidence protocol in [visual-validation.md](visual-validation.md).

3. **Lock the path, free the body.** The trajectory stays rigid, but the subject on it must stay alive: natural movement, ripple, small adjustments. The scene needs life too: drifting steam, streaking cloud, shifting light. Never stabilize a shot by freezing the subject. A frozen subject on a clean path reads as dead footage.

4. **Plan the ending first.** The final frame is where the page comes to rest, so write it into the prompt explicitly as a composed, satisfying arrival: the cup settled on the counter, the product assembled, the destination reached. An awkward ending makes an awkward website. If the ending is a product showcase, compose it with generous margin above and below the whole product: the site's header sits over the top of the frame, and cover-cropping eats the edges on wider or shorter screens. A product with its top cut off reads as an accident; squeezed against the nav it reads as busy. The alternative that dodges the problem entirely: a full-bleed texture ending with nothing croppable is text-safe on every screen. Verify by viewing the ending frame with the header mocked over it, at a wide window and a short one, before approving.

5. **Plan for difficult detail.** Fluids, atmosphere and materials often render well. Familiar anatomy, hands, faces and intricate products need capable models, identity support and closer inspection. Use references or controlled compositions when needed. Do not hide the brand's defining subject merely to follow the easiest recipe.

6. **Prefer a vertical motion axis.** A straight up-and-down journey matches the scroll axis one to one, so the reveal moves with the page in both directions. Not mandatory, but when two concepts are equal, take the vertical one.

7. **Compose picture and typography together.** Plan the action lane, text scale and position, movement relationship and readable resting states during concept design. Words can flank, follow or frame the action when legibility permits. Prove the treatment in wide and phone layouts before completing the site.

8. **Sell the boundary crossings.** When the camera passes through a surface (into water, through mist, past glass), write the physical lens moment into the prompt: a splash, droplets on the lens, a beat of blur. A clean pass through a boundary reads as fake; the mess is the realism.

9. **If the hero features a product, brand it or frame it close.** A generic unbranded object at distance reads as a placeholder. Either apply the brand mark via image editing before animating, or write the ending to land close enough that the object's design carries it.

10. **Text over footage earns its legibility.** Live video behind type is a moving background you do not control frame to frame. So every text band gets a legibility system: a local scrim (a soft dark gradient behind the words) that deepens only while that band is active, a real text shadow, and a contrast check against the WORST frame of that band, never the average. Place each band in the calmest region of its frames. If a line cannot be read at a glance over the busiest moment of its band, it fails. The working layers are in `engine.md`, and `check.mjs` measures every caption against its worst frame.

11. **Pace text in scroll distance, not seconds.** A scroll site is read in flicks, not played at 24 frames per second. Give every caption beat a long fully-visible plateau (most of its band, enough to survive several normal scroll flicks) with short eased ramps at the edges, so a reader never sees text pop in and vanish between two flicks and never has to stop dead to catch a line. Test the beat map by flick-scrolling like a real visitor, not by slow dragging. The sizing rule is in `engine.md`, and `check.mjs` runs the flick test.

12. **Preserve identity and review honestly.** Exclude unrequested text and marks while preserving approved product lettering and logos. Decline generic presets when they undermine the designed shot. Show the early working visual treatment using approved key imagery, clearly labeling temporary footage. Validate the complete film before treating it as final, following the current approval/delegation policy in `SKILL.md`; scaffolding and independent sections can progress during renders. Use [visual-validation.md](visual-validation.md) for scene identity, detail, reference roles and review invalidation after changes.

## Prompt construction

### Start frame template (image, 16:9, high resolution; preflight the price with `openart_model_cost`)

For video heroes, the keyframe method in `shots.md` comes first: design the REST frame, then make each earlier keyframe from it as a new shot. The template below still describes a good opening frame.

Compose the image as frame one of the motion: the subject positioned so the journey can begin.

```
[SUBJECT] at [POSITION IN FRAME], composed as the first moment of a motion
that will [ONE-SENTENCE JOURNEY]. [LIGHTING: source, direction, mood].
[PALETTE: the three to five brand colors described as materials and light,
not hex codes]. [ATMOSPHERE: the ambient life the scene carries]. Intentional
negative space at [WHERE THE CAPTIONS WILL LIVE]. Cinematic, photorealistic,
16:9. No unrequested text or logos. Preserve approved product marks.
```

**The negative-space phrasing trap: never name empty space as darkness or emptiness.** When you reserve room for captions, describe the scene as one continuous world filling the frame edge to edge, with the calm region as part of that world: soft shadow, receding depth, a plain surface. Ask for "generous empty darkness left and right" and the model paints literal black side panels, which costs a re-roll. Inspect the result; edge-to-edge phrasing reduces this failure but does not guarantee success.

The same trap has a symmetry case. When the composition needs a centered subject, "centered" alone is not enough. Say the subject bisects the frame, dead center, the same distance from the left edge as from the right. Describe both halves as one identical treatment, and explicitly ban objects, machine parts, and bright highlights on either side. A real build took three attempts before this phrasing landed the shot.

If the user supplied a real photo that fits the concept, it becomes the start frame. Polish it first (the fidelity and retouching recipe in `openart.md`), extending it to 16:9 with the caption space built into the extension. Inspect the polished frame for fidelity to the original, resolution, and composition before animating. In the video prompt, describe the real product exactly as it appears and tell the model to keep its shape, label, and colors unchanged throughout the motion.

When the subject is a real person (the owner, the chef, the maker), their photo rides in as a reference image instead of a start frame: generate the start frame with a model that takes character references, restate their recognizable details in the prompt (hair, glasses, clothing), and inspect the result for likeness the same way you inspect for trademarks. Likeness is a brand-coherence detail; a near-miss face fails the whole site. And one hard rule before any face is generated: only use a photo of the user themselves or of a person who has agreed to appear on the site. If the photo is of anyone else, stop and ask before generating.

### Still for a layered depth scene (resolution selected for the production plan)

The picture IS the hero, so it must hold depth by itself. Build the prompt on three distances:

```
[FOREGROUND ELEMENT close to the camera, partly framing the view], [MAIN SUBJECT]
in the middle distance, and [BACKDROP] far behind. Eye-level camera, the view
reaching deep into the scene. [LIGHTING]. [PALETTE as materials and light].
A calm, softly lit area at [WHERE THE CAPTIONS WILL LIVE], part of the same scene.
Sharp from front to back, no motion blur. Photorealistic, 16:9. No unrequested text or logos.
Preserve approved product marks.
```

Avoid thin near details against a bright background (hair, railings, wire, leaves against the sky): they smear when the scene moves. Wide flat walls facing the camera show little depth. The frame is also the poster; inspect its wide and phone compositions. Use a dedicated portrait still when the approved production plan calls for it.

### Video template (one controlled take, sound off; model, duration and quality from the approved production plan)

```
One continuous shot, no cuts. [SUBJECT] [VERB OF THE JOURNEY: pours, descends,
approaches, assembles] from [START STATE] to [END STATE] along [THE EXPLICIT
TRAJECTORY: starting distance/height, travel direction, passage and ending bearing].
The [SUBJECT] stays alive throughout: [SMALL NATURAL MOTION: ripple, sway,
micro-adjustments]. The scene stays alive: [AMBIENT LIFE: drifting steam,
shifting light, streaking cloud]. [IF A BOUNDARY IS CROSSED: the physical
lens moment, e.g. a splash and droplets on the lens with a beat of blur].
[PACE CURVE and observable beat timing]. [ENDING: continue through the boundary
with the specified direction and speed for a following clip, OR decelerate only
into the final arrival]. [END COMPOSITION: what sits where and what the light does].
No unrequested text or lettering.
Preserve approved product marks.
```

Separate generation quality from delivery size. Select high-quality masters when the chosen level and shot justify them, including higher resolutions that improve detail or reframing. Full throttle is quality-first; do not apply a blanket 720p/1080p ceiling. Encode efficient web files afterward and check that compression preserves the intended image. Switch sound off unless sound is an explicit part of the approved experience.

## Choosing and assembling takes

Set duration and beat timing from the approved story. Compare a continuous take with a chain using actual model capabilities and motion evidence. Prefer a continuous take when an uninterrupted camera route matters and intermediate endpoint constraints repeatedly cause settling; treat its middle composition as a guide unless the model can constrain it. Choose a chain when separately controlled states or motivated transitions justify the joins. Do not assume more clips create more drama or one take is a quality downgrade. Run the representative pilot required by [visual-validation.md](visual-validation.md) before dependent production.

When chaining is justified:

1. Plan shared keyframes (`shots.md`): adjacent clips target the same join picture. After the representative motion and identity checks pass, sources are approved under the current delegation policy and costs are covered, independent clips can render concurrently. Generated endpoints can still differ and must be checked.
2. Describe compatible heading, lighting and velocity on both sides of the join; any pace change must be smooth and intentional. When a clip starts from a near-empty or near-black frame, describe what emerges from it. Prompted continuity is not evidence of rendered continuity.
3. Inspect each clip before acceptance. Diagnose a rejection before spending the repair allowance: a local defect may need one replacement, while a repeated internal stop may require different take structure. Do not automatically regenerate the whole film or repeat the same failing request.
4. When a clip must continue from an extracted frame instead (a rescue, or a model without an end frame), extract the final frame of the approved clip as a full-quality PNG with ffmpeg (exact command in `ffmpeg-recipes.md`; review-grade jpgs are not good enough to chain from), upload it (`openart.md`), and pass it as the next `startFrame`.
5. Normalize the RAW segments into one high-quality intermediate, then encode the joined film once for the web (`ffmpeg-recipes.md`). Start with matched cuts, remove a duplicated shared endpoint only when confirmed frame by frame, and use a short blend only if it improves the actual join. Matching encoding parameters prevents technical inconsistencies; it does not fix visual discontinuity.
6. Review the joined file in normal playback, half speed and bidirectional frame steps, then review its phone version. Use the review player described in `shots.md`. Record duration and approved beats. Preserve them when correcting an isolated seam; substantial pacing or scene changes need a creative decision.

Only the final segment needs the composed resting ending (law 4). Middle segments should end mid-motion so the next one can continue it.

If a supposed moving endpoint settles, distinguish camera travel from residual texture or leaf motion. Review the final approach, not only the last picture. Do not shorten or retime the film to conceal a failed route; preserve approved content and pacing unless a broader creative change is authorized.

**The seam law: texture identity does not carry over.** Each generation re-imagines fine texture from its start frame. Position carries over; the exact weave, grain, or skin does not. So a rest-to-rest join on hyper-specific texture shows as a visible cut even when the motion vector is perfect. Storyboard every seam to land inside motion, or inside a moment that motivates a texture refresh: a sweep across the lens, a blur beat, a moment of darkness, a shift of light. Never butt two rest states together on specific texture. If a seam shows, inspect both endpoints and nearby frames before choosing a repair: a matched cut, a confirmed duplicate-frame removal, a short blend, or a targeted clip regeneration. Blends can create ghosting and are not an automatic rescue.

**Which worlds may simplify chaining:** light, particles and atmosphere can reduce recognizable anatomy and texture constraints. They still require motion and join review; do not replace the subject's defining world merely to make production easier.

## Declining presets

The generator sometimes pattern-matches your prompt and offers a house preset instead of generating your shot. Decline it and retry with your literal prompt. Your designed shot obeys the laws and composes for your layout; a preset does neither.

## Cost preflighting

Use the single production-level and approval policy in `SKILL.md` and `openart.md`. Preflight every exact call with `openart_model_cost` and account for it against the approved estimate and iteration allowance. The user approves the production plan and meaningful changes; do not interrupt for routine calls already covered by that approval.

Recommend the model and settings on current evidence for the intended shot, explaining the creative result and expected cost in plain language. Full throttle selects the strongest current GPT throughout the workflow and the strongest current suitable image and video models, with high-quality settings and deliberate exploration. Do not reinstate a cheaper default or a per-clip ceiling here. Material scope or spending increases require a revised concrete proposal; an allowance is not unlimited spending. If the balance cannot cover the approved path, follow the existing sign-up/credit guidance in `SKILL.md`.

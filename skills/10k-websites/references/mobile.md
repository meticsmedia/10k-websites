# The Phone Experience

Design the wide and portrait experiences together before committing to final assets. The selected `production_level` controls the resources available, while every level gets a complete, readable phone story. A free crop is useful when it preserves the full journey; it is not automatically the best composition.

## Choose the portrait treatment early

Compare the opening, every event and join, and the final reveal in portrait. Include one phone view in the early working visual treatment, with its actual typography, navigation and motion relationship.

- **Crop:** use `encode.mjs --mobile --focus <0..1>` when all beats retain their subject, action and text space. Inspect the entire encoded portrait film, not just its poster.
- **Dedicated portrait:** recompose and generate the story for a tall screen when it materially improves scale, motion, subject clarity or type. In Full throttle, plan this inside the approved production allowance whenever it improves the experience, even if a crop technically fits. Follow the current image/video model and quality policy; do not impose a separate cheaper phone model or 720p generation ceiling.
- **Designed still:** use the static hero in `engine.md` for reduced motion, unavailable video, or a deliberate production choice. It must read as a finished composition, with useful copy and action.

The user approves the production plan once. Do not reopen routine portrait costs already covered; present a concrete revision if dedicated generation would exceed the approved scope or allowance.

Budget dedicated portrait generation as actual additional production, including its required beats and planned iteration; a wide-film quote does not fund it implicitly. Record the selected wide and portrait asset versions and their approval status. Recheck the portrait plan, continuity and type cues whenever the wide film changes. An older phone film may remain explicitly provisional while its replacement is pending; a new delivery encode does not make its creative content final.

## Generate the whole portrait story

1. Recompose the approved story's keyframes in 9:16. Keep the same recognizable subject, palette, materials and lighting while allowing a different camera framing. Reserve space for the fixed navigation, key words and final action.
2. Inspect identity and the distinct composition of each beat, using references where needed. Avoid bars, pasted-on panels and empty filler around a wide image.
3. Generate all required portrait beats, including the event and arrival, with the selected suitable model and approved quality settings. Do not replace a rich desktop journey with an unrelated five-second phone loop.
4. Review every clip and join, then encode the complete approved film with `encode.mjs --name hero-m`. Use its output as `data-src-mobile` and its final-frame poster as `data-poster-mobile`. Optimize delivery size and loading against the actual experience rather than shortening the approved story to meet a file-size target.

## The phone basics

- **Persistent navigation.** Fixed brand and menu stay outside the hero and respect the notch and home bar.
- **A real menu.** A readable overlay has a close control, closes on link selection and Escape, and manages keyboard focus. Anchors clear the fixed header.
- **Reflow, not shrink.** Recompose headline line breaks, scale, type travel and section order as needed. Prevent sideways overflow. Check a narrow phone (320 px), common widths around 375 to 390 px, and a short viewport around 667 px high.
- **Easy action.** Tap targets are at least 44 px. Keep primary controls stable and readable. Provide a clear way past a long story, such as a skip link.
- **Visible feedback.** When controls change a diagram, preview or result, keep useful feedback visible near the controls while the visitor chooses. Reflow or add a compact local preview when the full result sits offscreen. Use the same state as the main result, one appropriate accessible announcement, and unique identifiers; hide purely duplicated graphics from assistive technology. Do not rely on automatic scrolling or an obstructive fixed overlay to reveal the response.
- **Natural pacing.** Thumb flicks are faster than mouse wheels. Give words readable plateaus and the reveal time to land; keep the action visible. Preserve the approved film's beats and duration when adapting scroll timing.

## Serve one appropriate asset

The unchanged engine selects one source before loading and adapts when the phone rotates. Use `data-src-mobile` and `data-poster-mobile`; do not download both videos up front. If video fails, the poster, captions and navigation must still form a usable page. Reduced motion shows the composed final state and avoids unnecessary video loading and animation.

## Verify the entire experience

Automate forward and reverse scrolling through the complete phone film, inspect every join, verify the actual selected asset version, and check navigation, focus, gallery controls, form states and horizontal overflow at multiple widths. Exercise interactive choices while their feedback is visible, including selected, deselected and limit/error states where relevant. Inspect settled lower-section crops for readable detail and useful focus, not just the hero. Test failure and reduced-motion states. Then check desktop again because phone changes can leak into it.

Ask the user for a simple real-phone reaction: open the preview or live URL and scroll in both directions. Confirm that the opening reads at a glance, the subject remains clear, the final action settles, and the rest of the page is easy to reach. Record whether this was tested on a physical phone or only emulated; never imply the former from a desktop screenshot.

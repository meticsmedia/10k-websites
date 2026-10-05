# Changelog

## 5.0 (production levels and film-linked type)

- **Three production levels:** Full throttle (the strongest GPT, image and video models for every step), Studio (the strongest GPT for direction and review, the everyday model for routine building) and Focused budget (the best result for an amount you set). The level decides both the models and the spending, and it's never downgraded silently.
- **Exact quotes instead of fixed budgets.** After you pick a concept, the skill prices the whole production (images, film, phone version, supporting pictures and a redo allowance) against your real balance and waits for your OK.
- **The headline moves with the film.** Hero type is choreographed to what actually happens in the footage, and it rewinds cleanly when you scroll back. New `filmtype.js`, plus `track.mjs` and `typesync.mjs`, can fix words onto a surface in the scene (a wall, a table, the ground) and prove they stay in place on desktop and phone.
- **An early visual preview** of the headline over the key images, one lower section and the phone view, before any video is made.
- **A film review page** (`review.mjs`) with slow motion and frame stepping, and a safe local preview server (`preview.mjs`).
- **Visual validation:** product identity, continuity between shots and the hardest details are checked before anything is animated, with a test clip first for difficult camera moves.
- **The phone version is planned from the start,** as a crop when it works or a dedicated portrait film when it's better.
- **No fixed fresh-chat points.** The build continues in the same chat and saves its plan at every phase, so a new chat can always pick up.
- The setup only asks for a restart when a connector really needs one.
- Tool tests (`npm test` in `tools/`).

## 4.2 (lessons from the Test Pass 4 build)

- A new shot, **The Pick-up**: the product at rest, a hand lifts it, and the film lands on the person out in their world with it. The skill suggests it first for products people wear or hold.
- Opening and middle keyframes are now made from a written description of the product, so they are truly different shots. Your real photo is used for one keyframe only.
- The skill checks the keyframes side by side itself and redoes near copies before you see them.
- No picture is used twice on the site, including frames from the opening film. `check.mjs` flags repeats and look-alikes.
- After two rejected films in a row, the skill stops spending and offers a simpler story.
- The skill no longer quotes its own rules in chat.

## 4.1 (big and bold by default)

- Story mode is the new default opening: a 10 to 15 second film in three beats (an opening that grabs the eye, a big event, and the reveal), built from clips joined through shared keyframes.
- Every key frame is designed as its own shot, with a new camera position, scale and state, so the film travels instead of drifting.
- A new shot, The Transformation: one thing becomes another behind a burst of spray, light or particles.
- Concepts are pitched as short films, checked against a new story gate, and the skill recommends the boldest one your budget covers.
- A redo reserve inside the agreed budget, so a render that misses can be redone without a new money talk. A story-mode site costs about 1,000 OpenArt credits with redos included.
- Bolder page rules and a stricter motion score.
- `encode.mjs` sizes long films automatically (keeps the source frame rate and steps up compression until the file loads fast), and clips are joined with a short blend that hides small jumps.

## 4.0 (first public release)

- Guided build inside ChatGPT (Codex): setup check, simple questions one at a time, customer research, concept ideas with prices, and a Visual Story to approve before anything is spent.
- Opening scenes from a library of proven camera moves (The Pour, The Descent, The Assembly, The Fly-through, The Pull-back Reveal, The Unveil, The Orbit Down, The Splash, The Light Tunnel, and The Rise), with the first and last frames designed together.
- Three kinds of opening scene: a scroll video, a depth scene made from one photo, and two clips joined into a longer journey.
- An original scroll engine and a library of 16 effects. Plain HTML, CSS and JavaScript, with no build step.
- Plan-aware model choice and fresh-chat handoffs, so a whole site fits in one Plus usage window.
- An OpenArt budget agreed up front, every price checked before spending, and a watch-before-build video check.
- A real-browser check (readability, dead scroll, phone layout), and a score against the $10,000 checklist before and after polish.
- Phone versions of the opening scene, a browser icon, a share picture, a sitemap and search basics.
- Publishing through the Hostinger connector, with a free temporary address or your own domain, and a launch report.
- Optional extras: a private inbox for form messages on your own hosting, more pages, a second language, a brand kit, and a client handover kit.

# Troubleshooting: Symptom → Cause → Fix

Every entry happened in a real build. Use these as hypotheses; verify the actual cause before changing approved work.

## Generation

| Symptom | Cause | Fix |
|---|---|---|
| Generator suggests a preset instead of generating | It pattern-matched your prompt to a house style | Decline it and retry with your literal prompt; your designed shot beats a house style |
| A real logo or brand mark appears in the generated image | AI slipped a trademark in | Remove unrequested marks before animating, preserving approved real product logos and identity |
| The transformation "looks like two separate videos" | The trajectory broke at the swap | Hide the swap inside a burst keyframe (The Transformation in `shots.md`): clip 1 ends inside the burst and clip 2 starts inside it, with one heading and one speed through it |
| The subject looks frozen or lifeless | The prompt over-stabilized it to protect the path | Lock the path, free the body: keep the trajectory rigid but demand natural motion on the subject and ambient life in the scene |
| A boundary crossing (into water, through glass) looks fake | The pass was too clean | Write the physical lens moment into the prompt: splash, droplets on the lens, a beat of blur |
| The hero product reads as a placeholder | Generic unbranded object at distance | Apply the brand mark via image editing before animating, or write the ending to land close enough that the design carries it |
| Three failed videos on one concept | Concept problem, not prompt problem | Stop spending long enough to diagnose; propose a targeted method/model/story change with its price under the selected level. No concept is guaranteed first-try |
| The shot is strong but the ending will not rest (the subject drifts back into motion near the end) | The model overshot the composed arrival and kept animating | Inspect where motion resumes. Preserve the approved pace/content; propose trimming only when it changes no approved action, otherwise get agreement to the revised edit or rerender |
| The chained journey glitches at a segment join | Segment encode parameters were not identical, or the motion vector broke between segments | Re-encode every segment with the exact same scrub command and re-concat; if the motion itself jumps, the next segment's prompt did not continue the previous heading and speed |
| The film feels like a gentle camera move, not a story | The keyframes are near copies of each other, or the middle frame is calm | Redo the earlier keyframes as new shots (the screenshot test in `shots.md`), make the EVENT frame the most dramatic picture, and use energetic pace words |
| Every keyframe looks like the same photo | A reference may have copied composition along with identity | Change composition, reference strength or reference roles. Use text-only generation when identity can survive it; do not discard a necessary product reference automatically |
| A repeated picture feels like filler | A section may have reused an asset without a new purpose | Inspect the role of the repetition. Keep a deliberate motif or useful comparison; create a new composition when the story needs one |
| A visible cut where two chained segments meet, even though the motion continues | Each generation re-imagines fine texture from its start frame, so a rest-to-rest join on specific texture (weave, grain, skin) shows as a cut | Next time, storyboard every seam into motion or a texture-refresh moment (the seam law in `prompt-laws.md`); for the existing chain inspect matched cuts and duplicate endpoints first; only use a short blend if inspection shows it improves the seam without doubled edges |
| A job comes back flagged nsfw on an innocent abstract shot | The safety filter misread abstract sensory language (glowing forms, flowing liquid around a shape) | Check the balance with `openart_account_get` first. Then re-roll the same start frame with the prompt rewritten in plain commercial product-photography words: name the product early, describe objects not sensations, keep the same shot design |

## The hero

Start a reported playback problem with the actual page URL/scheme, deployed version, browser/device and visible state. Inspect the user's relevant tab when available, or ask for the missing facts. Distinguish public HTTPS, a served local preview and a directly opened `file:` document before proposing compatibility changes. Direct file access can block the engine's video fetch through browser origin rules; open the served URL rather than weakening browser security.

Then distinguish an intended static state (such as reduced motion), loading, and media failure using the hero classes, network response, console and video readiness/error. Reproduce in the affected browser when available; a different browser's pass does not identify the user's cause. A cancelled local Blob read during a successful seek is not an HTTP download failure. Do not disable accessibility preferences or browser protections as a speculative fix.

The engine (`scene.js`, `scene.css`) handles hosts without partial downloads, piled-up seeks, frozen seeks after an error, phone gates on rotation and a render loop that rests. Confirm the project uses the shipped engine files before investigating a suspected engine regression, then isolate the demonstrated failure.

| Symptom | Cause | Fix |
|---|---|---|
| Scrubbing is choppy | The clip was not encoded for scrubbing, or it is very large | Re-run `encode.mjs` on the raw clip. If it is over about 12 MB, adjust resolution/CRF with visual inspection; do not trim approved action just to meet a byte target |
| The hero shows only the still | Intended static mode, an unfinished load or a failed media request | Inspect the exact URL and state first. Use the published HTTPS URL or the safely served local preview (`node .10k/tools/preview.mjs site --port 8080`). For `k-media-failed`, inspect the selected `data-src`, response and console; preserve intentional reduced-motion behavior. |
| The depth scene smears around near objects | Thin near details, or too much strength | Lower `data-strength`, or re-run `depth.mjs` with `--blur 4`; for next time, plan a cleaner foreground |
| The depth scene looks flat | The picture has no near, middle and far | Raise `data-strength` a little, or recompose the start frame with a foreground element |
| The depth hero's colours look washed or the canvas is black | WebGL is off in that browser, or the image failed to load | The engine falls back to the poster; confirm `data-image` and `data-depth` paths |
| A hard horizontal line slides through the hero | A `data-k-layer` plane is shorter than its travel | Make the plane taller by its travel, or fade it at both ends |
| A caption never reaches full strength, or can be skipped with a fast flick | Its band range is too short for the span | Widen the band, raise `data-k-span`, or merge it with a neighbour |
| Captions overlap | Two band ranges overlap | Leave a gap of about 0.08 between one band's end and the next band's start |
| Screenshots from an embedded preview show a blank or frozen hero | A hidden pane may pause animation frames, or its capture may omit a video layer | Inspect visible playback and media state in that surface; compare with `check.mjs` and another browser at the same served URL. Treat the comparison as diagnostic evidence, not proof that the reported surface works |
| `check.mjs` says it cannot find Chrome | No Chrome or Edge installed | Ask the user to install Google Chrome, or set `CHROME` to another Chromium browser's path |
| `npm install` in `.10k/tools` fails on a download | A package tried to fetch extra files during install | Run it again with `--ignore-scripts` (the default command already includes it) |
| `depth.mjs` stalls on first run | It is downloading the depth model (about 27 MB) | Wait a minute; later runs take seconds |
| Words fixed to the film slide against it during fast scrolling | The type follows scroll progress or its own clock, while the engine's seeks lag behind | Drive it from the presented frame: `filmtype.js` does; hand-written code should read `requestVideoFrameCallback` media time plus `seeked`. Confirm with `typesync.mjs` |
| Tracked words drift off their surface over the shot | The track followed something that moves on its own, or the model is wrong for the move | Open the `track.mjs proof` sheet. Mask anything moving on its own, pick a clearer region or reference frame, change `--model`, or cut the range with `--from`/`--to` |
| Tracked words jitter by a few pixels | Uneven measurement on a low-texture surface | Choose a region with more visible detail, raise `--smooth`, or use a simpler model; check the picture-check numbers it prints |
| Words that grow shimmer or pulse | Live text re-renders at every size, so its edges re-snap to pixels each frame | Let `filmtype.js` paint the group (automatic above about 15% growth, or `data-ft-paint="on"`) |
| Far words float in front of a door or window frame | A far surface seen through an opening is drawn over the nearer frame | Use `data-ft-window` on the opening's own surface, or fade the words in only after the camera has passed through |
| Words appear early, half outside an opening or the screen | They fade in where the surface is not yet in plain view | Start the fade later (`data-ft-fade`), once the surface is clearly visible |
| Phone words are in the wrong place | The phone clip is a different crop, or a separate film | Re-run `track.mjs crop`; if it says the clip is not a crop, track the phone clip with `--variant phone` |
| Words move in single-frame jerks | The clip contains repeated frames (frame-rate padding) | Track the encoded clip the page plays, not the master. `track.mjs` holds repeats still; `encode.mjs` no longer converts 24 fps to 30 |
| Italic headings look slanted and cheap | Only the upright font file is shipped, so the browser fakes the italic | Ship the real italic file with its own `@font-face` (`font-style: italic`) |

## The page

| Symptom | Cause | Fix |
|---|---|---|
| An entrance animation never plays, the element just appears | A later rule won the cascade over the animation's starting state | Prefix start and end states with the container class (`.card .part`, `.card.in .part`) and prove every entrance plays |
| Hovers on the 2nd and 3rd items of a staggered grid respond late even after the entrance finished | The cleanup rule that zeroes the stagger `transition-delay` has lower specificity than the nth-child delay rules it retires (`:nth-child` counts as a class), so it silently never applies | Make the cleanup selector match or beat the delay rules (repeat the nth-child in it) or put `!important` on the `0s` delay, then prove it by hovering the later siblings |
| A scroll-driven style stops responding after its entrance | `animation-fill-mode: forwards` overrides it forever | Entrance animation on the parent, dynamic style on a child |
| A background loop flashes or snaps when it starts | Positive animation delay | Negative delays (like `-1.2s`) so every loop is mid-cycle at first paint |
| Letter tails (g, y, p) are cut off | Masked or clipped text with zero breathing room | Em-based padding with matching negative margins on the mask |
| The page can be dragged or shifted sideways | `overflow-x: hidden` alone, or a decoration poking past the edge | `overflow-x: clip` on BOTH `html` and `body`, `hidden` first as fallback |
| Hovers start snapping after a script runs | JavaScript overwrote `el.style.transition` | Toggle a class that declares the full combined transition instead |
| A mobile element sits off-screen with reduced motion on | Blanket `transform: none !important` wiped its positional transform | Re-apply positional transforms per breakpoint inside the reduced-motion block |
| A marquee shows a gap at the loop point | Track shorter than the widest supported screen | Duplicate items until each track exceeds about 2560px |
| Animations run while the tab is hidden or the section is off-screen | Free-running loops | Scope animation rules to a class an IntersectionObserver toggles; on `visibilitychange` toggle one body class with `body.paused *, body.paused *::before, body.paused *::after { animation-play-state: paused !important }`; rAF loops rest when converged |
| A pause written on a container never actually pauses the animations inside it | `animation-play-state` is not an inherited property, so a value set on a parent (or `inherit` on a nested rule) never reaches nested elements or pseudo-elements | The body-class pattern above; it hits every element and pseudo-element directly |

## Deploy

| Symptom | Cause | Fix |
|---|---|---|
| Live site shows a directory listing or 404 | The zip contains the project folder, not its contents | Re-zip with `index.html` at the zip's top level |
| Images look soft on the live site but sharp locally | The host resizes and recompresses images server-side | Upload larger and cleaner (about 1920px wide, one high-quality pass) so the host's pass is the only lossy step |
| Link previews show no image or the wrong URL | og tags still carry the placeholder | Patch `og:image` and `og:url` with the live absolute URL at the `<!-- DEPLOY STEP -->` comment, re-zip, re-deploy |
| The live site still shows the old version after a re-deploy | Cache | Hard-refresh, or verify against a string you know changed |
| Raw videos or review files appear on the live site | They were inside the deploy folder when it was zipped | Keep raws and review copies OUTSIDE the deploy folder, always |
| Special characters turn to gibberish after a scripted find-and-replace (arrows and ordinal marks become mojibake) | A shell command read the UTF-8 file with the wrong default encoding and wrote the damage back | Never patch site files with plain shell read and write: use the editor tool for the og patch and any text change, or read and write with explicit UTF-8. Recovery if it already happened: read the damaged file as UTF-8, encode that text to Windows-1252 bytes, decode those bytes as UTF-8, save as UTF-8, verify the characters, redeploy |

## Setup

| Symptom | Cause | Fix |
|---|---|---|
| `openart` is "command not found" right after installing | The installer put it in `~/.local/bin`, which this shell does not search yet | Call it by its full path (`~/.local/bin/openart`) for the rest of the session. Verify with `openart --version` |
| The OpenArt sign-in opens nothing, or seems to go nowhere | The browser opened in a different browser than the user normally uses, or the sign-in tab was closed | Warn them in advance, have them check their other browsers, and run the connector sign-in again (`codex mcp login openart`). Verify with `openart_account_get` |
| OpenArt refuses a job: too many generations running at once | Plans cap simultaneous jobs | Submit the clip first, then the section images two at a time; submit the rest as earlier ones finish, in the same turn |
| The OpenArt tools are missing after adding the connector | The host may need to refresh its tool inventory, or connector setup may be incomplete | Verify setup and follow the actual host's documented refresh or restart path; preserve the current chat and plan, then verify an account read |
| A pinned end frame is ignored, or the clip jumps at the end | The two keyframes are too different to join with one move, or the prompt asks for a different ending | Keep every keyframe in one world (the same palette, light and written product description), add or move a middle keyframe so each clip covers less distance, describe one continuous camera move, and end the prompt with "ends exactly on the final frame" |
| Objects nobody asked for appear (drone propellers, a camera rig, extra hands) | The prompt named camera hardware (drone, FPV, crane) | Say "the camera" and describe the path. Never name the device |
| `openart_account_get` shows no credits, or generations fail with a balance error | New account with no plan or trial credits yet | Show the real balance, preflight the planned path, and share the OpenArt link for plans (moment 2 in the Sign-up links section of SKILL.md). Never buy credits for them |
| A video model rejects a setting (duration, aspect ratio, resolution, sound) | Those settings are model-specific | Read `openart_model_form_get(<id>, "image2video")` and drop or change the settings it does not accept |
| ChatGPT asks for approval on every command | Normal on the default approval setting | Tell the user once to read and approve setup steps. Never ask them to turn safety settings off |
| The build stops with a usage limit message | A GPT usage window may be exhausted | Save `.10k/plan.md`, inspect the actual limit/reset, and preserve the production level. Full throttle offers waiting/access recovery; a weaker model requires an explicit user choice. A new chat does not reset account limits |
| The account cannot add another website | Its actual site limit may be reached | Inspect current account limits and plan terms. Explain the relevant upgrade only when needed (Sign-up links moment 4); never assume a fixed site count from an old plan name |
| The Hostinger sign-in page does not open | Connector authentication may need recovery | Use the current authentication action/link exposed by the app or connector, then verify an account read; see `deploy.md` |
| Hosting discovery consumes excessive context | An unnecessarily broad catalogue was loaded | Search narrowly for the required operation and inspect its schema. Continue the current chat while reliable; preserve authorization if an actual context constraint requires handoff |
| `api/submit.php` downloads or shows code instead of answering on the live site | PHP is not running for that folder, or the deploy tool did not keep the file as PHP | Check the website is on a Hostinger web hosting plan (not a static-only site), redeploy, and test again. Until it works, switch the form to the email-link option so no message is lost |
| Form messages reach the inbox page but no email arrives | Notifications still use the server's own email (limited and spam-prone), or the mailbox details are wrong | Walk the owner through "Email notifications" on their inbox page with a mailbox on their domain; the test email and the "last:" status there show what happened. A rejected password means they should re-enter it |
| The owner forgot the inbox password | Only they know it | Re-run `backend.mjs` with `--new-code`, redeploy, give them the new code. Their messages are kept |
| `report.mjs` cannot install Lighthouse | No internet, or npm blocked | Try again on a normal connection. The site is fine; the report is only the measurement |
| Page transitions are absent in a browser | The transition API may be unavailable or reduced motion enabled | Feature-detect support, inspect the actual setting and verify that ordinary navigation remains usable |
| Hostinger tools missing after adding the connector | The host may need to refresh its tool inventory, or connector setup may be incomplete | Verify setup and follow the actual host's documented refresh or restart path; recover authentication only if needed, then verify an account read |
| The `codex` command is not found when adding the connector | The CLI may not be installed or on PATH | Use the current app's connector/plugin setup path and verify the connection. Do not rewrite unrelated configuration |
| The Hostinger connector fails to start on Windows | `npx` instead of `npx.cmd` | Use `npx.cmd` in the command or the config |
| The Hostinger connector fails to start at all | Node.js is missing or too old | Install the current Node.js LTS, verify with `node --version`, restart the app |
| The site looks frozen or broken in the app's built-in browser | A surface-specific restriction, hidden state or actual media failure may be involved | Inspect that browser's URL, hero state and requests first. Compare the same served URL in another available browser, fix or disclose the demonstrated limitation, and verify the public HTTPS experience before handover |
| The user says a setup step is done but the next step fails | "Done" was taken as verification | It never is; re-check the system yourself after every step before advancing |
| ffmpeg or Node.js fails to install on a Mac | Homebrew is not installed | Have the user install Homebrew first with the one command from brew.sh, pasted into Terminal (it asks for their Mac password). Then run the installs again and verify |
| A new build skips prerequisite verification | Setup may have been assumed | Read the installed skill, inspect actual prerequisites and complete missing setup. A resumed build continues from its saved state instead of repeating onboarding |
| Hosting calls hang and sign-in tabs recur | The connector may have lost authentication | Check the sign-in state and recover it once. Restart the app only if needed, then verify an account read; do not promise a restart fixes every cause |

**Repeated hangs:** after two consecutive calls without a response, stop blind retries and diagnose authentication, tool health and connectivity. Retry after a meaningful recovery step; do not duplicate a possibly accepted generation or deployment. A render reporting progress is still working. Preserve job IDs, approved work and the next action if recovery needs user input.

## Tool and workflow repairs

| Symptom | Check and response |
|---|---|
| Film disappears in an inline chat player | Decode the file, then verify full playback/seeking in `review.mjs`; a valid file does not prove the delivery surface works. |
| A join doubles an edge for a few frames | Inspect adjacent original frames, try a matched cut and only confirmed duplicate endpoint removal; preserve the complete approved flow. |
| Poster encoding fails but videos succeeded | Detect the available WebP path; use the encoder’s Sharp fallback or installed cwebp. Keep the successful video outputs rather than repeating paid generation. |
| Report cannot find Lighthouse in a folder with spaces | Use `fileURLToPath(import.meta.url)`; do not treat an encoded URL pathname as a filesystem path. |
| A PHP file appears as raw text during local preview | Stop that preview and use the supplied safe server. Generate SEO with `--seo-only`, never expose the backend through a generic static server. |
| A faint below-fold effect slows startup | Measure script/graphics initialization, defer it until nearby, or choose a lighter effect. Off-screen animation pausing does not imply cheap initialization. |
| Split text loses italics or has invalid ARIA | Preserve authored inline nodes and one accessible name; check generic elements as well as headings. |
| Usage says five-hour but resets in days | Inspect the actual window duration. The primary bucket can be weekly; never infer duration from its position or claim a stale reset has refreshed allowance. |
| SEO score is high but Google is blocked | Check the host’s actual robots.txt, robots tags and X-Robots-Tag response; temporary hosting may override uploaded rules. |
| Preview stops after a restart | Check this project’s server and port, restart it, verify HTTP, and reopen its URL; do not kill another project’s listener. |

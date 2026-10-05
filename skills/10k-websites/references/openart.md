# OpenArt: image and film production

Every generated image and video comes from OpenArt, through **the OpenArt connector** for ChatGPT (its tools start with `openart_`). Inspect the selected model's current controls for reference images, endpoints, resolution and audio. Choose a method that supports the approved scene; do not assume every model supports identical settings. You call the tools within the user's approved production allowance.

## Connect OpenArt (Phase 1)

1. **Account first.** No OpenArt account: the user signs up with the OpenArt link from the Sign-up links section of SKILL.md (moment 1). Inspect their actual credits and current plan terms, then price the intended production before recommending a purchase.
2. **Add the connector.** Run `codex mcp add openart --url https://mcp.openart.ai/mcp` (ChatGPT asks the user to approve it). It prints a sign-in link and opens the browser: the user signs in to OpenArt and clicks **Allow**. If the command is unavailable, the user adds it in the app instead: **Settings**, **MCP servers**, **Add server**, name `openart`, type Streamable HTTP, URL `https://mcp.openart.ai/mcp`, then Save and Authenticate.
3. **Reload only when needed.** Check whether the connector tools are available. If this installation requires an app restart, save the plan and give one simple restart-and-return instruction. Do not require a restart when the tools already work.
4. **Verify.** Call `openart_account_get`. It must return the plan and a credit balance. Name the real balance to the user.

If a connector tool ever returns an OpenArt upgrade link, share the creator's OpenArt link from the Sign-up links section instead.

## Production level, allowance and live model selection

Read [production.md](production.md) for the selected level's single model/spending policy. Full throttle uses the top current GPT throughout AND the strongest currently suitable image/video models at high-quality settings. Do not reintroduce a cheaper-model default here.

Discover models each build using `openart_model_list`, inspect exact controls with `openart_model_form_get(model, mode)`, and quote exact settings/references with `openart_model_cost(model, mode, params)`. Begin the Full throttle video assessment with the latest suitable Seedance flagship/successor and consider stronger evidenced alternatives. Choose the image generation/editing model independently. Preserve an explicit model choice; disclose a missing capability before proposing an alternative. Record IDs, settings, date and reasoning in the plan. Model names, prices and capabilities in older projects are historical evidence, not current rankings.

Price a concrete concept before the first generation: exploration, keyframes, clips, supporting images, mobile treatment and directed revisions. The user approves the outcome and production allowance, not a technical model menu. Quote current costs instead of universal 1,000-credit starter budgets. A larger balance does not itself authorize larger spending. Under Full throttle, a low balance triggers a top-up/explicit-alternative choice, never an automatic downgrade.

### Execution rules

- Preflight every paid call and check actual balance. One approved allowance includes its stated premium clips and revisions; no separate per-clip threshold. Briefly report meaningful changes and reconcile actual charges. Small drift inside the total allowance is covered; larger scope/total needs a revised proposal.
- Full throttle uses high-quality source generation and permits higher resolution where useful. Studio and Focused budget follow their chosen quality/cost tradeoff. Compress delivery assets separately, preserving masters. Never treat high spend as permission to waste retries.
- Design film length around the story and scroll pacing. Ten to fifteen seconds is a useful starting point, not a maximum or target. Price the actual duration supported by the selected model; do not stretch a scene merely because more credit is available.
- Keep the website silent: discover the model's actual audio setting and disable generation sound. Do not copy another model's parameter name without checking its form.
- Use subject/identity references when continuity warrants them. The same sculpture/product must remain itself across genuinely different compositions. Do not require two failures before using appropriate references.
- A retry names a defect or meaningful creative uncertainty and changes the relevant prompt/settings. Diagnose repeated failures before another batch. Preserve approved scenes and pacing for local join repairs; follow the duplicate-frame exception in `ffmpeg-recipes.md`. If the allowance is exhausted, propose the next useful iteration with its cost; do not silently simplify an approved Full throttle direction.

## Generate

**Images.** `openart_generate_image` with `model`, `mode` (`text2image`, or `image2image` for an edit or a matching frame), and `params` (the prompt plus the selected model’s verified settings). For image-to-image, pass references as `visualReferences: [{"type":"image","id":"<asset id>","url":"<cdn url>","label":"<short label>"}]`, taking `id` and `url` from the finished generation.

**Video.** `openart_generate_video` with `model`, `mode: "image2video"` and `params` including the prompt, the settings above and:
```json
"startFrame": {"type":"image","id":"<START asset id>","url":"<START url>","label":"start"},
"endFrame":   {"type":"image","id":"<END asset id>","url":"<END url>","label":"end"}
```

**Waiting.** Generations return a `historyId`. Stay in the same turn and wait for them yourself (if the connector offers `openart_creation_wait`, use it, and call it again while it says still running). Never end your turn while a generation you started is still running: the user should never have to type "continue" to see a result. Submit independent jobs together where appropriate, then wait for completion and inspect them in this same task. Result cards updating alone do not complete the work. **Wait cheaply:** every separate check resends the whole chat, so when you can run a small script that calls the OpenArt tools, poll inside ONE script (check every 20 seconds, yield progress during long waits and continue until all jobs finish or a real execution limit intervenes) instead of one step per check. Video takes a few minutes: say so in one line, and make the section images and the page scaffolding while it renders.

**Saving.** Download every finished result into `review/` with `curl -fsSL "<url>" -o review/<name>` and keep a line per generation in `.10k/plan.md` (what, model, credits, file). Only approved files are copied into `site/assets/`.

## One photoshoot, not a stock collection

A $10,000 site looks like one photographer shot everything on one day.
1. **Write a style line once** and save it in the plan file: the light, the lens feel, the palette as materials, the texture, and scene-specific exclusions (such as unrequested lettering or distracting props), preserving approved product marks.
2. **Use references deliberately.** For a recurring product, preserve identity with an approved subject reference; add a style reference where it improves consistency. The REST frame is useful when it represents the right identity and look, but need not constrain every composition.
3. **Give each image a role.** Create fresh compositions when the story moves on. A deliberate repeated motif, detail crop or before/after comparison is valid; repeated hero crops used merely to fill space are not.
4. **Check the set side by side** before showing it. Use [visual-validation.md](visual-validation.md) for difficult-detail crops, reference roles and cross-view continuity before creating dependent assets. Shared lighting/style does not establish matching physical contents. Re-grade or repair the demonstrated mismatch within the approved scope.

## The user's real photos

- **Getting them in:** the user drags the photos into the chat. Import them with `openart_upload_import` (it takes the chat's attached files as they are). For photos that are only in the folder, request an upload with `openart_upload_sign`, send the file with `curl -X PUT --upload-file <file> "<signURL>"`, then confirm it with `openart_upload_metadata_get`.
- **Polishing:** image-to-image with the photo as the only reference:
```
Professional photo retouch of this exact [PRODUCT OR PLACE]. Keep the [PRODUCT OR PLACE]
exactly as it is: same shape, same colours, same materials, same label and logo, same
details. Do not add, remove, or redesign anything on it. Improve only the photography:
[LIGHTING], colour grade toward [PALETTE AS MATERIALS AND LIGHT], sharper detail, a clean
[BACKGROUND], extend the scene naturally to a wide 16:9 frame. Photorealistic. No new
text, no new logos, no lettering anywhere.
```
- **Compare** the result with the original side by side before showing it (Phase 6 in SKILL.md). Originals stay in `photos/`.

## Balance and top-ups

- Check `openart_account_get` before every paid step.
- If the balance cannot cover the next approved step, state the exact shortfall and share the OpenArt link (moment 2 in the Sign-up links section). Preserve the chosen production level. Offer a lower-cost route only as an explicit alternative; Full throttle continues with top models after funds are available unless the user changes that choice. Continue independent work while the spending decision is pending.
- Never buy credits or change a plan for the user. Plans differ in commercial use: for a real business, suggest they check that on OpenArt's plans page before going live.

## If the connector will not work

After one honest retry, the OpenArt command-line tool can make images and single-frame videos while you sort it out: `curl -fsSL https://raw.githubusercontent.com/OpenArt-AI/cli/main/install.sh | sh` (Windows: `irm https://raw.githubusercontent.com/OpenArt-AI/cli/main/install.ps1 | iex`), `openart login`, then `openart generate image "<prompt>" --model <id> -o review/` and `openart generate video "<prompt>" --model <id> --image <start.png> --duration 5 --async`. Inspect the CLI’s current capabilities before relying on it. If it cannot preserve the approved model, quality or required endpoint controls, explain that limitation and resolve it before generating. A connector failure never silently changes Full throttle to weaker production. A supported fallback still uses the approved model/settings and undergoes the same visual review.

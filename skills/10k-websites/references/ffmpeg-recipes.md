# ffmpeg Recipes

Processing for trims, inspection frames, joins and stills. The everyday web encode is `encode.mjs`. Preserve the approved story: a localized repair does not authorize cutting scenes or changing pacing. Removing one confirmed duplicate endpoint is covered by a local join repair; record its one-frame timing difference and honor any explicitly exact runtime.

## Folder discipline

Raw renders and review copies stay in `review/`, the user's originals in `photos/`, and only finished web files in `site/assets/`. Keep raw clips until the site is live and any remaining review is complete.

## The scrub encode

Use `node .10k/tools/encode.mjs <raw.mp4> site/assets [--mobile --focus 0.5] [--poster last|SECONDS]` (see `engine.md`). The default poster is the final frame, matching the composed reveal. Use an explicit timestamp only for an intentionally approved alternative.

The tool re-encodes with frequent keyframes, no B-frames, no audio and the index at the front, makes the poster, and prints the `<video>` tag. A manual fallback:

```sh
ffmpeg -i review/hero-joined.mp4 -vf "scale='min(1920,iw)':-2" -an -c:v libx264 -preset slow -crf 23 -pix_fmt yuv420p -r 30 -g 6 -keyint_min 6 -sc_threshold 0 -bf 0 -movflags +faststart site/assets/hero.mp4
```

Generation masters may be higher quality than delivery assets. Optimize the final download without sacrificing the approved film: inspect gradients for banding, particles for breakup and product detail for smearing. Change one setting at a time and inspect while scrubbing. Measure actual loading rather than enforcing a duration or size cap by silently removing content.

## Review playback and frames

Open a reliable review player with normal playback, half speed, seeking and frame stepping:

```sh
node .10k/tools/review.mjs review/hero-joined.mp4 --port 8081
```

Watch the whole film, then every join in both directions. A contact sheet supports this review but cannot prove continuity or pacing. Repeat on the final wide and portrait encodes. Record approved filenames and durations before repairs.

For a six-second clip, these provide an inspection sample, not a complete video review:

```sh
ffmpeg -ss 0 -i review/raw.mp4 -frames:v 1 -q:v 2 review/frame-start.jpg
ffmpeg -ss 3 -i review/raw.mp4 -frames:v 1 -q:v 2 review/frame-mid.jpg
ffmpeg -sseof -0.1 -i review/raw.mp4 -update 1 -frames:v 1 -q:v 2 review/frame-near-end.jpg
```

Extract a short frame sequence around each join when inspecting duplicate endpoints or ghosting. Use the known join timestamp and the actual frame rate; do not infer duplication merely because two frames look similar.

## Tail trims are a creative change

When the user asks to end earlier, or approves a proposed ending repair, choose a composed steady frame by inspecting nearby candidates. An example approved trim:

```sh
ffmpeg -i review/raw.mp4 -t 4.3 -c:v libx264 -crf 16 -an review/hero-trimmed.mp4
```

Re-encode, regenerate the final poster and verify the new resting frame under the header on wide, short and phone viewports. A changed duration also changes the mapping of story beats to scroll progress; retune and review the bands. Do not describe a shorter clip as having no effect simply because the engine uses progress.

The motion-difference curve can help locate a rest, but it does not replace judgment. Lighting changes can score high even with a still subject:

```sh
ffmpeg -i review/raw.mp4 -vf "tblend=all_mode=difference,signalstats,metadata=print:key=lavfi.signalstats.YAVG" -f null -
```

## Full-quality chaining frames

When the next segment needs an extracted start image, use a full-quality PNG from the exact selected endpoint. Review JPGs bake compression into later generations. Extract the last decoded frame with:

```sh
ffmpeg -sseof -1 -i review/seg.mp4 -fps_mode passthrough -update 1 review/final.png
```

Verify the extracted frame matches the endpoint before uploading to OpenArt using the workflow in `openart.md`. Shared planned keyframes usually avoid this rescue step, but cannot guarantee the generated clips match them exactly.

## Join with matched cuts first

Normalize RAW clips to a common size, aspect ratio and frame rate, join into a high-quality intermediate, then make the web encode once. Matching parameters prevents technical inconsistencies; it does not make visual seams impossible.

Start with a matched hard cut when the shared keyframe and motion support it. This example normalizes two wide clips at 24 fps:

```sh
filter="fps=24,scale=1920:1080:force_original_aspect_ratio=increase:flags=lanczos,crop=1920:1080,setsar=1,setpts=PTS-STARTPTS"
ffmpeg -i review/clip1-raw.mp4 -i review/clip2-raw.mp4 -filter_complex "[0:v]$filter[a];[1:v]$filter[b];[a][b]concat=n=2:v=1:a=0[v]" -map "[v]" -c:v libx264 -crf 16 -pix_fmt yuv420p -an review/hero-joined.mp4
node .10k/tools/encode.mjs review/hero-joined.mp4 site/assets --mobile --focus 0.5
```

Use the resolution, aspect ratio and rate appropriate to the actual masters; do not force a portrait master through the wide example. For another clip, add another normalized input and increase `concat`'s input count.

If frame-by-frame review confirms a shared endpoint occurs twice, remove exactly the duplicate from the following clip: after normalization, apply `trim=start_frame=1,setpts=PTS-STARTPTS` to that input before concatenation. This is a local repair within an authorized join fix; record the one-frame change. If the user explicitly requires an exact runtime, preserve it with a suitable resting hold or obtain agreement to the change. Do not trim arbitrary chunks to disguise a bad join. Check actual duration and frame rate with `ffprobe` rather than trusting a model's nominal five-second label.

## Short blends only when they improve the join

A blend can hide a small endpoint mismatch but can also double the subject, soften detail or produce a pause. Compare it with the matched cut in full playback and bidirectional frame steps. Use the shortest clean transition. If neither works, repair the affected clip inside the approved iteration allowance.

For normalized six-second inputs, a 0.25-second blend starts at 5.75 seconds:

```sh
ffmpeg -i review/seg1-normalized.mp4 -i review/seg2-normalized.mp4 -filter_complex "[0:v][1:v]xfade=transition=fade:duration=0.25:offset=5.75[v]" -map "[v]" -c:v libx264 -crf 16 -pix_fmt yuv420p -an review/hero-joined.mp4
```

Use the measured first duration minus the blend duration as the offset. Each blend shortens the total by its overlap and may change the perceived pace. Preserve approved scenes and holds, record that difference and review the complete result before replacing the approved film. Never assume the visitor cannot see a seam or that a crossfade always fixes it.

## Web stills and posters

The encoder produces the final reveal poster by default, including the portrait crop. Inspect it with the actual header and final copy. Earlier frames are review assets, not automatic substitutes for the composed reveal.

Section images usually ship as WebP near their rendered size, often around 1,600 px wide or 2,400 px for a large full-bleed treatment:

```sh
ffmpeg -i review/section-1.png -vf scale=1600:-2 -c:v libwebp -quality 82 site/assets/section-1.webp
```

If this FFmpeg build lacks `libwebp`, use installed `cwebp` after resizing, or `cwebp -resize 1600 0 -q 82 review/section-1.png -o site/assets/section-1.webp`. Use lossless encoding for suitable sharp-edged interface imagery. Never report success without checking the output exists, opens correctly and has the expected dimensions.

## Verify after every encode

Inspect actual playback, endpoints, joins, poster, dimensions, duration and delivery size before using the result. Recheck the whole site after an asset replacement because timing, contrast and phone cropping may have changed.

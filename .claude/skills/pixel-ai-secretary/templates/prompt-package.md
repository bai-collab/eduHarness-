# Pixel AI Secretary Prompt Package

> v1 prompt-only workflow. This package does not generate images, call APIs, or
> guarantee model-side face consistency. It maximizes prompt-side identity and
> style consistency.

## Capability And Limits

- Can produce prompts, prompt packages, safety rewrites, and validation checklists.
- Can lock identity wording across all prompts.
- Can rewrite risky action wording into professional office or everyday scenes.
- Does not directly generate images in v1.
- Does not batch call image APIs or manage API keys.

## Reference Handling

- Reference image: `[provided / not provided]`
- If provided: use it only as the identity reference.
- If not provided: use the Character Bible below as the identity source.

## Character Bible

```text
young adult East Asian virtual AI secretary,
long black hair,
straight bangs,
soft pale skin,
gentle neutral expression,
professional OL atmosphere,
white office shirt,
gray inner top,
black office skirt or black suit pants,
office ID card,
elegant professional outfit
```

## Step 1: Character Lock Sheet Prompt

```text
same character as reference image,
maintain identical face,
maintain facial identity,
same hairstyle,
same bangs,
same facial proportions,
same eye shape,
same skin tone,
consistent character identity,
preserve original appearance,

young adult East Asian virtual AI secretary,
long black hair,
straight bangs,
soft pale skin,
gentle neutral expression,
professional OL atmosphere,
white office shirt,
gray inner top,
black office skirt or black suit pants,
office ID card,
elegant professional outfit,

front-facing half-body portrait,
standing or sitting calmly behind an office desk,
clean office environment,
soft sunlight through blinds,
computer screen glow,
documents,
coffee mug,
subtle futuristic AI interface,

high detail pixel art,
16-bit anime pixel style,
retro Japanese game aesthetic,
soft pixel shading,
detailed pixel eyes,
cinematic pixel lighting,
cozy office atmosphere,
clean composition,
game character reference sheet,
consistent character design,
professional and work-focused,
balanced proportions,
professional office mood,
masterpiece,
best quality
```

## Step 2: Safe Action List

- document handoff
- meeting presentation
- phone call
- typing at a desk
- handing documents
- checking a tablet
- lunch break
- desk nap
- brief office chair rest
- travel with work bag
- reading at home
- daily grooming at a bathroom sink
- office wellness stretching

## Step 3: First Action Four-View Prompt

Action: `document handoff`

```text
same character as reference image,
maintain identical face,
maintain facial identity,
same hairstyle,
same bangs,
same facial proportions,
same eye shape,
same skin tone,
consistent character identity,
preserve original appearance,

young adult East Asian virtual AI secretary,
long black hair,
straight bangs,
soft pale skin,
gentle neutral expression,
professional OL atmosphere,
white office shirt,
gray inner top,
black office skirt or black suit pants,
office ID card,
elegant professional outfit,

document handoff,
politely handing a document folder to the viewer or a colleague,
clear hand gesture,
professional office mood,

four-panel character reference sheet,
same action shown from four camera angles:
front view,
side view,
top-down view,
desk-height spatial perspective focused on room depth, desk planes, and environmental perspective,

clean office environment,
soft sunlight through blinds,
computer screen glow,
office desk,
documents,
coffee mug,
subtle futuristic AI interface,

high detail pixel art,
16-bit anime pixel style,
retro Japanese game aesthetic,
soft pixel shading,
detailed pixel eyes,
cinematic pixel lighting,
cozy office atmosphere,
clean composition,
game character reference sheet,
consistent character design,
professional and work-focused,
balanced proportions,
professional office mood,
masterpiece,
best quality
```

## Reusable One-Action Four-View Template

Replace `[SAFE_ACTION]` with exactly one normalized action.

```text
same character as reference image,
maintain identical face,
maintain facial identity,
same hairstyle,
same bangs,
same facial proportions,
same eye shape,
same skin tone,
consistent character identity,
preserve original appearance,

young adult East Asian virtual AI secretary,
long black hair,
straight bangs,
soft pale skin,
gentle neutral expression,
professional OL atmosphere,
white office shirt,
gray inner top,
black office skirt or black suit pants,
office ID card,
elegant professional outfit,

[SAFE_ACTION],
professional, everyday, fully dressed presentation,
clear action silhouette,
balanced character framing,

four-panel character reference sheet,
same action shown from four camera angles:
front view,
side view,
top-down view,
desk-height spatial perspective focused on room depth, desk planes, and environmental perspective,

clean office environment,
soft sunlight through blinds,
computer screen glow,
office desk,
documents,
coffee mug,
subtle futuristic AI interface,

high detail pixel art,
16-bit anime pixel style,
retro Japanese game aesthetic,
soft pixel shading,
detailed pixel eyes,
cinematic pixel lighting,
cozy office atmosphere,
clean composition,
game character reference sheet,
consistent character design,
professional and work-focused,
balanced proportions,
professional office mood,
masterpiece,
best quality
```

## Negative Prompt

```text
nsfw,
nude,
explicit nudity,
sexual pose,
fetish,
focus on private parts,
cleavage focus,
body emphasis,
provocative pose,
bad anatomy,
extra fingers,
deformed hands,
blurry,
low quality,
watermark,
logo,
text,
different face,
westernized face,
generic anime face,
identity drift
```

## Checklist

- [ ] Identity lock appears in every positive prompt.
- [ ] Pixel style lock appears in every positive prompt.
- [ ] Character Bible remains consistent.
- [ ] Each output prompt contains one action only.
- [ ] Four views are front, side, top-down, and desk-height spatial perspective.
- [ ] Risk-prone actions have been rewritten.
- [ ] Negative prompt is present.
- [ ] Positive prompts contain no banned safety terms.
- [ ] No image generation or API call was performed.

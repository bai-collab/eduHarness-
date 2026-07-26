# Prompt Components

Use this reference when building a Pixel AI Secretary prompt package.

## Identity Lock

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
preserve original appearance
```

If no reference image exists, replace the first line with:

```text
same character across the whole character library,
```

Keep the rest of the lock unchanged.

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

## Pixel Style Lock

```text
high detail pixel art,
16-bit anime pixel style,
retro Japanese game aesthetic,
soft pixel shading,
detailed pixel eyes,
cinematic pixel lighting,
cozy office atmosphere,
clean composition,
game character reference sheet
```

## Office Scene Lock

```text
clean office environment,
soft sunlight through blinds,
computer screen glow,
office desk,
documents,
coffee mug,
subtle futuristic AI interface
```

## Four View Lock

```text
four-panel character reference sheet,
same action shown from four camera angles:
front view,
side view,
top-down view,
desk-height spatial perspective focused on room depth, desk planes, and environmental perspective
```

## Safety Rewrite Table

| Input phrase | Rewrite |
| --- | --- |
| `洗澡沐浴` | `daily grooming at a bathroom sink, wearing complete home loungewear or a modest robe, tidy bathroom setting, focus on face, hair, and routine objects` |
| `躺在椅子上熟睡` | `briefly resting in an office chair, face and hairstyle visible, calm office mood, professional outfit kept neat` |
| `運動伸展` | `office wellness stretching, loose sporty jacket, neutral posture, balanced framing` |
| `低角度` | `desk-height spatial perspective focused on room depth, desk planes, and environmental perspective` |
| revealing outfit requests | `professional, fashionable, fully dressed office or everyday outfit` |
| body-focused camera wording | `balanced composition focused on face, hairstyle, action clarity, and environment` |

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

## Default Safe Action List

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

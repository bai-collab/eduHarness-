---
name: pixel-ai-secretary
description: >
  Create safe prompt packages for turning a reference person or default character
  brief into a consistent same-character Pixel Art virtual AI secretary library.
  Use when Claude or Codex needs to produce character-lock prompts, a baseline character
  sheet prompt, one-action four-view reference sheet prompts, safety rewrites,
  negative prompts, or reusable prompt-package Markdown for a 16-bit anime pixel
  art office assistant character. This v1 skill only writes prompts and does not
  generate images, call image APIs, batch-run assets, or handle API keys.
---

# Pixel AI 美術提示詞祕書

## Do Not Use When(anti-triggers)
- 一般 pixel art 或 Canvas 遊戲(→ instincts/pixel-agents-canvas)
- 非固定角色的一次性圖像 prompt

## Overview

Use this skill to convert a reference person or the default character brief into
a prompt package for a same-character Pixel Art AI secretary library. The output
is text-only: baseline prompt, action plan, one-action four-view prompt, reusable
template, negative prompt, and validation checklist.

Highest priority order:

1. Character identity
2. Pixel art style
3. Action or pose
4. Scene composition

## Capability Statement

Start every run by stating these limits in plain language:

- Can produce prompts, prompt packages, safety rewrites, and checklists.
- Can preserve explicit character identity instructions in every prompt.
- Can rewrite risky actions into professional, office, or everyday scenes.
- Does not directly generate images in v1.
- Does not guarantee model-side face consistency; it only maximizes prompt-side consistency.
- Does not batch call image APIs or manage API keys.

## Inputs

- `reference_image`: optional. If present, label it as the identity reference.
- `character_notes`: optional traits to preserve from the reference person.
- `actions`: optional list of actions. Default to `遞文件`.
- `output_path`: optional. Default, when saving is requested:
  `F:\eduHarness\outputs\pixel-ai-secretary-prompt-package.md`.

If no reference image is provided, use the default Character Bible below.

## Character Bible

Use these stable character details unless the user explicitly overrides them:

- young adult East Asian virtual AI secretary
- long black hair
- straight bangs
- soft pale skin
- gentle neutral expression with a cool professional tone
- white office shirt
- gray inner top
- black office skirt or black suit pants
- office ID card
- office accessories
- professional OL atmosphere
- Pixel Art / 16-bit anime pixel style

Never use "young female" as the character phrase. Use "young adult East Asian"
to avoid age ambiguity.

## Required Prompt Locks

Insert this identity lock into every positive prompt:

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

Insert this pixel style lock into every positive prompt:

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

Load detailed reusable components from `references/prompt-components.md` when
the request includes multiple actions, risk-prone actions, or asks for an output
package that should be saved.

## Safety Rewrite Rules

Before writing the final prompts, normalize each requested action.

| User action | Safe prompt action |
| --- | --- |
| `洗澡沐浴` | `daily grooming at a bathroom sink, wearing complete home loungewear or a modest robe, tidy bathroom setting, focus on face, hair, and routine objects` |
| `躺在椅子上熟睡` | `briefly resting in an office chair, face and hairstyle visible, calm office mood, professional outfit kept neat` |
| `運動伸展` | `office wellness stretching, loose sporty jacket, neutral posture, balanced framing` |
| `低角度` | `desk-height spatial perspective focused on room depth, desk planes, and environmental perspective` |

Apply the same principle to any risky clothing, camera, or pose wording: rewrite
it as professional, fashionable, office, or everyday activity wording. Keep the
scene professional and character-focused.

## Workflow

1. State capability and v1 limits.
2. Decide whether the input uses a reference image or default Character Bible.
3. Build a short `Character Bible` section.
4. Normalize the action list with the safety rewrite table.
5. Output Step 1 baseline character prompt first.
6. Output the action list.
7. For each requested action, output one four-panel prompt only. Do not combine
   multiple actions into one image prompt.
8. Use these fixed four views for every action:
   - front view
   - side view
   - top-down view
   - desk-height spatial perspective
9. Output the negative prompt.
10. Output the validation checklist.
11. If saving is requested, write the package to the default F-drive path unless
    the user provides another D-drive path.

Use `templates/prompt-package.md` for the final package shape.

## Output Contract

Every prompt package must include:

- Title
- Capability and limits
- Character Bible
- Reference image handling note
- Step 1 character lock sheet prompt
- Safe action list
- First action four-view prompt, default `遞文件`
- Reusable one-action four-view template
- Negative prompt
- Identity / Style / Safety / Composition checklist

The positive prompts must not include banned safety terms. Banned terms belong
only in the negative prompt or safety documentation.

## Validation

Before finalizing, verify:

- The output includes the identity lock in every positive prompt.
- The output includes the pixel style lock in every positive prompt.
- The default action is `遞文件` when no action is provided.
- Each action is separate and produces exactly one four-view prompt.
- Risk-prone actions are rewritten before prompt generation.
- The package does not ask the image model to produce text, logos, or watermarks.
- The package stays prompt-only and does not call image generation tools.
- Saved output, if any, stays under `F:\eduHarness` unless the user explicitly
  requests another approved location.

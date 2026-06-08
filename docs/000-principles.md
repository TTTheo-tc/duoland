# Duoland Engineering Principles

Duoland is a world-based SEL quest platform. It is not a quiz app, a
psychological test, a diagnosis tool, or an AI therapist.

These principles are engineering constraints. Product mistakes are expected
during early development, but principle-level violations must be detectable by
schema checks, tests, validators, expert review, or release gates.

## Product Boundaries

1. AI-generated content is candidate content only. It must never become
   published content without validation evidence and expert approval.
2. Child-facing unreviewed LLM output is forbidden.
3. Child free-text collection is blocked by default until a separate safety,
   privacy, and expert-review policy allows it.
4. Duoland must not diagnose, label, score, rank, or triage children by mental
   health risk.
5. Guardian and teacher materials are part of the content surface. They must be
   reviewed with the child-facing experience.
6. Public quest routes must only load publishable content. Draft content belongs
   in preview routes and authoring tools.

## Architecture Boundaries

1. `quest-core` owns quest schema, progress, events, and the quest state
   machine. It must remain renderer-independent.
2. `world-core` will own world, zone, scene, character, interactable, and world
   state models. It must remain renderer-independent.
3. `narrative-core` will own episode, beat, dialogue, cutscene, and branch
   models. It must remain renderer-independent.
4. Renderers are adapters. Phaser, React, and future R3F renderers must not own
   learning progress or publishability decisions.
5. Content packages own authoring, validation, review, refinement, and
   publishing gates. Runtime packages consume only published or explicit preview
   content.
6. Activity implementations can render and collect structured interaction
   results. They must not infer psychological traits from those results.

## Content Quality Rules

1. Every published quest must be versioned, validated, reviewed, and
   publishable.
2. Every SEL activity should map to explicit learning objectives and SEL
   competencies as soon as the structured objective schema is introduced.
3. SEL content should be sequenced, active, focused, and explicit.
4. Feedback should validate the child's emotion before guiding behavior.
5. Crisis, abuse, self-harm, bullying, or family violence content requires
   adult handoff guidance and extra safety review.
6. Content that looks polished but has weak pedagogy or unsafe guidance is not
   acceptable.

## Development Rules

1. Prefer small PRs with one architectural purpose.
2. Every PR must state whether it changes runtime behavior, content evidence,
   authoring gates, or only documentation.
3. Every PR should run the smallest meaningful checks, and release-affecting PRs
   should run `npm run lint`, `npm test`, `npm run build`, and content checks.
4. Every PR must be reviewed by an independent agent before merge.
5. If a rule cannot be enforced yet, document the intended future check and do
   not pretend it is already enforced.

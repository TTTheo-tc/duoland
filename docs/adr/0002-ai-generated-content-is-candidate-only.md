# ADR 0002: AI Generated Content Is Candidate Only

Status: Accepted

## Context

Duoland uses AI-assisted content production as an authoring accelerator. The
domain is children SEL and mental-health education, where polished but unsafe
content is unacceptable.

## Decision

AI-generated content is candidate content. It cannot publish itself, approve
itself, or appear as unreviewed child-facing runtime output.

The required lifecycle is:

```text
candidate generation
  -> deterministic validation
  -> optional LLM or manual validation
  -> revision packet
  -> expert review
  -> publish gate
```

## Consequences

- `content-authoring` may expose generator interfaces, but default generation
  should remain disabled unless an authoring service is injected.
- Runtime packages should not call LLMs for child-facing content.
- `content:publish` remains the release gate for local content artifacts.
- Future AI services must produce reviewable artifacts, not published quests.

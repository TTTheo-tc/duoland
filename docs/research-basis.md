# Research Basis

This document maps the research ideas behind Duoland to concrete engineering
constraints. It is not a literature review. It is a guardrail for code and
content design.

## QUEST-AI

QUEST-AI is the starting point for Duoland's authoring pipeline. Its useful
idea is not that an LLM can generate questions. The useful idea is the workflow:

```text
generate candidate content
  -> verify it
  -> refine it
  -> evaluate it with humans
```

Duoland already reflects this through `content-authoring`,
`content-validation`, `content-refinement`, `review-core`, and content CLI
commands. Future AI generation must remain on the authoring side. It must not
enter the child-facing intervention loop as unreviewed output.

Source: https://psb.stanford.edu/psb-online/proceedings/psb25/bedi.pdf

## STAIR-AIG

STAIR-AIG motivates structured human-AI collaboration rather than autonomous
content publication. For Duoland this means expert review must be structured,
role-aware, and traceable.

Engineering implication:

- Review packets must include the full reviewable surface, not only summaries.
- Expert reviews should record decision, role, notes, required follow-ups, and
  reviewed issue IDs, and review coverage.
- Review policy requires distinct approving reviewers, required roles, and
  coverage sections rather than a single approval.

## EvalGen

EvalGen highlights that validators themselves need validation. LLM-assisted or
rule-based evaluators can drift from human preferences and may miss important
failure modes.

Engineering implication:

- Add `validator-evaluation` before relying on complex validators.
- Maintain gold cases for critical safety, SEL pedagogy, narrative alignment,
  and asset representation.
- CI should fail on critical false negatives.

Source: https://people.eecs.berkeley.edu/~bjoern/papers/shankar-validators-uist2024.pdf

## Jia et al.

Work on faithfulness of LLM-generated feedback motivates a strict boundary:
child-facing feedback must not be unreviewed LLM text. A fluent response can be
unfaithful to the learner context or pedagogically unsafe.

Engineering implication:

- Structured input is the default.
- Direct LLM output to children is forbidden until a future policy explicitly
  permits a reviewed, constrained, and monitored mode.
- Activities should produce structured evidence, not psychological labels.

Source: https://educationaldatamining.org/edm2024/proceedings/2024.EDM-short-papers.49/

## Durlak et al.

The SEL evidence base motivates moving beyond free-form learning objective
strings. Duoland should encode SEL competencies and SAFE design criteria in the
content model.

Engineering implication:

- Add structured learning objectives.
- Add SEL competencies such as self-awareness, self-management, social
  awareness, relationship skills, and responsible decision making.
- Require activities and narrative beats to bind to objective IDs.

Source: https://casel.s3.us-east-2.amazonaws.com/impact-enhancing-students-social-emotional-learning-meta-analysis-school-based-universal-interventions.pdf

## Yeager and Walton

Social-psychological interventions are context-dependent. Duoland should not
treat a quest as a generic worksheet with points. The world, character, conflict,
choice, feedback, reflection, and transfer step must form a coherent educational
experience.

Engineering implication:

- World and narrative systems must serve SEL context, not decoration.
- NPCs are story guides or peers, not therapists.
- Each episode should connect story context to a real-world transfer prompt.

Source: https://journals.sagepub.com/doi/10.3102/0034654311405999

## 3D Runtime References

R3F is a candidate Web 3D renderer for future single-room prototypes because it
fits the existing React web app while keeping rendering behind an adapter.
glTF/GLB is the expected model and animation exchange format for the asset
pipeline.

Sources:

- https://r3f.docs.pmnd.rs/getting-started/introduction
- https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html

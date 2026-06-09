# Content Lifecycle

Duoland separates authoring from runtime. The runtime consumes published
content, while authoring tools create, validate, review, refine, and publish
content.

## State Vocabulary

The authoring schema reserves these states:

```text
drafting
generated
auto_validating
auto_validation_failed
needs_ai_refinement
needs_expert_review
expert_changes_requested
approved
published
archived
```

The current derived authoring snapshot emits the states that are reachable from
local quest, validation, and review evidence. Some reserved states, such as
`generated` and `auto_validating`, are for future AI authoring services and
Studio workflows.

The public runtime must only expose publishable content. Preview routes may load
draft content for development and expert review.

## Required Evidence

Before a quest can be published, it needs:

1. A valid `quest.json`.
2. An up-to-date deterministic validation report.
3. No blocking validation issues.
4. A safety decision of `allow`.
5. Low overall risk and appropriate age fit.
6. Matching expert review evidence that satisfies the default review policy.
7. At least two distinct approving reviewers are present.
8. Required reviewer roles and review coverage sections are present.
9. No required expert follow-ups.

The current lifecycle commands support this process:

```text
npm run content:validate -- <quest-slug>
npm run content:check-validation -- <quest-slug>
npm run content:review-packet -- <quest-slug>
npm run content:record-review -- <quest-slug> <review-json-path>
npm run content:revision-packet -- <quest-slug>
npm run content:archive-stale-reviews -- <quest-slug>
npm run content:publish -- <quest-slug>
npm run content:status -- <quest-slug>
```

The final local release gate is `content:publish`. Supporting commands create,
check, inspect, review, revise, or archive evidence, but they do not replace the
publish gate.

## AI Authoring Boundary

AI services may generate candidate briefs, quest drafts, activity drafts,
dialogue drafts, cutscene drafts, guardian summaries, teacher guides, and
revision suggestions.

AI services must not:

- Mark content as approved.
- Publish content.
- Generate unreviewed child-facing runtime feedback.
- Replace expert review.
- Decide that its own revision is safe.

## Future Extensions

The next lifecycle extensions should be:

1. Review coverage expansion for world narrative and asset representation when
   published content uses those surfaces.
2. Studio UI over the existing content lifecycle commands.

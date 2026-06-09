# Duoland Documentation

Start here:

- [Engineering Principles](./000-principles.md)
- [Research Basis](./research-basis.md)
- [Content Lifecycle](./content-lifecycle.md)
- [Safety Policy](./safety-policy.md)
- [World Runtime](./world-runtime.md)
- [Renderer Adapter](./renderer-adapter.md)

Current app entrypoints:

- `apps/web`: child-facing quest runtime and preview routes.
- `apps/studio`: read-only authoring dashboard for content status, validation,
  review coverage, and publishability blockers.

Common local checks:

```bash
npm run check
npm run test:smoke
npm run test:smoke:studio
npm run test:smoke:all
```

`npm run check` covers package boundaries, linting, unit tests, content evidence,
asset validation, validator gold cases, and both app builds. Browser smoke tests
remain explicit because they start local servers.

Architecture decision records:

- [ADR 0001: Quest Core Is Renderer Independent](./adr/0001-quest-core-is-renderer-independent.md)
- [ADR 0002: AI Generated Content Is Candidate Only](./adr/0002-ai-generated-content-is-candidate-only.md)
- [ADR 0003: World Runtime Is Not Quest Runtime](./adr/0003-world-runtime-is-not-quest-runtime.md)

Historical long-form planning documents:

- [AI Quests product and architecture research](./ai-quests-product-and-architecture.md)
- [SEL quest architecture specification](./ai_sel_quest_architecture_spec.md)

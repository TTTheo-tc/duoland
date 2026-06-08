# ADR 0003: World Runtime Is Not Quest Runtime

Status: Accepted

## Context

The current MVP is a linear quest with stages and activities. The long-term
goal is a world-based SEL experience with scenes, characters, objects,
dialogue, cutscenes, and renderer-specific presentation.

If world concepts are added directly into `quest-core`, the quest state machine
will become a mixed learning, narrative, rendering, and asset system.

## Decision

World concepts should be modeled in a future `world-core` package. Narrative
concepts should be modeled in a future `narrative-core` package. `quest-core`
may reference these systems through lightweight bindings, but it must not own
their internal models or renderer behavior.

## Consequences

- A quest can remain valid without a world binding.
- A world can be validated independently of React, Phaser, or R3F.
- Narrative beats can connect world context to activities without replacing the
  quest runtime.
- The first 3D prototype should be built through renderer and world adapters,
  not by hardcoding 3D assumptions into `quest-core`.

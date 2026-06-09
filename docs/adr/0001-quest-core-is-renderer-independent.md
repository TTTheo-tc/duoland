# ADR 0001: Quest Core Is Renderer Independent

Status: Accepted

## Context

Duoland currently has `quest-core`, React activity rendering, and a Phaser map.
The long-term product goal includes 2D, 2.5D, and 3D world experiences. If
`quest-core` imports renderer code, the learning runtime will become hard to
test and hard to reuse.

## Decision

`quest-core` owns quest schema, progress snapshots, learning events, validation
of quest semantics, and the quest state machine. It must not import React,
Next.js, Phaser, Three, R3F, browser APIs, or renderer packages.

Renderer adapters consume public quest state and emit structured renderer
events. They do not own learning progress.

## Consequences

- Unit tests for quest progression stay fast and renderer-free.
- Future R3F work can be added without changing quest-state semantics.
- Renderer-specific features must be expressed through adapter contracts,
  world state, narrative beats, or assets instead of hardcoded stage checks.

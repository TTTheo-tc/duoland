# Renderer Adapter

Renderers are visual adapters. They must not own quest progress, content
publishability, validation, review, or child safety policy.

## Current State

The current app uses:

- React for product UI and activity rendering.
- Phaser for the lightweight quest map visualization.
- `renderer-r3f` for an experimental single-room world playground.
- XState in `quest-core` for quest progression.

This is a good MVP shape, but Phaser should not become the platform core.

## Target Boundary

```text
QuestPlayer
  -> renderer host
    -> renderer adapter
      -> React renderer
      -> Phaser renderer
      -> R3F renderer
```

Renderer adapters receive public state and emit structured events.

They should receive:

- current stage or beat ID
- current activity ID
- completed stage and activity IDs
- public flags
- scene or world state from `world-core`

They may emit:

- `INTERACTABLE_CLICKED`
- `WORLD_OBJECT_OBSERVED`
- `CUTSCENE_COMPLETED`
- `MINI_GAME_COMPLETED`

They must not:

- call persistence directly
- decide quest completion
- publish content
- inspect expert review evidence
- infer mental health traits

## Phaser

Phaser can remain the 2D or 2.5D renderer. It should move toward an adapter
role where it renders maps, nodes, NPCs, and simple minigames based on public
runtime state.

## R3F

Web 3D work has started with `renderer-r3f` and a playground route. The current
target remains intentionally small: one room, one character, a small set of
selectable interactables, and one story beat. The content fixture references
activity transitions, but the current playground only renders the scene and
selectable interactables. Expansion should happen in renderer and world
packages, not by modifying `quest-core`.

## Asset Pipeline

3D assets should be represented through an asset manifest before a large 3D
experience is built. The manifest should track:

- model and animation IDs
- GLB source files
- texture and audio references
- license metadata
- mobile performance budgets
- required animation clips

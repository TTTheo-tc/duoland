# World Runtime

Duoland is evolving from a linear quest MVP into a world-based SEL quest
platform. `quest-core` remains the learning runtime. `world-core` now models
spatial and character context without depending on any renderer, and
`narrative-core` models episodes, beats, dialogue, and cutscenes.

## Separation Of Responsibilities

```text
quest-core
  learning flow, progress, activity completion, events

world-core
  world, zone, scene, character, interactable, world state

narrative-core
  episode, beat, dialogue, cutscene, branch rules

renderer adapters
  React, Phaser, R3F, or other visual presentation
```

World state must not replace quest progress. It should provide context and
visual continuity around the learning flow.

## Current Core Types

`world-core` currently defines and validates the world definition and runtime
state types:

- `WorldDefinition`
- `WorldZone`
- `SceneDefinition`
- `CharacterDefinition`
- `InteractableDefinition`
- `WorldRuntimeState`
- `WorldAction`

It also defines renderer/runtime event TypeScript contracts:

- `WorldRuntimeToRendererEvent`
- `WorldRendererToRuntimeEvent`

Those event contracts are typed, but they are not yet schema-validated.

The current content fixture includes one small world:

```text
one zone
one scene
one NPC
one observable object
one activity entry point
```

## Design Rules

1. `world-core` must not import React, Phaser, Three, Next.js, DOM APIs, or
   renderer packages.
2. Characters are guides, peers, or story figures. They are not therapists.
3. Interactables should trigger structured world or narrative events, not
   arbitrary runtime callbacks.
4. A world scene must serve learning context. It is not just decoration.
5. World validation should check references among zones, scenes, characters,
   interactables, assets, and narrative beats.

## Current Prototype

The first world prototype is a single-room version of `emotion-detective`:

```text
scene: art room
character: Xiaoyu
object: crumpled drawing
cutscene: opening story beat
fixture activities: emotion-card, scenario-choice
renderer: R3F playground
```

The fixture connects the world and narrative records to existing activities. The
current playground renders the scene and selectable interactables; it does not
yet drive quest activity transitions from renderer events. This proves the
platform can become a world experience without turning the MVP into a large 3D
project too early.

## Remaining Gaps

The current world layer is still an early platform slice. Next work should keep
the same small-surface discipline:

1. Move experimental world playback out of `apps/web` if it starts to become a
   real authoring or playground product.
2. Keep renderer state derived from public quest/world state.
3. Add richer world validation before adding more scenes, assets, or cutscenes.
4. Keep world interactions structured; do not add free-form child dialogue or
   AI NPC output.

# World Runtime Plan

Duoland should evolve from a linear quest MVP into a world-based SEL quest
platform. The current `quest-core` should remain the learning runtime. A future
`world-core` should model spatial and character context without depending on any
renderer.

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

## Future Core Types

`world-core` should eventually define:

- `WorldDefinition`
- `WorldZone`
- `SceneDefinition`
- `CharacterDefinition`
- `InteractableDefinition`
- `WorldState`
- `WorldEvent`
- `WorldAction`

The first version should support one small world:

```text
one zone
one scene
one NPC
one observable object
one activity entry point
one world flag change after activity completion
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

## First Prototype

The first world prototype should be a single-room version of `emotion-detective`:

```text
scene: art room
character: Xiaoyu
object: crumpled drawing
cutscene: camera moves from drawing to Xiaoyu
activity: emotion-card
activity: scenario-choice
feedback: room color changes after a supportive choice
```

This proves the platform can become a world experience without turning the MVP
into a large 3D project too early.

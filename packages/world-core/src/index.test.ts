import { describe, expect, it } from 'vitest'
import {
  assertWorldBindingReference,
  completeWorldInteractable,
  createInitialWorldState,
  setWorldFlag,
  transitionWorldScene,
  validateWorldBindingReference,
  validateWorldDefinition,
  validateWorldSemantics,
  type WorldDefinition
} from './index.ts'

const world: WorldDefinition = {
  id: 'emotion-town',
  version: '0.1.0',
  title: 'Emotion Town',
  description: 'A small world for SEL quest prototypes.',
  artDirection: {
    style: 'storybook_3d',
    mood: ['warm', 'safe', 'curious']
  },
  zones: [
    {
      id: 'emotion_harbor',
      title: 'Emotion Harbor',
      theme: 'emotion_harbor',
      sceneIds: ['art_room']
    }
  ],
  scenes: [
    {
      id: 'art_room',
      zoneId: 'emotion_harbor',
      title: 'Art Room',
      cameraStart: {
        position: [0, 2, 6],
        target: [0, 1, 0],
        fov: 45
      },
      characterPlacements: [
        {
          characterId: 'xiaoyu',
          position: [0, 0, 0],
          initialAnimation: 'sad_idle'
        }
      ],
      interactableIds: ['xiaoyu_npc', 'crumpled_drawing'],
      lightingPreset: 'soft_day'
    }
  ],
  characters: [
    {
      id: 'xiaoyu',
      name: 'Xiaoyu',
      role: 'child_peer',
      personalityTags: ['quiet', 'creative'],
      asset: {
        modelAssetId: 'model_xiaoyu_placeholder',
        animationSetId: 'anim_child_peer_basic'
      },
      safetyProfile: {
        neverActsAsTherapist: true,
        canDiscussSensitiveTopics: false
      },
      dialogueStyle: {
        ageBand: '8-10',
        tone: 'warm',
        maxSentenceLength: 'short'
      }
    }
  ],
  interactables: [
    {
      id: 'xiaoyu_npc',
      sceneId: 'art_room',
      type: 'npc',
      label: 'Xiaoyu',
      characterId: 'xiaoyu',
      position: [0, 0, 0],
      radius: 1.2,
      onInteract: [{ type: 'start_dialogue', dialogueId: 'dialogue_xiaoyu_intro' }]
    },
    {
      id: 'crumpled_drawing',
      sceneId: 'art_room',
      type: 'emotion_clue',
      label: 'Crumpled drawing',
      position: [-1, 0, 0.5],
      radius: 0.8,
      onInteract: [
        {
          type: 'set_world_flag',
          flag: 'observed_crumpled_drawing',
          value: true
        }
      ]
    }
  ]
}

describe('world-core', () => {
  it('validates a world definition', () => {
    expect(validateWorldDefinition(world)).toEqual(world)
    expect(validateWorldSemantics(world)).toEqual([])
  })

  it('rejects worlds with broken scene references', () => {
    const invalidWorld: WorldDefinition = {
      ...world,
      scenes: [
        {
          ...world.scenes[0],
          characterPlacements: [
            {
              characterId: 'missing_character',
              position: [0, 0, 0]
            }
          ]
        }
      ]
    }

    expect(validateWorldSemantics(invalidWorld).map((issue) => issue.code)).toContain(
      'unknown_character_id'
    )
  })

  it('rejects mismatched zone and interactable ownership', () => {
    const invalidWorld: WorldDefinition = {
      ...world,
      zones: [
        {
          ...world.zones[0],
          sceneIds: []
        }
      ],
      scenes: [
        {
          ...world.scenes[0],
          interactableIds: ['xiaoyu_npc']
        }
      ]
    }

    expect(validateWorldSemantics(invalidWorld).map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'scene_missing_from_zone',
        'interactable_missing_from_scene'
      ])
    )
  })

  it('rejects zones that list scenes owned by another zone', () => {
    const invalidWorld: WorldDefinition = {
      ...world,
      zones: [
        world.zones[0],
        {
          id: 'calm_garden',
          title: 'Calm Garden',
          theme: 'calm_garden',
          sceneIds: ['art_room']
        }
      ]
    }

    expect(validateWorldSemantics(invalidWorld).map((issue) => issue.code)).toContain(
      'scene_zone_mismatch'
    )
  })

  it('requires npc interactables to reference a placed character', () => {
    const invalidWorld: WorldDefinition = {
      ...world,
      interactables: [
        {
          ...world.interactables[0],
          characterId: 'missing_character'
        },
        world.interactables[1]
      ]
    }

    expect(validateWorldSemantics(invalidWorld).map((issue) => issue.code)).toContain(
      'unknown_npc_character_id'
    )
  })

  it('rejects npc interactables without character references', () => {
    const invalidWorld: WorldDefinition = {
      ...world,
      interactables: [
        {
          ...world.interactables[0],
          characterId: undefined
        },
        world.interactables[1]
      ]
    }

    expect(validateWorldSemantics(invalidWorld).map((issue) => issue.code)).toContain(
      'missing_npc_character_id'
    )
  })

  it('rejects npc interactables for characters outside their scene', () => {
    const invalidWorld: WorldDefinition = {
      ...world,
      characters: [
        ...world.characters,
        {
          ...world.characters[0],
          id: 'mira',
          name: 'Mira'
        }
      ],
      interactables: [
        {
          ...world.interactables[0],
          characterId: 'mira'
        },
        world.interactables[1]
      ]
    }

    expect(validateWorldSemantics(invalidWorld).map((issue) => issue.code)).toContain(
      'npc_character_missing_from_scene'
    )
  })

  it('rejects character references on non-npc interactables', () => {
    const invalidWorld: WorldDefinition = {
      ...world,
      interactables: [
        world.interactables[0],
        {
          ...world.interactables[1],
          characterId: 'xiaoyu'
        }
      ]
    }

    expect(validateWorldSemantics(invalidWorld).map((issue) => issue.code)).toContain(
      'unexpected_interactable_character_id'
    )
  })

  it('validates quest world binding references', () => {
    expect(
      validateWorldBindingReference(
        { worldId: 'emotion-town', entrySceneId: 'art_room' },
        world
      )
    ).toEqual([])

    expect(() =>
      assertWorldBindingReference(
        { worldId: 'emotion-town', entrySceneId: 'missing_scene' },
        world
      )
    ).toThrow()
  })

  it('creates and updates renderer-agnostic world state', () => {
    const initialState = createInitialWorldState(world, {
      entrySceneId: 'art_room'
    })
    const flaggedState = setWorldFlag(
      initialState,
      'observed_crumpled_drawing',
      true
    )
    const completedState = completeWorldInteractable(
      flaggedState,
      'crumpled_drawing'
    )
    const transitionedState = transitionWorldScene(completedState, 'art_room')

    expect(initialState).toMatchObject({
      worldId: 'emotion-town',
      activeSceneId: 'art_room',
      visitedSceneIds: ['art_room']
    })
    expect(flaggedState.flags.observed_crumpled_drawing).toBe(true)
    expect(completedState.completedInteractableIds).toEqual(['crumpled_drawing'])
    expect(transitionedState.visitedSceneIds).toEqual(['art_room'])
  })
})

import { describe, expect, it } from 'vitest'
import {
  assertNarrativeReferences,
  completeNarrativeBeat,
  createInitialNarrativeState,
  setNarrativeFlag,
  transitionNarrativeBeat,
  validateNarrativeDefinition,
  validateNarrativeReferences,
  validateNarrativeSemantics,
  type NarrativeDefinition,
  type NarrativeReferenceContext
} from './index.ts'

const narrative: NarrativeDefinition = {
  id: 'emotion-detective-narrative',
  questId: 'emotion-detective',
  version: '0.1.0',
  episodes: [
    {
      id: 'episode_xiaoyu_drawing',
      questId: 'emotion-detective',
      title: 'Xiaoyu and the drawing',
      summary: 'The player observes Xiaoyu and practices naming feelings.',
      worldZoneId: 'emotion_harbor',
      entrySceneId: 'art_room',
      learningObjectiveIds: ['lo_emotion_recognition'],
      beats: [
        {
          id: 'beat_opening_dialogue',
          kind: 'dialogue',
          sceneId: 'art_room',
          dialogueId: 'dialogue_xiaoyu_intro',
          learningObjectiveIds: ['lo_emotion_recognition'],
          next: 'beat_emotion_choice'
        },
        {
          id: 'beat_emotion_choice',
          kind: 'activity',
          sceneId: 'art_room',
          activityId: 'emotion_choice_001',
          learningObjectiveIds: ['lo_emotion_recognition']
        }
      ]
    }
  ],
  dialogues: [
    {
      id: 'dialogue_xiaoyu_intro',
      sceneId: 'art_room',
      lines: [
        {
          id: 'line_001',
          speakerId: 'guide',
          speakerRole: 'guide',
          speakerName: 'Guide',
          text: 'Let us observe how Xiaoyu may be feeling.',
          emotion: 'calm'
        }
      ]
    }
  ],
  cutscenes: [
    {
      id: 'cutscene_xiaoyu_intro',
      sceneId: 'art_room',
      skippable: true,
      replayable: true,
      learningObjectiveIds: ['lo_emotion_recognition'],
      tracks: [
        {
          type: 'dialogue',
          dialogueId: 'dialogue_xiaoyu_intro',
          at: 0
        }
      ]
    }
  ]
}

const referenceContext: NarrativeReferenceContext = {
  questId: 'emotion-detective',
  episodeIds: ['episode_xiaoyu_drawing'],
  activityIds: ['emotion_choice_001'],
  learningObjectiveIds: ['lo_emotion_recognition'],
  worldZoneIds: ['emotion_harbor'],
  sceneIds: ['art_room'],
  interactableIds: ['xiaoyu_npc'],
  characterIds: ['xiaoyu']
}

describe('narrative-core', () => {
  it('validates a narrative definition', () => {
    expect(validateNarrativeDefinition(narrative)).toEqual(narrative)
    expect(validateNarrativeSemantics(narrative)).toEqual([])
  })

  it('rejects beats with unknown next beat ids', () => {
    const invalidNarrative: NarrativeDefinition = {
      ...narrative,
      episodes: [
        {
          ...narrative.episodes[0],
          beats: [
            {
              ...narrative.episodes[0].beats[0],
              next: 'missing_beat'
            },
            narrative.episodes[0].beats[1]
          ]
        }
      ]
    }

    expect(validateNarrativeSemantics(invalidNarrative).map((issue) => issue.code)).toContain(
      'unknown_next_beat_id'
    )
  })

  it('requires kind-specific beat references', () => {
    const invalidNarrative: NarrativeDefinition = {
      ...narrative,
      episodes: [
        {
          ...narrative.episodes[0],
          beats: [
            {
              id: 'beat_missing_activity',
              kind: 'activity',
              learningObjectiveIds: ['lo_emotion_recognition']
            }
          ]
        }
      ]
    }

    expect(validateNarrativeSemantics(invalidNarrative).map((issue) => issue.code)).toContain(
      'missing_activity_id'
    )
  })

  it('validates external quest and world references', () => {
    expect(validateNarrativeReferences(narrative, referenceContext)).toEqual([])
    expect(() =>
      assertNarrativeReferences(narrative, referenceContext)
    ).not.toThrow()
  })

  it('rejects unknown activity and learning objective references', () => {
    const invalidNarrative: NarrativeDefinition = {
      ...narrative,
      episodes: [
        {
          ...narrative.episodes[0],
          learningObjectiveIds: ['missing_objective'],
          beats: [
            {
              ...narrative.episodes[0].beats[1],
              activityId: 'missing_activity',
              learningObjectiveIds: ['missing_objective']
            }
          ]
        }
      ]
    }

    expect(
      validateNarrativeReferences(invalidNarrative, referenceContext).map(
        (issue) => issue.code
      )
    ).toEqual(
      expect.arrayContaining([
        'unknown_episode_learning_objective_id',
        'unknown_beat_activity_id',
        'unknown_beat_learning_objective_id'
      ])
    )
  })

  it('rejects quest-declared episodes missing from the narrative', () => {
    expect(
      validateNarrativeReferences(narrative, {
        ...referenceContext,
        episodeIds: ['episode_xiaoyu_drawing', 'episode_missing']
      }).map((issue) => issue.code)
    ).toContain('quest_episode_missing_from_narrative')
  })

  it('rejects narratives when the quest declares no episodes', () => {
    expect(
      validateNarrativeReferences(narrative, {
        ...referenceContext,
        episodeIds: []
      }).map((issue) => issue.code)
    ).toContain('narrative_not_declared_by_quest')
  })

  it('rejects branch rules that reference unknown activities', () => {
    const invalidNarrative: NarrativeDefinition = {
      ...narrative,
      episodes: [
        {
          ...narrative.episodes[0],
          beats: [
            {
              ...narrative.episodes[0].beats[0],
              next: [
                {
                  type: 'activity_completed',
                  activityId: 'missing_activity',
                  nextBeatId: 'beat_emotion_choice'
                }
              ]
            },
            narrative.episodes[0].beats[1]
          ]
        }
      ]
    }

    expect(
      validateNarrativeReferences(invalidNarrative, referenceContext).map(
        (issue) => issue.code
      )
    ).toContain('unknown_branch_activity_id')
  })

  it('rejects unknown world-character dialogue speakers', () => {
    const invalidNarrative: NarrativeDefinition = {
      ...narrative,
      dialogues: [
        {
          ...narrative.dialogues[0],
          lines: [
            {
              ...narrative.dialogues[0].lines[0],
              speakerId: 'missing_character',
              speakerRole: 'world_character'
            }
          ]
        }
      ]
    }

    expect(
      validateNarrativeReferences(invalidNarrative, referenceContext).map(
        (issue) => issue.code
      )
    ).toContain('unknown_dialogue_speaker_id')
  })

  it('creates and updates renderer-agnostic narrative state', () => {
    const initialState = createInitialNarrativeState(narrative)
    const completedState = completeNarrativeBeat(
      initialState,
      'beat_opening_dialogue'
    )
    const transitionedState = transitionNarrativeBeat(
      completedState,
      'beat_emotion_choice'
    )
    const flaggedState = setNarrativeFlag(
      transitionedState,
      'observed_xiaoyu',
      true
    )

    expect(initialState).toMatchObject({
      narrativeId: 'emotion-detective-narrative',
      episodeId: 'episode_xiaoyu_drawing',
      currentBeatId: 'beat_opening_dialogue'
    })
    expect(completedState.completedBeatIds).toEqual(['beat_opening_dialogue'])
    expect(transitionedState.currentBeatId).toBe('beat_emotion_choice')
    expect(flaggedState.flags.observed_xiaoyu).toBe(true)
  })
})

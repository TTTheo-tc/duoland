import { describe, expect, it } from 'vitest'
import {
  assertQuestPublishable,
  assertContentEvidence,
  auditContentEvidence,
  getQuestAuthoringSnapshot,
  getQuestArchivedExpertReviews,
  getQuestExpertReviews,
  getQuestAssetManifestBySlug,
  getQuestNarrativeBySlug,
  getQuestPublishabilityReasons,
  getQuestValidationReport,
  getQuestWorldBySlug,
  isQuestPublishable,
  listPublishableQuests
} from './index'
import { getPreviewQuestBySlug, listPreviewQuests } from './preview'
import {
  assertWorldActivityReferences,
  getQuestEntryBySlug
} from './registry'

describe('content package publishability gates', () => {
  it('keeps local draft quests available for preview', () => {
    expect(listPreviewQuests().map((quest) => quest.slug)).toContain(
      'emotion-detective'
    )
  })

  it('loads a persisted validation report for the local quest', () => {
    const report = getQuestValidationReport('emotion-detective')

    expect(report?.id).toBe('report_emotion-detective_1.0.0_rules')
    expect(report?.status).toBe('passed')
    expect(report?.summary.safetyDecision).toBe('allow')
  })

  it('loads the world definition bound to the local quest', () => {
    const world = getQuestWorldBySlug('emotion-detective')
    const quest = getPreviewQuestBySlug('emotion-detective')
    const activityIds = new Set(
      quest?.activities.map((activity) => activity.id) ?? []
    )

    expect(world?.id).toBe('emotion-town')
    expect(world?.scenes.map((scene) => scene.id)).toContain('art_room')
    expect(world?.interactables.map((interactable) => interactable.id)).toEqual([
      'xiaoyu_npc',
      'crumpled_drawing'
    ])
    const worldActivityIds =
      world?.interactables.flatMap((interactable) =>
        interactable.onInteract
          .filter((action) => action.type === 'start_activity')
          .map((action) => action.activityId)
      ) ?? []

    expect(worldActivityIds).toEqual(['dialogue_intro'])
    expect(
      worldActivityIds.every((activityId) => activityIds.has(activityId))
    ).toBe(true)
  })

  it('loads the asset manifest bound to the local world', () => {
    const world = getQuestWorldBySlug('emotion-detective')
    const assetManifest = getQuestAssetManifestBySlug('emotion-detective')

    expect(assetManifest?.id).toBe(world?.assetManifestId)
    expect(assetManifest?.performanceBudget.mobileTargetFps).toBe(30)
    expect(assetManifest?.assets.map((asset) => asset.id)).toEqual([
      'model_xiaoyu_placeholder',
      'anim_child_peer_basic',
      'texture_art_room_placeholder'
    ])
  })

  it('rejects world actions that reference unknown quest activities', () => {
    const entry = getQuestEntryBySlug('emotion-detective')
    if (!entry?.world) throw new Error('Expected local quest world fixture.')

    expect(() =>
      assertWorldActivityReferences({
        ...entry,
        world: {
          ...entry.world,
          interactables: [
            {
              ...entry.world.interactables[0],
              onInteract: [
                {
                  type: 'start_activity',
                  activityId: 'missing_activity'
                }
              ]
            },
            ...entry.world.interactables.slice(1)
          ]
        }
      })
    ).toThrow(/missing_activity/)
  })

  it('loads the narrative definition bound to the local quest', () => {
    const narrative = getQuestNarrativeBySlug('emotion-detective')
    const quest = getPreviewQuestBySlug('emotion-detective')

    expect(narrative?.id).toBe('emotion-detective-narrative')
    expect(narrative?.episodes.map((episode) => episode.id)).toEqual(
      quest?.episodeIds
    )
    expect(narrative?.episodes[0].beats.map((beat) => beat.id)).toEqual([
      'beat_opening_cutscene',
      'beat_opening_dialogue',
      'beat_observe_drawing',
      'beat_emotion_choice',
      'beat_scenario_choice',
      'beat_breathing',
      'beat_recap'
    ])
  })

  it('tracks expert reviews separately from automated validation', () => {
    expect(getQuestExpertReviews('emotion-detective')).toEqual([])
  })

  it('loads archived expert review history without counting it as current approval', () => {
    expect(getQuestArchivedExpertReviews('emotion-detective')).toEqual([])
    expect(getQuestPublishabilityReasons('emotion-detective')).toContain(
      'missing expert approval'
    )
  })

  it('derives an authoring state for the local quest', () => {
    const snapshot = getQuestAuthoringSnapshot('emotion-detective')
    const report = getQuestValidationReport('emotion-detective')

    expect(snapshot?.state).toBe('needs_expert_review')
    expect(snapshot?.contentHash).toBe(report?.contentHash)
    expect(snapshot?.publishabilityReasons).toEqual([
      'quest status is draft',
      'missing expert approval'
    ])
  })

  it('does not list draft quests as publishable', () => {
    expect(isQuestPublishable('emotion-detective')).toBe(false)
    expect(listPublishableQuests()).toEqual([])
    expect(getQuestPublishabilityReasons('emotion-detective')).toEqual([
      'quest status is draft',
      'missing expert approval'
    ])
    expect(() => assertQuestPublishable('emotion-detective')).toThrow()
  })

  it('has internally consistent persisted content evidence', () => {
    expect(auditContentEvidence()).toEqual([])
    expect(() => assertContentEvidence()).not.toThrow()
  })
})

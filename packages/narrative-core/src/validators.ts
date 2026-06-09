import { NarrativeDefinitionSchema } from './schema.ts'
import type {
  BranchRule,
  NarrativeBeat,
  NarrativeDefinition,
  NarrativeReferenceContext
} from './types.ts'

export interface NarrativeValidationIssue {
  path: string
  code: string
  message: string
  severity: 'error' | 'warning'
}

export class NarrativeValidationError extends Error {
  issues: NarrativeValidationIssue[]

  constructor(issues: NarrativeValidationIssue[]) {
    super('Narrative validation failed')
    this.issues = issues
  }
}

export function validateNarrativeDefinition(input: unknown): NarrativeDefinition {
  const narrative = NarrativeDefinitionSchema.parse(input) as NarrativeDefinition
  const issues = validateNarrativeSemantics(narrative)

  if (issues.some((issue) => issue.severity === 'error')) {
    throw new NarrativeValidationError(issues)
  }

  return narrative
}

export function validateNarrativeSemantics(
  narrative: NarrativeDefinition
): NarrativeValidationIssue[] {
  const issues: NarrativeValidationIssue[] = []
  const episodeIds = collectIds(
    narrative.episodes,
    'episodes',
    'duplicate_episode_id',
    'Duplicate episode id.'
  )
  const dialogueIds = collectIds(
    narrative.dialogues,
    'dialogues',
    'duplicate_dialogue_id',
    'Duplicate dialogue id.'
  )
  const cutsceneIds = collectIds(
    narrative.cutscenes,
    'cutscenes',
    'duplicate_cutscene_id',
    'Duplicate cutscene id.'
  )

  issues.push(...episodeIds.issues, ...dialogueIds.issues, ...cutsceneIds.issues)

  for (const episode of narrative.episodes) {
    if (episode.questId !== narrative.questId) {
      issues.push(
        error(
          `episodes.${episode.id}.questId`,
          'episode_quest_mismatch',
          'Episode questId must match the narrative questId.'
        )
      )
    }

    const beatIds = collectIds(
      episode.beats,
      `episodes.${episode.id}.beats`,
      'duplicate_beat_id',
      'Duplicate beat id.'
    )
    issues.push(...beatIds.issues)

    for (const beat of episode.beats) {
      issues.push(
        ...validateBeatRequiredReferences(
          beat,
          `episodes.${episode.id}.beats.${beat.id}`
        )
      )

      if (beat.dialogueId && !dialogueIds.ids.has(beat.dialogueId)) {
        issues.push(
          error(
            `episodes.${episode.id}.beats.${beat.id}.dialogueId`,
            'unknown_dialogue_id',
            'Beat references an unknown dialogue.'
          )
        )
      }

      if (beat.cutsceneId && !cutsceneIds.ids.has(beat.cutsceneId)) {
        issues.push(
          error(
            `episodes.${episode.id}.beats.${beat.id}.cutsceneId`,
            'unknown_cutscene_id',
            'Beat references an unknown cutscene.'
          )
        )
      }

      for (const nextBeatId of getNextBeatIds(beat.next)) {
        if (!beatIds.ids.has(nextBeatId)) {
          issues.push(
            error(
              `episodes.${episode.id}.beats.${beat.id}.next`,
              'unknown_next_beat_id',
              'Beat references an unknown next beat.'
            )
          )
        }
      }
    }
  }

  for (const cutscene of narrative.cutscenes) {
    for (const track of cutscene.tracks) {
      if (track.type === 'dialogue' && !dialogueIds.ids.has(track.dialogueId)) {
        issues.push(
          error(
            `cutscenes.${cutscene.id}.tracks.dialogueId`,
            'unknown_track_dialogue_id',
            'Cutscene track references an unknown dialogue.'
          )
        )
      }
    }
  }

  return issues
}

export function validateNarrativeReferences(
  narrative: NarrativeDefinition,
  context: NarrativeReferenceContext
): NarrativeValidationIssue[] {
  const issues: NarrativeValidationIssue[] = []
  const expectedEpisodeIds = toSet(context.episodeIds ?? [])
  const narrativeEpisodeIds = new Set(
    narrative.episodes.map((episode) => episode.id)
  )
  const activityIds = toSet(context.activityIds)
  const learningObjectiveIds = toSet(context.learningObjectiveIds)
  const worldZoneIds = toSet(context.worldZoneIds)
  const sceneIds = toSet(context.sceneIds)
  const interactableIds = toSet(context.interactableIds)
  const characterIds = toSet(context.characterIds)

  if (narrative.questId !== context.questId) {
    issues.push(
      error(
        'questId',
        'narrative_quest_mismatch',
        'Narrative questId must match the quest id.'
      )
    )
  }

  if (expectedEpisodeIds.size === 0 && narrative.episodes.length > 0) {
    issues.push(
      error(
        'episodes',
        'narrative_not_declared_by_quest',
        'Narrative episodes require matching quest.episodeIds.'
      )
    )
  }

  for (const expectedEpisodeId of expectedEpisodeIds) {
    if (!narrativeEpisodeIds.has(expectedEpisodeId)) {
      issues.push(
        error(
          'episodes',
          'quest_episode_missing_from_narrative',
          'Quest declares an episode that is missing from the narrative.'
        )
      )
    }
  }

  for (const episode of narrative.episodes) {
    if (expectedEpisodeIds.size > 0 && !expectedEpisodeIds.has(episode.id)) {
      issues.push(
        error(
          `episodes.${episode.id}`,
          'episode_not_declared_by_quest',
          'Narrative episode is not declared by quest.episodeIds.'
        )
      )
    }

    if (!worldZoneIds.has(episode.worldZoneId)) {
      issues.push(
        error(
          `episodes.${episode.id}.worldZoneId`,
          'unknown_episode_world_zone_id',
          'Episode references an unknown world zone.'
        )
      )
    }

    if (!sceneIds.has(episode.entrySceneId)) {
      issues.push(
        error(
          `episodes.${episode.id}.entrySceneId`,
          'unknown_episode_entry_scene_id',
          'Episode references an unknown entry scene.'
        )
      )
    }

    for (const objectiveId of episode.learningObjectiveIds) {
      if (!learningObjectiveIds.has(objectiveId)) {
        issues.push(
          error(
            `episodes.${episode.id}.learningObjectiveIds`,
            'unknown_episode_learning_objective_id',
            'Episode references an unknown learning objective.'
          )
        )
      }
    }

    for (const beat of episode.beats) {
      issues.push(
        ...validateBeatExternalReferences(beat, {
          path: `episodes.${episode.id}.beats.${beat.id}`,
          activityIds,
          learningObjectiveIds,
          sceneIds,
          interactableIds
        })
      )
    }
  }

  for (const dialogue of narrative.dialogues) {
    if (dialogue.sceneId && !sceneIds.has(dialogue.sceneId)) {
      issues.push(
        error(
          `dialogues.${dialogue.id}.sceneId`,
          'unknown_dialogue_scene_id',
          'Dialogue references an unknown scene.'
        )
      )
    }

    for (const line of dialogue.lines) {
      if (
        line.speakerRole === 'world_character' &&
        !characterIds.has(line.speakerId)
      ) {
        issues.push(
          error(
            `dialogues.${dialogue.id}.lines.${line.id}.speakerId`,
            'unknown_dialogue_speaker_id',
            'Dialogue line references an unknown world character speaker.'
          )
        )
      }
    }
  }

  for (const cutscene of narrative.cutscenes) {
    if (!sceneIds.has(cutscene.sceneId)) {
      issues.push(
        error(
          `cutscenes.${cutscene.id}.sceneId`,
          'unknown_cutscene_scene_id',
          'Cutscene references an unknown scene.'
        )
      )
    }

    for (const objectiveId of cutscene.learningObjectiveIds) {
      if (!learningObjectiveIds.has(objectiveId)) {
        issues.push(
          error(
            `cutscenes.${cutscene.id}.learningObjectiveIds`,
            'unknown_cutscene_learning_objective_id',
            'Cutscene references an unknown learning objective.'
          )
        )
      }
    }

    for (const track of cutscene.tracks) {
      if (track.type === 'activity' && !activityIds.has(track.activityId)) {
        issues.push(
          error(
            `cutscenes.${cutscene.id}.tracks.activityId`,
            'unknown_track_activity_id',
            'Cutscene track references an unknown activity.'
          )
        )
      }

      if (track.type === 'character' && !characterIds.has(track.characterId)) {
        issues.push(
          error(
            `cutscenes.${cutscene.id}.tracks.characterId`,
            'unknown_track_character_id',
            'Cutscene track references an unknown character.'
          )
        )
      }
    }
  }

  return issues
}

export function assertNarrativeReferences(
  narrative: NarrativeDefinition,
  context: NarrativeReferenceContext
): void {
  const issues = validateNarrativeReferences(narrative, context)
  if (issues.some((issue) => issue.severity === 'error')) {
    throw new NarrativeValidationError(issues)
  }
}

function validateBeatRequiredReferences(
  beat: NarrativeBeat,
  path: string
): NarrativeValidationIssue[] {
  const issues: NarrativeValidationIssue[] = []

  if (beat.kind === 'activity' && !beat.activityId) {
    issues.push(
      error(path, 'missing_activity_id', 'Activity beat must reference an activity.')
    )
  }

  if (beat.kind === 'dialogue' && !beat.dialogueId) {
    issues.push(
      error(path, 'missing_dialogue_id', 'Dialogue beat must reference a dialogue.')
    )
  }

  if (beat.kind === 'cutscene' && !beat.cutsceneId) {
    issues.push(
      error(path, 'missing_cutscene_id', 'Cutscene beat must reference a cutscene.')
    )
  }

  if (beat.kind === 'world_interaction' && !beat.interactableId) {
    issues.push(
      error(
        path,
        'missing_interactable_id',
        'World interaction beat must reference an interactable.'
      )
    )
  }

  return issues
}

function validateBeatExternalReferences(
  beat: NarrativeBeat,
  context: {
    path: string
    activityIds: Set<string>
    learningObjectiveIds: Set<string>
    sceneIds: Set<string>
    interactableIds: Set<string>
  }
): NarrativeValidationIssue[] {
  const issues: NarrativeValidationIssue[] = []

  if (beat.sceneId && !context.sceneIds.has(beat.sceneId)) {
    issues.push(
      error(context.path, 'unknown_beat_scene_id', 'Beat references an unknown scene.')
    )
  }

  if (beat.activityId && !context.activityIds.has(beat.activityId)) {
    issues.push(
      error(
        context.path,
        'unknown_beat_activity_id',
        'Beat references an unknown activity.'
      )
    )
  }

  if (beat.interactableId && !context.interactableIds.has(beat.interactableId)) {
    issues.push(
      error(
        context.path,
        'unknown_beat_interactable_id',
        'Beat references an unknown interactable.'
      )
    )
  }

  for (const objectiveId of beat.learningObjectiveIds) {
    if (!context.learningObjectiveIds.has(objectiveId)) {
      issues.push(
        error(
          `${context.path}.learningObjectiveIds`,
          'unknown_beat_learning_objective_id',
          'Beat references an unknown learning objective.'
        )
      )
    }
  }

  for (const rule of Array.isArray(beat.next) ? beat.next : []) {
    if (
      rule.type === 'activity_completed' &&
      !context.activityIds.has(rule.activityId)
    ) {
      issues.push(
        error(
          `${context.path}.next.activityId`,
          'unknown_branch_activity_id',
          'Branch rule references an unknown activity.'
        )
      )
    }
  }

  return issues
}

function getNextBeatIds(next: string | BranchRule[] | undefined) {
  if (!next) return []
  if (typeof next === 'string') return [next]
  return next.map((rule) => rule.nextBeatId)
}

function collectIds<TItem extends { id: string }>(
  items: TItem[],
  path: string,
  duplicateCode: string,
  duplicateMessage: string
) {
  const ids = new Set<string>()
  const issues: NarrativeValidationIssue[] = []

  for (const item of items) {
    if (ids.has(item.id)) {
      issues.push(error(`${path}.${item.id}`, duplicateCode, duplicateMessage))
    }
    ids.add(item.id)
  }

  return { ids, issues }
}

function toSet(values: Iterable<string>) {
  return new Set(values)
}

function error(
  path: string,
  code: string,
  message: string
): NarrativeValidationIssue {
  return { path, code, message, severity: 'error' }
}

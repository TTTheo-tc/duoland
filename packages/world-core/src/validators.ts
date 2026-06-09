import { WorldDefinitionSchema, WorldBindingReferenceSchema } from './schema.ts'
import type { WorldBindingReference, WorldDefinition } from './types.ts'

export interface WorldValidationIssue {
  path: string
  code: string
  message: string
  severity: 'error' | 'warning'
}

export class WorldValidationError extends Error {
  issues: WorldValidationIssue[]

  constructor(issues: WorldValidationIssue[]) {
    super('World semantic validation failed')
    this.issues = issues
  }
}

export function validateWorldDefinition(input: unknown): WorldDefinition {
  const world = WorldDefinitionSchema.parse(input) as WorldDefinition
  const issues = validateWorldSemantics(world)

  if (issues.some((issue) => issue.severity === 'error')) {
    throw new WorldValidationError(issues)
  }

  return world
}

export function validateWorldBindingReference(
  input: unknown,
  world: WorldDefinition
): WorldValidationIssue[] {
  const binding = WorldBindingReferenceSchema.parse(input) as WorldBindingReference
  const issues: WorldValidationIssue[] = []
  const sceneIds = new Set(world.scenes.map((scene) => scene.id))

  if (binding.worldId !== world.id) {
    issues.push(
      error(
        'worldBinding.worldId',
        'unknown_world_id',
        'Quest world binding references a different world id.'
      )
    )
  }

  if (!sceneIds.has(binding.entrySceneId)) {
    issues.push(
      error(
        'worldBinding.entrySceneId',
        'unknown_entry_scene_id',
        'Quest world binding references an unknown entry scene.'
      )
    )
  }

  return issues
}

export function assertWorldBindingReference(
  input: unknown,
  world: WorldDefinition
): void {
  const issues = validateWorldBindingReference(input, world)
  if (issues.some((issue) => issue.severity === 'error')) {
    throw new WorldValidationError(issues)
  }
}

export function validateWorldSemantics(
  world: WorldDefinition
): WorldValidationIssue[] {
  const issues: WorldValidationIssue[] = []
  const zoneIds = collectIds(
    world.zones,
    'zones',
    'duplicate_zone_id',
    'Duplicate zone id.'
  )
  const sceneIds = collectIds(
    world.scenes,
    'scenes',
    'duplicate_scene_id',
    'Duplicate scene id.'
  )
  const characterIds = collectIds(
    world.characters,
    'characters',
    'duplicate_character_id',
    'Duplicate character id.'
  )
  const interactableIds = collectIds(
    world.interactables,
    'interactables',
    'duplicate_interactable_id',
    'Duplicate interactable id.'
  )

  issues.push(
    ...zoneIds.issues,
    ...sceneIds.issues,
    ...characterIds.issues,
    ...interactableIds.issues
  )

  const scenesById = new Map(world.scenes.map((scene) => [scene.id, scene]))
  const interactablesById = new Map(
    world.interactables.map((interactable) => [interactable.id, interactable])
  )

  for (const zone of world.zones) {
    for (const sceneId of zone.sceneIds) {
      const scene = scenesById.get(sceneId)
      if (!scene) {
        issues.push(
          error(
            `zones.${zone.id}.sceneIds`,
            'unknown_zone_scene_id',
            'Zone references an unknown scene.'
          )
        )
      } else if (scene.zoneId !== zone.id) {
        issues.push(
          error(
            `zones.${zone.id}.sceneIds`,
            'scene_zone_mismatch',
            'Zone references a scene that belongs to another zone.'
          )
        )
      }
    }

    for (const rule of zone.unlockWhen ?? []) {
      if (rule.type === 'scene_visited' && !sceneIds.ids.has(rule.sceneId)) {
        issues.push(
          error(
            `zones.${zone.id}.unlockWhen.sceneId`,
            'unknown_unlock_scene_id',
            'Zone unlock rule references an unknown scene.'
          )
        )
      }
    }
  }

  for (const scene of world.scenes) {
    const owningZone = world.zones.find((zone) => zone.id === scene.zoneId)
    if (!owningZone) {
      issues.push(
        error(
          `scenes.${scene.id}.zoneId`,
          'unknown_scene_zone_id',
          'Scene references an unknown zone.'
        )
      )
    } else if (!owningZone.sceneIds.includes(scene.id)) {
      issues.push(
        error(
          `scenes.${scene.id}.zoneId`,
          'scene_missing_from_zone',
          'Scene zone does not include this scene in its sceneIds.'
        )
      )
    }

    for (const placement of scene.characterPlacements) {
      if (!characterIds.ids.has(placement.characterId)) {
        issues.push(
          error(
            `scenes.${scene.id}.characterPlacements`,
            'unknown_character_id',
            'Scene places an unknown character.'
          )
        )
      }
    }

    for (const interactableId of scene.interactableIds) {
      const interactable = interactablesById.get(interactableId)
      if (!interactable) {
        issues.push(
          error(
            `scenes.${scene.id}.interactableIds`,
            'unknown_interactable_id',
            'Scene references an unknown interactable.'
          )
        )
      } else if (interactable.sceneId !== scene.id) {
        issues.push(
          error(
            `scenes.${scene.id}.interactableIds`,
            'interactable_scene_mismatch',
            'Scene references an interactable that belongs to another scene.'
          )
        )
      }
    }
  }

  for (const interactable of world.interactables) {
    const owningScene = scenesById.get(interactable.sceneId)
    if (!owningScene) {
      issues.push(
        error(
          `interactables.${interactable.id}.sceneId`,
          'unknown_interactable_scene_id',
          'Interactable references an unknown scene.'
        )
      )
    } else if (!owningScene.interactableIds.includes(interactable.id)) {
      issues.push(
        error(
          `interactables.${interactable.id}.sceneId`,
          'interactable_missing_from_scene',
          'Interactable scene does not include this interactable in its interactableIds.'
        )
      )
    }

    if (interactable.type === 'npc') {
      if (!interactable.characterId) {
        issues.push(
          error(
            `interactables.${interactable.id}.characterId`,
            'missing_npc_character_id',
            'NPC interactables must explicitly reference a character.'
          )
        )
      } else if (!characterIds.ids.has(interactable.characterId)) {
        issues.push(
          error(
            `interactables.${interactable.id}.characterId`,
            'unknown_npc_character_id',
            'NPC interactable references an unknown character.'
          )
        )
      } else if (
        owningScene &&
        !owningScene.characterPlacements.some(
          (placement) => placement.characterId === interactable.characterId
        )
      ) {
        issues.push(
          error(
            `interactables.${interactable.id}.characterId`,
            'npc_character_missing_from_scene',
            'NPC interactable references a character that is not placed in its scene.'
          )
        )
      }
    } else if (interactable.characterId) {
      issues.push(
        error(
          `interactables.${interactable.id}.characterId`,
          'unexpected_interactable_character_id',
          'Only NPC interactables may reference a character.'
        )
      )
    }

    for (const action of interactable.onInteract) {
      if (action.type === 'transition_scene' && !sceneIds.ids.has(action.sceneId)) {
        issues.push(
          error(
            `interactables.${interactable.id}.onInteract.sceneId`,
            'unknown_transition_scene_id',
            'World action transitions to an unknown scene.'
          )
        )
      }
    }
  }

  return issues
}

function collectIds<TItem extends { id: string }>(
  items: TItem[],
  path: string,
  duplicateCode: string,
  duplicateMessage: string
) {
  const ids = new Set<string>()
  const issues: WorldValidationIssue[] = []

  for (const item of items) {
    if (ids.has(item.id)) {
      issues.push(error(`${path}.${item.id}`, duplicateCode, duplicateMessage))
    }
    ids.add(item.id)
  }

  return { ids, issues }
}

function error(
  path: string,
  code: string,
  message: string
): WorldValidationIssue {
  return { path, code, message, severity: 'error' }
}

import {
  validateWorldRendererToRuntimeEvent,
  type WorldRendererToRuntimeEvent
} from '@sel-quest/world-core'

export function createInteractableClickedEvent(
  interactableId: string
): WorldRendererToRuntimeEvent {
  return validateWorldRendererToRuntimeEvent({
    type: 'INTERACTABLE_CLICKED',
    interactableId
  })
}

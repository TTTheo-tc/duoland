import { describe, expect, it } from 'vitest'
import { createInteractableClickedEvent } from './events'

describe('renderer-r3f world events', () => {
  it('creates schema-validated interactable click events', () => {
    expect(createInteractableClickedEvent('xiaoyu_npc')).toEqual({
      type: 'INTERACTABLE_CLICKED',
      interactableId: 'xiaoyu_npc'
    })
  })

  it('rejects empty interactable ids', () => {
    expect(() => createInteractableClickedEvent('')).toThrow()
  })
})

import type { AgeBand } from '@sel-quest/quest-core'

export type SafetyRiskLevel = 'none' | 'mild' | 'needs_adult_attention' | 'crisis'

export interface SafetyCheckResult {
  allowed: boolean
  riskLevel: SafetyRiskLevel
  reason?: string
  recommendedAction?:
    | 'continue'
    | 'show_support_message'
    | 'notify_guardian'
    | 'stop_activity'
}

export interface InputGuard {
  check(input: {
    text?: string
    activityId?: string
    questId?: string
    ageBand?: AgeBand
  }): Promise<SafetyCheckResult>
}

export class StructuredOnlyInputGuard implements InputGuard {
  check(input: { text?: string }): Promise<SafetyCheckResult> {
    if (!input.text) {
      return Promise.resolve({
        allowed: true,
        riskLevel: 'none',
        recommendedAction: 'continue'
      })
    }

    return Promise.resolve({
      allowed: false,
      riskLevel: 'mild',
      reason: 'MVP does not accept free-text child input.',
      recommendedAction: 'stop_activity'
    })
  }
}

export const childSafetyBoundaryText =
  '这个任务会帮你练习认识和表达心情。它不是医生或心理咨询师。如果你现在很害怕、很危险，或有人伤害你，请马上告诉身边可信赖的大人。'

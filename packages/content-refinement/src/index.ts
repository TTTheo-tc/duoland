import type { QuestDefinition } from '@sel-quest/quest-core'
import type {
  ContentIssue,
  ContentValidationReport
} from '@sel-quest/review-core'

export interface ContentRefinementRequest {
  quest: QuestDefinition
  validationReport: ContentValidationReport
  targetIssues?: ContentIssue[]
  reviewerNotes?: string[]
}

export interface ContentRefinementResult {
  quest: QuestDefinition
  resolvedIssueIds: string[]
  unresolvedIssueIds: string[]
  revisionNotes: string[]
}

export interface ContentRefiner {
  refineQuest(input: ContentRefinementRequest): Promise<ContentRefinementResult>
}

export class DisabledContentRefiner implements ContentRefiner {
  refineQuest(): Promise<never> {
    return Promise.reject(
      new Error('AI content refinement is disabled until a refinement service is injected.')
    )
  }
}

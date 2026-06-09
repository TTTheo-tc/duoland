import type { QuestDefinition } from '@sel-quest/quest-core'
import type {
  ContentIssue,
  ContentIssueSeverity,
  ContentRevisionPacket,
  ExpertReviewerRole,
  SelContentIssueType
} from '@sel-quest/review-core'
import { createContentHash } from '@sel-quest/review-core'

export type ContentRefinementTargetSource =
  | 'validation_issue'
  | 'expert_follow_up'

export type ContentRefinementPriority = 'critical' | 'high' | 'normal' | 'low'

export type ContentRefinementPlanStatus =
  | 'no_changes_needed'
  | 'needs_refinement'

export interface ContentRefinementTarget {
  id: string
  source: ContentRefinementTargetSource
  priority: ContentRefinementPriority
  instruction: string
  blocksPublishing: boolean
  location?: ContentIssue['location']
  issueId?: string
  issueType?: SelContentIssueType
  issueSeverity?: ContentIssueSeverity
  explanation?: string
  suggestedFix?: string
  reviewId?: string
  reviewerRole?: ExpertReviewerRole
  followUpIndex?: number
}

export interface ContentRefinementPlan {
  id: string
  contentItemId: string
  contentVersion: string
  contentHash: string
  generatedAt: string
  source: ContentRevisionPacket['source']
  status: ContentRefinementPlanStatus
  targetCount: number
  targets: ContentRefinementTarget[]
  constraints: string[]
  requiredPostRefinementEvidence: Array<'validation_report' | 'expert_review'>
}

export interface ContentRefinementRequest {
  quest: QuestDefinition
  revisionPacket: ContentRevisionPacket
  plan: ContentRefinementPlan
}

export interface ContentRefinementResult {
  candidateQuest: QuestDefinition
  planId: string
  resolvedTargetIds: string[]
  unresolvedTargetIds: string[]
  revisionNotes: string[]
  requiresValidation: true
  requiresExpertReview: true
}

export interface ValidateContentRefinementResultOptions {
  plan?: ContentRefinementPlan
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

export function createContentRefinementPlan(input: {
  revisionPacket: ContentRevisionPacket
  now?: () => string
  planId?: string
}): ContentRefinementPlan {
  validateContentRevisionPacketIntegrity(input.revisionPacket)

  const generatedAt = input.now?.() ?? new Date().toISOString()
  const targets = [
    ...input.revisionPacket.validation.issues.map(createValidationIssueTarget),
    ...input.revisionPacket.expertFollowUps.flatMap(createExpertFollowUpTargets)
  ].sort(compareRefinementTargets)

  return {
    id:
      input.planId ??
      `refinement_plan_${input.revisionPacket.contentItemId}_${input.revisionPacket.contentVersion}_${compactTimestamp(generatedAt)}`,
    contentItemId: input.revisionPacket.contentItemId,
    contentVersion: input.revisionPacket.contentVersion,
    contentHash: input.revisionPacket.contentHash,
    generatedAt,
    source: input.revisionPacket.source,
    status: targets.length > 0 ? 'needs_refinement' : 'no_changes_needed',
    targetCount: targets.length,
    targets,
    constraints: uniqueStrings(input.revisionPacket.refinementConstraints),
    requiredPostRefinementEvidence: ['validation_report', 'expert_review']
  }
}

export function createContentRefinementRequest(input: {
  quest: QuestDefinition
  revisionPacket: ContentRevisionPacket
  now?: () => string
  planId?: string
}): ContentRefinementRequest {
  assertRevisionPacketMatchesQuest(input.quest, input.revisionPacket)

  return {
    quest: input.quest,
    revisionPacket: input.revisionPacket,
    plan: createContentRefinementPlan({
      revisionPacket: input.revisionPacket,
      now: input.now,
      planId: input.planId
    })
  }
}

export function validateContentRefinementResult(
  result: ContentRefinementResult,
  options: ValidateContentRefinementResultOptions = {}
): ContentRefinementResult {
  if (result.candidateQuest.status === 'published') {
    throw new Error('Refined candidate content must not mark itself published.')
  }

  if (result.requiresValidation !== true) {
    throw new Error('Refined candidate content must require validation evidence.')
  }

  if (result.requiresExpertReview !== true) {
    throw new Error('Refined candidate content must require expert review.')
  }

  assertNoDuplicateTargetIds(result.resolvedTargetIds, 'resolvedTargetIds')
  assertNoDuplicateTargetIds(result.unresolvedTargetIds, 'unresolvedTargetIds')
  assertTargetSetsDoNotOverlap(result.resolvedTargetIds, result.unresolvedTargetIds)

  if (options.plan) {
    assertRefinementResultMatchesPlan(result, options.plan)
  }

  return result
}

export function validatePlannedContentRefinementResult(
  result: ContentRefinementResult,
  plan: ContentRefinementPlan
): ContentRefinementResult {
  return validateContentRefinementResult(result, { plan })
}

export function validateContentRevisionPacketIntegrity(
  packet: ContentRevisionPacket
): ContentRevisionPacket {
  const expectedSource = deriveRevisionPacketSource(
    packet.validation.issues.length,
    packet.expertFollowUps.length
  )
  const expectedTargetCount =
    packet.validation.issues.length +
    packet.expertFollowUps.reduce(
      (count, followUp) => count + createExpertFollowUpTargetIds(followUp).length,
      0
    )

  if (packet.source !== expectedSource) {
    throw new Error(
      `Revision packet source is ${packet.source}, expected ${expectedSource}.`
    )
  }

  if (packet.revisionTargetCount !== expectedTargetCount) {
    throw new Error(
      `Revision packet target count is ${packet.revisionTargetCount}, expected ${expectedTargetCount}.`
    )
  }

  for (const issue of packet.validation.issues) {
    if (issue.location.questId !== packet.contentItemId) {
      throw new Error(
        `Revision packet issue ${issue.id} does not target content item ${packet.contentItemId}.`
      )
    }
  }

  for (const followUp of packet.expertFollowUps) {
    if (followUp.decision === 'approved' && followUp.requiredFollowUps.length === 0) {
      throw new Error(
        `Revision packet expert follow-up ${followUp.reviewId} has no required follow-ups.`
      )
    }
  }

  const targetIds = [
    ...packet.validation.issues.map((issue) => `validation:${issue.id}`),
    ...packet.expertFollowUps.flatMap((followUp) =>
      createExpertFollowUpTargetIds(followUp)
    )
  ]
  const duplicateTargetId = findDuplicate(targetIds)

  if (duplicateTargetId) {
    throw new Error(
      `Revision packet would create duplicate refinement target ${duplicateTargetId}.`
    )
  }

  return packet
}

export function assertRevisionPacketMatchesQuest(
  quest: QuestDefinition,
  packet: ContentRevisionPacket
) {
  validateContentRevisionPacketIntegrity(packet)

  const contentHash = createQuestContentHash(quest)

  if (packet.contentItemId !== quest.id) {
    throw new Error('Revision packet content id does not match quest id.')
  }

  if (packet.contentVersion !== quest.version) {
    throw new Error('Revision packet content version does not match quest version.')
  }

  if (packet.contentHash !== contentHash) {
    throw new Error('Revision packet content hash does not match quest content hash.')
  }
}

export function createQuestContentHash(quest: QuestDefinition) {
  return createContentHash(quest, { omitTopLevelKeys: ['status'] })
}

function createValidationIssueTarget(issue: ContentIssue): ContentRefinementTarget {
  return {
    id: `validation:${issue.id}`,
    source: 'validation_issue',
    priority: priorityForIssue(issue),
    instruction: issue.suggestedFix ?? issue.explanation,
    blocksPublishing: issue.blocksPublishing,
    location: issue.location,
    issueId: issue.id,
    issueType: issue.type,
    issueSeverity: issue.severity,
    explanation: issue.explanation,
    suggestedFix: issue.suggestedFix
  }
}

function createExpertFollowUpTargets(
  followUp: ContentRevisionPacket['expertFollowUps'][number]
): ContentRefinementTarget[] {
  if (followUp.requiredFollowUps.length === 0 && followUp.decision === 'approved') {
    return []
  }

  const instructions =
    followUp.requiredFollowUps.length > 0
      ? followUp.requiredFollowUps
      : [fallbackExpertInstruction(followUp)]

  return instructions.map((instruction, index) => ({
    id:
      followUp.requiredFollowUps.length > 0
        ? `expert:${followUp.reviewId}:${index + 1}`
        : `expert:${followUp.reviewId}:decision`,
    source: 'expert_follow_up',
    priority: followUp.decision === 'rejected' ? 'critical' : 'high',
    instruction,
    blocksPublishing: true,
    reviewId: followUp.reviewId,
    reviewerRole: followUp.reviewer.role,
    followUpIndex: index
  }))
}

function createExpertFollowUpTargetIds(
  followUp: ContentRevisionPacket['expertFollowUps'][number]
) {
  if (followUp.requiredFollowUps.length === 0 && followUp.decision === 'approved') {
    return []
  }

  if (followUp.requiredFollowUps.length === 0) {
    return [`expert:${followUp.reviewId}:decision`]
  }

  return followUp.requiredFollowUps.map(
    (_instruction, index) => `expert:${followUp.reviewId}:${index + 1}`
  )
}

function fallbackExpertInstruction(
  followUp: ContentRevisionPacket['expertFollowUps'][number]
) {
  const notes = followUp.notes.length > 0 ? ` Notes: ${followUp.notes.join(' ')}` : ''

  return `Resolve expert review ${followUp.reviewId} (${followUp.decision}) before approval.${notes}`
}

function priorityForIssue(issue: ContentIssue): ContentRefinementPriority {
  if (issue.severity === 'critical') return 'critical'
  if (issue.severity === 'major' || issue.blocksPublishing) return 'high'
  if (issue.severity === 'minor') return 'normal'
  return 'low'
}

function compareRefinementTargets(
  left: ContentRefinementTarget,
  right: ContentRefinementTarget
) {
  const priorityDiff =
    priorityWeight(right.priority) - priorityWeight(left.priority)
  if (priorityDiff !== 0) return priorityDiff

  if (left.source !== right.source) {
    return left.source === 'validation_issue' ? -1 : 1
  }

  return left.id.localeCompare(right.id)
}

function priorityWeight(priority: ContentRefinementPriority) {
  switch (priority) {
    case 'critical':
      return 4
    case 'high':
      return 3
    case 'normal':
      return 2
    case 'low':
      return 1
  }
}

function uniqueStrings(values: string[]) {
  return [...new Set(values)]
}

function assertRefinementResultMatchesPlan(
  result: ContentRefinementResult,
  plan: ContentRefinementPlan
) {
  if (result.planId !== plan.id) {
    throw new Error('Refinement result plan id does not match the refinement plan.')
  }

  if (result.candidateQuest.id !== plan.contentItemId) {
    throw new Error(
      'Refinement result candidate quest id does not match the refinement plan.'
    )
  }

  if (result.candidateQuest.version !== plan.contentVersion) {
    throw new Error(
      'Refinement result candidate quest version does not match the refinement plan.'
    )
  }

  const knownTargetIds = new Set(plan.targets.map((target) => target.id))
  const accountedTargetIds = new Set([
    ...result.resolvedTargetIds,
    ...result.unresolvedTargetIds
  ])

  for (const targetId of accountedTargetIds) {
    if (!knownTargetIds.has(targetId)) {
      throw new Error(`Refinement result references unknown target ${targetId}.`)
    }
  }

  for (const targetId of knownTargetIds) {
    if (!accountedTargetIds.has(targetId)) {
      throw new Error('Refinement result must account for every plan target.')
    }
  }
}

function assertNoDuplicateTargetIds(values: string[], fieldName: string) {
  if (findDuplicate(values)) {
    throw new Error(`Refinement result ${fieldName} contains duplicate targets.`)
  }
}

function assertTargetSetsDoNotOverlap(left: string[], right: string[]) {
  const rightTargets = new Set(right)
  const overlap = left.find((targetId) => rightTargets.has(targetId))

  if (overlap) {
    throw new Error(
      `Refinement result cannot mark target ${overlap} both resolved and unresolved.`
    )
  }
}

function deriveRevisionPacketSource(
  issueCount: number,
  expertFollowUpCount: number
): ContentRevisionPacket['source'] {
  if (issueCount > 0 && expertFollowUpCount > 0) return 'mixed'
  if (issueCount > 0) return 'validation'
  if (expertFollowUpCount > 0) return 'expert_review'
  return 'none'
}

function findDuplicate(values: string[]) {
  const seen = new Set<string>()

  for (const value of values) {
    if (seen.has(value)) return value
    seen.add(value)
  }

  return null
}

function compactTimestamp(value: string) {
  return value.replace(/\W/g, '')
}

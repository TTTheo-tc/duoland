import type { QuestDefinition } from '@sel-quest/quest-core'
import type { ContentRevisionPacket } from '@sel-quest/review-core'
import { validateContentRevisionPacket } from '@sel-quest/review-core'
import { describe, expect, it } from 'vitest'
import {
  DisabledContentRefiner,
  assertRevisionPacketMatchesQuest,
  createContentRefinementPlan,
  createContentRefinementRequest,
  createQuestContentHash,
  validatePlannedContentRefinementResult,
  validateContentRevisionPacketIntegrity,
  validateContentRefinementResult
} from './index'

describe('content refinement planning', () => {
  it('creates a no-op plan for a clean revision packet', () => {
    const packet = createRevisionPacket()

    const plan = createContentRefinementPlan({
      revisionPacket: packet,
      now: () => '2026-06-09T00:00:00.000Z'
    })

    expect(plan).toMatchObject({
      id: 'refinement_plan_test-quest_0.1.0_20260609T000000000Z',
      contentItemId: 'test-quest',
      contentVersion: '0.1.0',
      source: 'none',
      status: 'no_changes_needed',
      targetCount: 0,
      requiredPostRefinementEvidence: ['validation_report', 'expert_review']
    })
    expect(plan.targets).toEqual([])
  })

  it('turns validation issues into prioritized refinement targets', () => {
    const packet = createRevisionPacket({
      source: 'validation',
      validationIssues: [
        {
          id: 'issue_minor_001',
          severity: 'minor',
          type: 'ambiguous_scenario',
          location: {
            questId: testQuest.id,
            activityId: 'emotion_001',
            fieldPath: 'activities.emotion_001.config.correctEmotionIds'
          },
          explanation: 'Use acceptableEmotionIds for emotion-card activities.',
          suggestedFix: 'Rename correctEmotionIds to acceptableEmotionIds.',
          blocksPublishing: false
        },
        {
          id: 'issue_critical_001',
          severity: 'critical',
          type: 'no_safe_response_option',
          location: {
            questId: testQuest.id,
            activityId: 'scenario_001',
            fieldPath: 'activities.scenario_001.config.choices'
          },
          explanation: 'Scenario-choice activities need a safe response option.',
          suggestedFix: 'Add at least one recommended supportive response.',
          blocksPublishing: true
        }
      ]
    })

    const plan = createContentRefinementPlan({
      revisionPacket: packet,
      now: () => '2026-06-09T00:00:00.000Z'
    })

    expect(plan.status).toBe('needs_refinement')
    expect(plan.targets.map((target) => target.id)).toEqual([
      'validation:issue_critical_001',
      'validation:issue_minor_001'
    ])
    expect(plan.targets[0]).toMatchObject({
      priority: 'critical',
      issueType: 'no_safe_response_option',
      instruction: 'Add at least one recommended supportive response.',
      blocksPublishing: true
    })
    expect(plan.targets[1]).toMatchObject({
      priority: 'normal',
      blocksPublishing: false
    })
  })

  it('turns expert follow-ups into blocking refinement targets', () => {
    const packet = createRevisionPacket({
      source: 'expert_review',
      expertFollowUps: [
        {
          reviewId: 'review_changes_001',
          reviewer: {
            id: 'reviewer_001',
            displayName: 'School counselor',
            role: 'school_mental_health_teacher'
          },
          decision: 'changes_requested',
          notes: ['Feedback needs to validate the feeling first.'],
          requiredFollowUps: [
            'Revise scenario feedback option B before approval.'
          ]
        }
      ]
    })

    const plan = createContentRefinementPlan({
      revisionPacket: packet,
      now: () => '2026-06-09T00:00:00.000Z'
    })

    expect(plan.status).toBe('needs_refinement')
    expect(plan.targets).toHaveLength(1)
    expect(plan.targets[0]).toMatchObject({
      id: 'expert:review_changes_001:1',
      source: 'expert_follow_up',
      priority: 'high',
      reviewerRole: 'school_mental_health_teacher',
      instruction: 'Revise scenario feedback option B before approval.',
      blocksPublishing: true
    })
  })

  it('creates fallback targets for blocking expert decisions without follow-up text', () => {
    const packet = createRevisionPacket({
      source: 'expert_review',
      expertFollowUps: [
        {
          reviewId: 'review_rejected_001',
          reviewer: {
            id: 'reviewer_001',
            displayName: 'Safety reviewer',
            role: 'safety_reviewer'
          },
          decision: 'rejected',
          notes: ['The child-facing feedback is not safe enough.'],
          requiredFollowUps: []
        }
      ]
    })

    const plan = createContentRefinementPlan({
      revisionPacket: packet,
      now: () => '2026-06-09T00:00:00.000Z'
    })

    expect(packet.revisionTargetCount).toBe(1)
    expect(plan.status).toBe('needs_refinement')
    expect(plan.targetCount).toBe(1)
    expect(plan.targets[0]).toMatchObject({
      id: 'expert:review_rejected_001:decision',
      source: 'expert_follow_up',
      priority: 'critical',
      blocksPublishing: true
    })
    expect(plan.targets[0].instruction).toContain(
      'Resolve expert review review_rejected_001 (rejected) before approval.'
    )
  })

  it('creates refinement requests only when revision evidence matches the quest', () => {
    const packet = createRevisionPacket()

    const request = createContentRefinementRequest({
      quest: testQuest,
      revisionPacket: packet,
      now: () => '2026-06-09T00:00:00.000Z'
    })

    expect(request.plan.contentHash).toBe(createQuestContentHash(testQuest))
    expect(request.revisionPacket.id).toBe(packet.id)

    expect(() =>
      createContentRefinementRequest({
        quest: {
          ...testQuest,
          description: 'Changed after revision packet generation.'
        },
        revisionPacket: packet
      })
    ).toThrow('Revision packet content hash does not match quest content hash.')
  })

  it('rejects refinement results that try to bypass validation or review gates', () => {
    expect(() =>
      validateContentRefinementResult({
        candidateQuest: {
          ...testQuest,
          status: 'published'
        },
        planId: 'plan_001',
        resolvedTargetIds: [],
        unresolvedTargetIds: [],
        revisionNotes: ['Changed copy.'],
        requiresValidation: true,
        requiresExpertReview: true
      })
    ).toThrow('Refined candidate content must not mark itself published.')

    expect(() =>
      validateContentRefinementResult({
        candidateQuest: testQuest,
        planId: 'plan_001',
        resolvedTargetIds: [],
        unresolvedTargetIds: [],
        revisionNotes: ['Changed copy.'],
        requiresValidation: false,
        requiresExpertReview: true
      } as never)
    ).toThrow('Refined candidate content must require validation evidence.')
  })

  it('anchors refinement results to their source plan', () => {
    const packet = createRevisionPacket({
      source: 'validation',
      validationIssues: [
        {
          id: 'issue_critical_001',
          severity: 'critical',
          type: 'no_safe_response_option',
          location: {
            questId: testQuest.id,
            activityId: 'scenario_001',
            fieldPath: 'activities.scenario_001.config.choices'
          },
          explanation: 'Scenario-choice activities need a safe response option.',
          suggestedFix: 'Add at least one recommended supportive response.',
          blocksPublishing: true
        }
      ]
    })
    const request = createContentRefinementRequest({
      quest: testQuest,
      revisionPacket: packet,
      now: () => '2026-06-09T00:00:00.000Z'
    })

    expect(
      validatePlannedContentRefinementResult(
        {
          candidateQuest: testQuest,
          planId: request.plan.id,
          resolvedTargetIds: ['validation:issue_critical_001'],
          unresolvedTargetIds: [],
          revisionNotes: ['Added a supportive response.'],
          requiresValidation: true,
          requiresExpertReview: true
        },
        request.plan
      ).planId
    ).toBe(request.plan.id)

    expect(() =>
      validateContentRefinementResult(
        {
          candidateQuest: testQuest,
          planId: request.plan.id,
          resolvedTargetIds: [],
          unresolvedTargetIds: [],
          revisionNotes: ['Skipped the target.'],
          requiresValidation: true,
          requiresExpertReview: true
        },
        { plan: request.plan }
      )
    ).toThrow('Refinement result must account for every plan target.')

    expect(() =>
      validateContentRefinementResult(
        {
          candidateQuest: testQuest,
          planId: request.plan.id,
          resolvedTargetIds: ['validation:issue_critical_001', 'unknown'],
          unresolvedTargetIds: [],
          revisionNotes: ['Added a supportive response.'],
          requiresValidation: true,
          requiresExpertReview: true
        },
        { plan: request.plan }
      )
    ).toThrow('Refinement result references unknown target unknown.')

    expect(() =>
      validateContentRefinementResult(
        {
          candidateQuest: testQuest,
          planId: 'different_plan',
          resolvedTargetIds: ['validation:issue_critical_001'],
          unresolvedTargetIds: [],
          revisionNotes: ['Added a supportive response.'],
          requiresValidation: true,
          requiresExpertReview: true
        },
        { plan: request.plan }
      )
    ).toThrow('Refinement result plan id does not match the refinement plan.')
  })

  it('rejects duplicate or overlapping refinement result target ids', () => {
    expect(() =>
      validateContentRefinementResult({
        candidateQuest: testQuest,
        planId: 'plan_001',
        resolvedTargetIds: ['target_001', 'target_001'],
        unresolvedTargetIds: [],
        revisionNotes: ['Changed copy.'],
        requiresValidation: true,
        requiresExpertReview: true
      })
    ).toThrow('Refinement result resolvedTargetIds contains duplicate targets.')

    expect(() =>
      validateContentRefinementResult({
        candidateQuest: testQuest,
        planId: 'plan_001',
        resolvedTargetIds: ['target_001'],
        unresolvedTargetIds: ['target_001'],
        revisionNotes: ['Changed copy.'],
        requiresValidation: true,
        requiresExpertReview: true
      })
    ).toThrow(
      'Refinement result cannot mark target target_001 both resolved and unresolved.'
    )
  })

  it('validates revision packet integrity before planning', () => {
    expect(() =>
      validateContentRevisionPacketIntegrity({
        ...createRevisionPacket({
          source: 'validation',
          validationIssues: [
            {
              id: 'issue_critical_001',
              severity: 'critical',
              type: 'no_safe_response_option',
              location: {
                questId: testQuest.id,
                activityId: 'scenario_001',
                fieldPath: 'activities.scenario_001.config.choices'
              },
              explanation:
                'Scenario-choice activities need a safe response option.',
              suggestedFix: 'Add at least one recommended supportive response.',
              blocksPublishing: true
            }
          ]
        }),
        revisionTargetCount: 0
      })
    ).toThrow('Revision packet target count is 0, expected 1.')

    expect(() =>
      createContentRefinementPlan({
        revisionPacket: {
          ...createRevisionPacket({
            source: 'validation',
            validationIssues: [
              {
                id: 'issue_critical_001',
                severity: 'critical',
                type: 'no_safe_response_option',
                location: {
                  questId: testQuest.id,
                  activityId: 'scenario_001',
                  fieldPath: 'activities.scenario_001.config.choices'
                },
                explanation:
                  'Scenario-choice activities need a safe response option.',
                suggestedFix:
                  'Add at least one recommended supportive response.',
                blocksPublishing: true
              }
            ]
          }),
          source: 'none'
        }
      })
    ).toThrow('Revision packet source is none, expected validation.')

    expect(() =>
      validateContentRevisionPacketIntegrity(
        createRevisionPacket({
          source: 'validation',
          validationIssues: [
            {
              id: 'issue_other_quest_001',
              severity: 'critical',
              type: 'no_safe_response_option',
              location: {
                questId: 'other-quest',
                activityId: 'scenario_001',
                fieldPath: 'activities.scenario_001.config.choices'
              },
              explanation:
                'Scenario-choice activities need a safe response option.',
              suggestedFix: 'Add at least one recommended supportive response.',
              blocksPublishing: true
            }
          ]
        })
      )
    ).toThrow(
      'Revision packet issue issue_other_quest_001 does not target content item test-quest.'
    )

    expect(() =>
      validateContentRevisionPacketIntegrity(
        createRevisionPacket({
          source: 'expert_review',
          expertFollowUps: [
            {
              reviewId: 'review_approved_empty_001',
              reviewer: {
                id: 'reviewer_001',
                role: 'sel_curriculum_designer'
              },
              decision: 'approved',
              notes: [],
              requiredFollowUps: []
            }
          ]
        })
      )
    ).toThrow(
      'Revision packet expert follow-up review_approved_empty_001 has no required follow-ups.'
    )

    expect(() =>
      createContentRefinementPlan({
        revisionPacket: createRevisionPacket({
          source: 'validation',
          validationIssues: [
            {
              id: 'issue_duplicate_001',
              severity: 'critical',
              type: 'no_safe_response_option',
              location: {
                questId: testQuest.id,
                activityId: 'scenario_001',
                fieldPath: 'activities.scenario_001.config.choices'
              },
              explanation:
                'Scenario-choice activities need a safe response option.',
              suggestedFix: 'Add at least one recommended supportive response.',
              blocksPublishing: true
            },
            {
              id: 'issue_duplicate_001',
              severity: 'major',
              type: 'ambiguous_scenario',
              location: {
                questId: testQuest.id,
                activityId: 'scenario_002',
                fieldPath: 'activities.scenario_002.config.prompt'
              },
              explanation: 'Scenario wording is ambiguous.',
              suggestedFix: 'Clarify the scenario.',
              blocksPublishing: true
            }
          ]
        })
      })
    ).toThrow(
      'Revision packet would create duplicate refinement target validation:issue_duplicate_001.'
    )
  })

  it('keeps the default refiner disabled until a service is injected', async () => {
    const refiner = new DisabledContentRefiner()
    const packet = createRevisionPacket()
    const request = createContentRefinementRequest({
      quest: testQuest,
      revisionPacket: packet
    })

    await expect(refiner.refineQuest(request)).rejects.toThrow(
      'AI content refinement is disabled until a refinement service is injected.'
    )
  })

  it('reports explicit revision packet mismatch reasons', () => {
    expect(() =>
      assertRevisionPacketMatchesQuest(testQuest, {
        ...createRevisionPacket(),
        contentItemId: 'different-quest'
      })
    ).toThrow('Revision packet content id does not match quest id.')

    expect(() =>
      assertRevisionPacketMatchesQuest(testQuest, {
        ...createRevisionPacket(),
        contentVersion: '9.9.9'
      })
    ).toThrow('Revision packet content version does not match quest version.')
  })
})

const testQuest: QuestDefinition = {
  id: 'test-quest',
  slug: 'test-quest',
  version: '0.1.0',
  status: 'draft',
  title: 'Emotion Detective',
  description: 'Practice noticing character emotions through a short story.',
  domain: 'sel',
  ageBand: '6-8',
  estimatedMinutes: 8,
  learningObjectives: [
    {
      id: 'lo_emotion_recognition',
      title: 'Name common emotions',
      childFacingText: 'I can name how a character may feel.',
      selCompetencies: ['self_awareness'],
      safe: {
        sequenced: true,
        active: true,
        focused: true,
        explicit: true
      }
    }
  ],
  safety: {
    dataSensitivity: 'low',
    allowsFreeTextInput: false,
    requiresGuardianConsent: false,
    crisisHandlingRequired: false
  },
  guardianSummary: {
    title: 'Emotion Detective',
    description: 'Children practice naming emotions in a fictional scene.',
    whatChildWillPractice: ['Recognizing emotions'],
    whatDataIsCollected: ['Structured activity choices']
  },
  teacherGuide: {
    objective: 'Help students name emotions before choosing a response.',
    discussionPrompts: ['What clues helped you notice the feeling?'],
    classroomTips: ['Keep discussion fictional and non-identifying.']
  },
  stages: [
    {
      id: 'intro',
      title: 'Meet the character',
      type: 'intro',
      next: 'emotion'
    }
  ],
  activities: [
    {
      id: 'emotion_001',
      kind: 'emotion-card',
      title: 'Choose an emotion',
      learningObjectiveIds: ['lo_emotion_recognition'],
      config: {
        acceptableEmotionIds: ['sad']
      },
      completion: { type: 'user_submit' },
      safety: { allowsFreeTextInput: false }
    }
  ],
  assets: []
}

function createRevisionPacket(input: {
  source?: ContentRevisionPacket['source']
  validationIssues?: ContentRevisionPacket['validation']['issues']
  expertFollowUps?: ContentRevisionPacket['expertFollowUps']
} = {}): ContentRevisionPacket {
  const validationIssues = input.validationIssues ?? []
  const expertFollowUps = input.expertFollowUps ?? []

  return validateContentRevisionPacket({
    id: 'revision_packet_test_quest_0_1_0',
    contentItemId: testQuest.id,
    contentVersion: testQuest.version,
    contentHash: createQuestContentHash(testQuest),
    generatedAt: '2026-06-09T00:00:00.000Z',
    source: input.source ?? 'none',
    questSummary: {
      slug: testQuest.slug,
      title: testQuest.title,
      status: testQuest.status,
      ageBand: testQuest.ageBand,
      learningObjectives: testQuest.learningObjectives
    },
    validation: {
      reportId: 'report_test_quest_0_1_0',
      status: validationIssues.length > 0 ? 'blocked' : 'passed',
      summary: {
        overallRisk: validationIssues.length > 0 ? 'critical' : 'low',
        pedagogicalQuality: validationIssues.length > 0 ? 'poor' : 'good',
        ageAppropriateness: 'appropriate',
        safetyDecision: validationIssues.length > 0 ? 'block' : 'allow'
      },
      issues: validationIssues
    },
    expertFollowUps,
    revisionTargetCount:
      validationIssues.length +
      expertFollowUps.reduce(
        (count, followUp) => count + getExpertTargetCount(followUp),
        0
      ),
    refinementConstraints: [
      'Do not publish or mark content approved from a revision packet.',
      'Regenerate validation evidence and obtain expert review after revision.',
      'Regenerate validation evidence and obtain expert review after revision.'
    ]
  })
}

function getExpertTargetCount(
  followUp: ContentRevisionPacket['expertFollowUps'][number]
) {
  if (followUp.requiredFollowUps.length > 0) {
    return followUp.requiredFollowUps.length
  }

  return followUp.decision === 'approved' ? 0 : 1
}

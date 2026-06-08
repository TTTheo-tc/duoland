import type {
  ActivityDefinition,
  QuestDefinition
} from '@sel-quest/quest-core'
import type {
  ContentIssue,
  ContentIssueSeverity,
  ContentValidationReport,
  SelContentIssueType
} from '@sel-quest/review-core'
import { createContentHash } from '@sel-quest/review-core'

export interface ValidateSelQuestContentOptions {
  now?: () => string
  reportId?: string
}

interface TextNode {
  stageId?: string
  activityId?: string
  fieldPath: string
  text: string
}

const selDomains = new Set([
  'sel',
  'mental_health_education',
  'family_school_collaboration'
])

const diagnosticPattern =
  /(抑郁症|焦虑症|心理异常|心理疾病|你有病|诊断|药物治疗|心理治疗|therapy|diagnos|depression|anxiety disorder)/i

const emotionInvalidatingPattern =
  /(不应该(生气|难过|害怕|担心)|别(生气|难过|哭|害怕)|这没什么|没什么好|太脆弱|矫情)/

const privacyPromptPattern =
  /(真实姓名|家庭住址|电话号码|身份证|学校全名|父母收入)/

export function validateSelQuestContent(
  quest: QuestDefinition,
  options: ValidateSelQuestContentOptions = {}
): ContentValidationReport {
  const now = options.now ?? (() => new Date().toISOString())
  const createdAt = now()
  const issues: ContentIssue[] = []

  issues.push(...validateLearningObjectives(quest))
  issues.push(...validateSafetyBoundary(quest))
  issues.push(...validateGuardianTeacherAlignment(quest))
  issues.push(...validateActivities(quest))
  issues.push(...validateTextSafety(quest))

  const status = deriveStatus(issues)
  const risk = deriveRisk(issues)

  return {
    id: options.reportId ?? `report_${quest.id}_${quest.version}`,
    contentItemId: quest.id,
    contentVersion: quest.version,
    contentHash: createContentHash(quest, { omitTopLevelKeys: ['status'] }),
    status,
    validators: [
      {
        id: `run_${quest.id}_${quest.version}_rules`,
        validatorId: 'rule.sel_content_baseline',
        validatorType: 'rule',
        status:
          status === 'passed'
            ? 'passed'
            : status === 'blocked'
              ? 'failed'
              : 'flagged',
        startedAt: createdAt,
        completedAt: createdAt,
        summary:
          issues.length === 0
            ? 'Rule-based SEL content validation passed.'
            : `Rule-based SEL content validation found ${issues.length} issue(s).`
      }
    ],
    issues: issues.map((issue, index) => ({
      ...issue,
      id: issue.id || `issue_${String(index + 1).padStart(3, '0')}`
    })),
    summary: {
      overallRisk: risk,
      pedagogicalQuality: issues.some((issue) => issue.severity === 'critical')
        ? 'poor'
        : issues.some((issue) => issue.severity === 'major')
          ? 'acceptable'
          : 'good',
      ageAppropriateness: issues.some(
        (issue) => issue.type === 'developmentally_inappropriate'
      )
        ? 'not_appropriate'
        : 'appropriate',
      safetyDecision:
        status === 'passed' ? 'allow' : status === 'blocked' ? 'block' : 'revise'
    },
    createdAt
  }
}

export const validateQuestContent = validateSelQuestContent

function validateLearningObjectives(quest: QuestDefinition): ContentIssue[] {
  if (!selDomains.has(quest.domain)) return []

  const hasObjective = quest.learningObjectives.some(
    (objective) => objective.trim().length > 0
  )

  if (hasObjective) return []

  return [
    createIssue({
      severity: 'major',
      type: 'ambiguous_scenario',
      quest,
      fieldPath: 'learningObjectives',
      explanation: 'SEL content must declare at least one concrete learning objective.',
      suggestedFix:
        'Add a child-facing SEL objective such as emotion recognition, help-seeking, empathy, or responsible decision practice.',
      blocksPublishing: true
    })
  ]
}

function validateSafetyBoundary(quest: QuestDefinition): ContentIssue[] {
  if (!selDomains.has(quest.domain)) return []

  const issues: ContentIssue[] = []

  if (quest.safety.allowsFreeTextInput) {
    issues.push(
      createIssue({
        severity: 'major',
        type: 'privacy_sensitive_prompt',
        quest,
        fieldPath: 'safety.allowsFreeTextInput',
        explanation:
          'MVP SEL quests should not collect child free-text input before stronger safety and privacy review exists.',
        suggestedFix:
          'Use structured choices, emotion cards, or controlled reflection prompts instead.',
        blocksPublishing: true
      })
    )
  }

  if (
    quest.safety.crisisHandlingRequired &&
    (!quest.teacherGuide?.riskNotes || quest.teacherGuide.riskNotes.length === 0)
  ) {
    issues.push(
      createIssue({
        severity: 'critical',
        type: 'unsafe_crisis_handling',
        quest,
        fieldPath: 'teacherGuide.riskNotes',
        explanation:
          'Quest safety marks crisis handling as required, but no teacher risk note or handoff guidance is present.',
        suggestedFix:
          'Add explicit adult handoff guidance aligned with the school or guardian safety process.',
        blocksPublishing: true
      })
    )
  }

  for (const activity of quest.activities) {
    if (activity.safety?.allowsFreeTextInput) {
      issues.push(
        createIssue({
          severity: 'major',
          type: 'privacy_sensitive_prompt',
          quest,
          activity,
          fieldPath: `activities.${activity.id}.safety.allowsFreeTextInput`,
          explanation:
            'Structured SEL quests should not ask children for free-text input at the activity level in the MVP.',
          suggestedFix:
            'Replace the free-text activity with structured choices or a non-stored private reflection.',
          blocksPublishing: true
        })
      )
    }
  }

  return issues
}

function validateGuardianTeacherAlignment(
  quest: QuestDefinition
): ContentIssue[] {
  if (!selDomains.has(quest.domain)) return []
  if (quest.teacherGuide) return []

  return [
    createIssue({
      severity: 'major',
      type: 'guardian_teacher_mismatch',
      quest,
      fieldPath: 'teacherGuide',
      explanation:
        'SEL quests need teacher guidance so classroom use does not depend on hidden product intent.',
      suggestedFix:
        'Add a teacher guide with objective, discussion prompts, classroom tips, and risk notes when relevant.',
      blocksPublishing: true
    })
  ]
}

function validateActivities(quest: QuestDefinition): ContentIssue[] {
  const issues: ContentIssue[] = []

  for (const activity of quest.activities) {
    if (activity.kind === 'scenario-choice') {
      issues.push(...validateScenarioChoiceActivity(quest, activity))
    }

    if (activity.kind === 'emotion-card') {
      issues.push(...validateEmotionCardActivity(quest, activity))
    }
  }

  return issues
}

function validateScenarioChoiceActivity(
  quest: QuestDefinition,
  activity: ActivityDefinition
): ContentIssue[] {
  const config = asRecord(activity.config)
  const choices = Array.isArray(config.choices) ? config.choices : []
  const hasSafeChoice = choices.some((choice) => {
    const record = asRecord(choice)
    return record.recommended === true || positiveNumber(record.learningSignal)
  })

  if (hasSafeChoice) return []

  return [
    createIssue({
      severity: 'critical',
      type: 'no_safe_response_option',
      quest,
      activity,
      fieldPath: `activities.${activity.id}.config.choices`,
      explanation:
        'Scenario-choice activities must include at least one clearly safe or recommended response.',
      suggestedFix:
        'Mark at least one supportive response as recommended, or assign it a positive learning signal.',
      blocksPublishing: true
    })
  ]
}

function validateEmotionCardActivity(
  quest: QuestDefinition,
  activity: ActivityDefinition
): ContentIssue[] {
  const config = asRecord(activity.config)
  const acceptableEmotionIds = config.acceptableEmotionIds
  const legacyCorrectEmotionIds = config.correctEmotionIds
  const hasAcceptableEmotions =
    Array.isArray(acceptableEmotionIds) && acceptableEmotionIds.length > 0
  const hasLegacyCorrectEmotions =
    Array.isArray(legacyCorrectEmotionIds) && legacyCorrectEmotionIds.length > 0

  if (hasAcceptableEmotions) return []

  if (hasLegacyCorrectEmotions) {
    return [
      createIssue({
        severity: 'minor',
        type: 'ambiguous_scenario',
        quest,
        activity,
        fieldPath: `activities.${activity.id}.config.correctEmotionIds`,
        explanation:
          'Emotion identification can have multiple reasonable answers; use acceptableEmotionIds instead of correctEmotionIds.',
        suggestedFix:
          'Rename correctEmotionIds to acceptableEmotionIds for SEL content.',
        blocksPublishing: false
      })
    ]
  }

  return [
    createIssue({
      severity: 'major',
      type: 'no_safe_response_option',
      quest,
      activity,
      fieldPath: `activities.${activity.id}.config.acceptableEmotionIds`,
      explanation:
        'Emotion-card activities need at least one acceptable emotion target for feedback and review.',
      suggestedFix:
        'Add acceptableEmotionIds with one or more plausible emotions for the scenario.',
      blocksPublishing: true
    })
  ]
}

function validateTextSafety(quest: QuestDefinition): ContentIssue[] {
  const issues: ContentIssue[] = []

  for (const node of collectTextNodes(quest)) {
    if (diagnosticPattern.test(node.text)) {
      issues.push(
        createIssue({
          severity: 'critical',
          type: 'overly_diagnostic',
          quest,
          stageId: node.stageId,
          activityId: node.activityId,
          fieldPath: node.fieldPath,
          explanation:
            'Child-facing SEL content must not diagnose, label, or give therapy or medical advice.',
          suggestedFix:
            'Reframe the text as education or help-seeking guidance, and route serious concerns to trusted adults or professionals.',
          blocksPublishing: true
        })
      )
    }

    if (emotionInvalidatingPattern.test(node.text)) {
      issues.push(
        createIssue({
          severity: 'major',
          type: 'emotion_invalidating',
          quest,
          stageId: node.stageId,
          activityId: node.activityId,
          fieldPath: node.fieldPath,
          explanation:
            'Feedback should validate the emotion before guiding behavior.',
          suggestedFix:
            'Acknowledge the feeling first, then suggest a safe expression or help-seeking action.',
          blocksPublishing: true
        })
      )
    }

    if (privacyPromptPattern.test(node.text)) {
      issues.push(
        createIssue({
          severity: 'major',
          type: 'privacy_sensitive_prompt',
          quest,
          stageId: node.stageId,
          activityId: node.activityId,
          fieldPath: node.fieldPath,
          explanation:
            'The content appears to ask for personally identifying or family-sensitive information.',
          suggestedFix:
            'Use fictional characters or non-identifying structured choices instead.',
          blocksPublishing: true
        })
      )
    }
  }

  return issues
}

function deriveStatus(
  issues: ContentIssue[]
): ContentValidationReport['status'] {
  if (issues.some((issue) => issue.severity === 'critical')) return 'blocked'
  if (issues.some((issue) => issue.severity === 'major')) {
    return 'needs_major_revision'
  }
  if (issues.length > 0) return 'needs_minor_revision'
  return 'passed'
}

function deriveRisk(
  issues: ContentIssue[]
): ContentValidationReport['summary']['overallRisk'] {
  if (issues.some((issue) => issue.severity === 'critical')) return 'critical'
  if (issues.some((issue) => issue.severity === 'major')) return 'high'
  if (issues.length > 0) return 'medium'
  return 'low'
}

function collectTextNodes(quest: QuestDefinition) {
  const nodes: TextNode[] = [
    { fieldPath: 'title', text: quest.title },
    ...(quest.subtitle ? [{ fieldPath: 'subtitle', text: quest.subtitle }] : []),
    { fieldPath: 'description', text: quest.description },
    ...quest.learningObjectives.map((text, index) => ({
      fieldPath: `learningObjectives.${index}`,
      text
    })),
    ...quest.stages.map((stage) => ({
      stageId: stage.id,
      fieldPath: `stages.${stage.id}.title`,
      text: stage.title
    })),
    ...collectTextFromValue(quest.guardianSummary, 'guardianSummary'),
    ...collectTextFromValue(quest.teacherGuide, 'teacherGuide')
  ]

  for (const activity of quest.activities) {
    if (activity.title) {
      nodes.push({
        activityId: activity.id,
        fieldPath: `activities.${activity.id}.title`,
        text: activity.title
      })
    }

    nodes.push(
      ...collectTextFromValue(
        activity.config,
        `activities.${activity.id}.config`,
        activity.id
      )
    )
  }

  return nodes
}

function collectTextFromValue(
  value: unknown,
  path: string,
  activityId?: string
): TextNode[] {
  if (typeof value === 'string') {
    return [{ activityId, fieldPath: path, text: value }]
  }

  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      collectTextFromValue(item, `${path}.${index}`, activityId)
    )
  }

  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, item]) =>
      collectTextFromValue(item, `${path}.${key}`, activityId)
    )
  }

  return []
}

function createIssue(input: {
  severity: ContentIssueSeverity
  type: SelContentIssueType
  quest: QuestDefinition
  activity?: ActivityDefinition
  stageId?: string
  activityId?: string
  fieldPath: string
  explanation: string
  suggestedFix?: string
  blocksPublishing: boolean
}): ContentIssue {
  return {
    id: '',
    severity: input.severity,
    type: input.type,
    location: {
      questId: input.quest.id,
      stageId: input.stageId,
      activityId: input.activity?.id ?? input.activityId,
      fieldPath: input.fieldPath
    },
    explanation: input.explanation,
    suggestedFix: input.suggestedFix,
    blocksPublishing: input.blocksPublishing
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {}
}

function positiveNumber(value: unknown) {
  return typeof value === 'number' && value > 0
}

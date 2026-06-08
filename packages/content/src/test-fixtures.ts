import { execFile } from 'node:child_process'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { validateSelQuestContent } from '@sel-quest/content-validation'
import type { QuestDefinition } from '@sel-quest/quest-core'
import type { ContentExpertReview } from '@sel-quest/review-core'

const execFileAsync = promisify(execFile)
const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
)

export const validQuest: QuestDefinition = {
  id: 'test-quest',
  slug: 'test-quest',
  version: '1.0.0',
  status: 'draft',
  title: 'Test Quest',
  description: 'Practice naming feelings and asking for help.',
  domain: 'mental_health_education',
  ageBand: '8-10',
  estimatedMinutes: 8,
  learningObjectives: ['Recognize feelings', 'Ask a trusted adult for help'],
  safety: {
    dataSensitivity: 'low',
    allowsFreeTextInput: false,
    requiresGuardianConsent: false,
    crisisHandlingRequired: false
  },
  guardianSummary: {
    title: 'Children practice safe choices',
    description: 'A structured SEL quest.',
    whatChildWillPractice: ['Naming feelings'],
    whatDataIsCollected: ['Progress and structured choices']
  },
  teacherGuide: {
    objective: 'Practice emotion recognition and help-seeking.',
    discussionPrompts: ['What can the character do next?'],
    classroomTips: ['Discuss the fictional character, not classmates.'],
    riskNotes: ['Use existing school safety processes for serious concerns.']
  },
  stages: [
    {
      id: 'emotion',
      title: 'Emotion',
      type: 'activity',
      activityId: 'emotion_001',
      next: 'scenario'
    },
    {
      id: 'scenario',
      title: 'Scenario',
      type: 'activity',
      activityId: 'scenario_001',
      next: 'complete'
    },
    {
      id: 'complete',
      title: 'Complete',
      type: 'complete'
    }
  ],
  activities: [
    {
      id: 'emotion_001',
      kind: 'emotion-card',
      completion: { type: 'user_submit' },
      safety: { allowsFreeTextInput: false },
      config: {
        prompt: 'How might the character feel?',
        emotions: [{ id: 'sad', label: 'Sad' }],
        acceptableEmotionIds: ['sad']
      }
    },
    {
      id: 'scenario_001',
      kind: 'scenario-choice',
      completion: { type: 'user_submit' },
      safety: { allowsFreeTextInput: false },
      config: {
        scenarioText: 'What can the character do?',
        choices: [
          {
            id: 'ask_teacher',
            label: 'Ask a trusted teacher for help',
            outcomeText: 'A trusted adult can help.',
            recommended: true,
            learningSignal: 1
          }
        ]
      }
    }
  ],
  assets: []
}

export async function writeQuestFixture(input: {
  quest: QuestDefinition
  validationQuest?: QuestDefinition
  expertReviews?: ContentExpertReview[]
}) {
  const questsRoot = await mkdtemp(path.join(os.tmpdir(), 'sel-quest-content-'))
  const questDir = path.join(questsRoot, input.quest.slug)
  const validationQuest = input.validationQuest ?? input.quest
  const validationReport = validateSelQuestContent(validationQuest, {
    now: () => '2026-06-09T00:00:00.000Z',
    reportId: `report_${validationQuest.id}_${validationQuest.version}_rules`
  })

  await mkdir(questDir, { recursive: true })
  await writeFile(
    path.join(questDir, 'quest.json'),
    `${JSON.stringify(input.quest, null, 2)}\n`
  )
  await writeFile(
    path.join(questDir, 'validation-report.json'),
    `${JSON.stringify(validationReport, null, 2)}\n`
  )
  await writeFile(
    path.join(questDir, 'expert-reviews.json'),
    `${JSON.stringify(input.expertReviews ?? [], null, 2)}\n`
  )

  return { questsRoot, validationReport }
}

export function createApprovedReview(quest: QuestDefinition): ContentExpertReview {
  const validationReport = validateSelQuestContent(quest, {
    now: () => '2026-06-09T00:00:00.000Z',
    reportId: `report_${quest.id}_${quest.version}_rules`
  })

  return {
    id: `review_${quest.id}_${quest.version}_expert_001`,
    contentItemId: quest.id,
    contentVersion: quest.version,
    contentHash: validationReport.contentHash,
    reviewer: {
      id: 'reviewer_001',
      role: 'child_development_psychologist'
    },
    decision: 'approved',
    reviewedIssueIds: [],
    notes: ['Approved for structured SEL content.'],
    requiredFollowUps: [],
    createdAt: '2026-06-09T00:00:00.000Z'
  }
}

export async function runContentScript(input: {
  scriptName: string
  args: string[]
  questsRoot: string
  env?: Record<string, string>
}) {
  try {
    const result = await execFileAsync(process.execPath, [
      path.join(packageRoot, 'scripts', input.scriptName),
      ...input.args
    ], {
      cwd: packageRoot,
      env: {
        ...process.env,
        CONTENT_QUESTS_ROOT: input.questsRoot,
        ...input.env
      }
    })

    return {
      exitCode: 0,
      stdout: String(result.stdout),
      stderr: String(result.stderr)
    }
  } catch (error) {
    const failed = error as {
      code?: number
      stdout?: string | Buffer
      stderr?: string | Buffer
    }

    return {
      exitCode: typeof failed.code === 'number' ? failed.code : 1,
      stdout: String(failed.stdout ?? ''),
      stderr: String(failed.stderr ?? '')
    }
  }
}

import { execFile } from 'node:child_process'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { validateSelQuestContent } from '@sel-quest/content-validation'
import type { QuestDefinition } from '@sel-quest/quest-core'
import type {
  ContentExpertReview,
  ReviewCoverageSection
} from '@sel-quest/review-core'
import type { AssetManifest } from '@sel-quest/asset-pipeline'
import type { NarrativeDefinition } from '@sel-quest/narrative-core'
import type { WorldDefinition } from '@sel-quest/world-core'

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
  learningObjectives: [
    {
      id: 'lo_emotion_recognition',
      title: 'Recognize feelings',
      childFacingText: 'I can name how a character may feel.',
      selCompetencies: ['self_awareness'],
      safe: {
        sequenced: true,
        active: true,
        focused: true,
        explicit: true
      }
    },
    {
      id: 'lo_help_seeking',
      title: 'Ask a trusted adult for help',
      childFacingText: 'I can choose when to ask a trusted adult for help.',
      selCompetencies: ['relationship_skills', 'responsible_decision_making'],
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
      learningObjectiveIds: ['lo_emotion_recognition'],
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
      learningObjectiveIds: ['lo_help_seeking'],
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

export const validWorld: WorldDefinition = {
  id: 'test-world',
  version: '0.1.0',
  title: 'Test World',
  artDirection: {
    style: 'storybook_3d',
    mood: ['warm']
  },
  assetManifestId: 'assets_test_world_0_1_0',
  zones: [
    {
      id: 'test_zone',
      title: 'Test Zone',
      theme: 'emotion_harbor',
      sceneIds: ['test_scene']
    }
  ],
  scenes: [
    {
      id: 'test_scene',
      zoneId: 'test_zone',
      title: 'Test Scene',
      characterPlacements: [
        {
          characterId: 'test_character',
          position: [0, 0, 0],
          initialAnimation: 'idle'
        }
      ],
      interactableIds: []
    }
  ],
  characters: [
    {
      id: 'test_character',
      name: 'Test Character',
      role: 'child_peer',
      personalityTags: ['quiet'],
      asset: {
        modelAssetId: 'model_test_character',
        animationSetId: 'anim_test_character'
      },
      safetyProfile: {
        neverActsAsTherapist: true,
        canDiscussSensitiveTopics: false
      },
      dialogueStyle: {
        ageBand: '8-10',
        tone: 'warm',
        maxSentenceLength: 'short'
      }
    }
  ],
  interactables: []
}

export const validAssetManifest: AssetManifest = {
  id: 'assets_test_world_0_1_0',
  version: '0.1.0',
  title: 'Test World Assets',
  performanceBudget: {
    maxInitialDownloadMb: 5,
    maxTrianglesPerScene: 12000,
    maxTextureSize: 1024,
    mobileTargetFps: 30
  },
  assets: [
    {
      id: 'model_test_character',
      kind: 'model',
      status: 'placeholder',
      label: 'Test Character Model',
      format: 'glb',
      triangleCount: 800,
      animationAssetIds: ['anim_test_character'],
      requiredAnimationClipIds: ['idle'],
      license: {
        owner: 'Duoland',
        source: 'internal placeholder',
        commercialUseAllowed: true
      }
    },
    {
      id: 'anim_test_character',
      kind: 'animation',
      status: 'placeholder',
      label: 'Test Character Animation',
      format: 'json',
      clipIds: ['idle'],
      license: {
        owner: 'Duoland',
        source: 'internal placeholder',
        commercialUseAllowed: true
      }
    }
  ]
}

export const validNarrative: NarrativeDefinition = {
  id: 'test-narrative',
  questId: 'test-quest',
  version: '0.1.0',
  episodes: [
    {
      id: 'episode_test',
      questId: 'test-quest',
      title: 'Test Episode',
      summary: 'A short test episode.',
      worldZoneId: 'test_zone',
      entrySceneId: 'test_scene',
      learningObjectiveIds: ['lo_emotion_recognition'],
      beats: [
        {
          id: 'beat_emotion',
          kind: 'activity',
          activityId: 'emotion_001',
          learningObjectiveIds: ['lo_emotion_recognition']
        }
      ]
    }
  ],
  dialogues: [],
  cutscenes: []
}

export async function writeQuestFixture(input: {
  quest: QuestDefinition
  validationQuest?: QuestDefinition
  expertReviews?: ContentExpertReview[]
  world?: WorldDefinition
  narrative?: NarrativeDefinition
  assetManifest?: AssetManifest
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
  if (input.world) {
    await writeFile(
      path.join(questDir, 'world.json'),
      `${JSON.stringify(input.world, null, 2)}\n`
    )
  }
  if (input.narrative) {
    await writeFile(
      path.join(questDir, 'narrative.json'),
      `${JSON.stringify(input.narrative, null, 2)}\n`
    )
  }
  if (input.assetManifest) {
    await writeFile(
      path.join(questDir, 'asset-manifest.json'),
      `${JSON.stringify(input.assetManifest, null, 2)}\n`
    )
  }

  return { questsRoot, validationReport }
}

export function createApprovedReview(
  quest: QuestDefinition,
  options: { extraReviewedSections?: ReviewCoverageSection[] } = {}
): ContentExpertReview {
  const validationReport = validateSelQuestContent(quest, {
    now: () => '2026-06-09T00:00:00.000Z',
    reportId: `report_${quest.id}_${quest.version}_rules`
  })
  const reviewedSections = [
    ...new Set<ReviewCoverageSection>([
      'child_content',
      'guardian_summary',
      'teacher_guide',
      'safety_policy',
      'activity_feedback',
      ...(options.extraReviewedSections ?? [])
    ])
  ]

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
    reviewCoverage: {
      reviewedSections
    },
    notes: ['Approved for structured SEL content.'],
    requiredFollowUps: [],
    createdAt: '2026-06-09T00:00:00.000Z'
  }
}

export function createRequiredApprovedReviews(
  quest: QuestDefinition,
  options: { extraReviewedSections?: ReviewCoverageSection[] } = {}
): ContentExpertReview[] {
  const baseReview = createApprovedReview(quest, options)

  return [
    {
      ...baseReview,
      id: `review_${quest.id}_${quest.version}_teacher_001`,
      reviewer: {
        id: 'reviewer_teacher_001',
        role: 'school_mental_health_teacher'
      }
    },
    {
      ...baseReview,
      id: `review_${quest.id}_${quest.version}_safety_001`,
      reviewer: {
        id: 'reviewer_safety_001',
        role: 'safety_reviewer'
      }
    }
  ]
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

export type AgeBand = '6-8' | '8-10' | '10-12' | '12-15'

export type QuestDomain =
  | 'sel'
  | 'mental_health_education'
  | 'family_school_collaboration'
  | 'ai_literacy'
  | 'general'

export type DataSensitivity =
  | 'none'
  | 'low'
  | 'child_personal'
  | 'psychological_sensitive'

export type QuestStatus = 'draft' | 'published' | 'archived'

export type PreferredWorldRenderer = 'react' | 'phaser' | 'r3f'

export interface QuestWorldBinding {
  worldId: string
  entrySceneId: string
  preferredRenderer?: PreferredWorldRenderer
}

export type SelCompetency =
  | 'self_awareness'
  | 'self_management'
  | 'social_awareness'
  | 'relationship_skills'
  | 'responsible_decision_making'

export interface SafeLearningDesign {
  sequenced: boolean
  active: boolean
  focused: boolean
  explicit: boolean
}

export interface LearningObjective {
  id: string
  title: string
  childFacingText: string
  selCompetencies: SelCompetency[]
  safe: SafeLearningDesign
}

export interface QuestSafetyDefinition {
  dataSensitivity: DataSensitivity
  allowsFreeTextInput: boolean
  requiresGuardianConsent: boolean
  crisisHandlingRequired: boolean
  minAge?: number
  maxAge?: number
}

export interface GuardianSummary {
  title: string
  description: string
  whatChildWillPractice: string[]
  whatDataIsCollected: string[]
  familyExtensionTips?: string[]
}

export interface TeacherGuide {
  objective: string
  suggestedDurationMinutes?: number
  discussionPrompts: string[]
  classroomTips: string[]
  riskNotes?: string[]
}

export type QuestStageType =
  | 'intro'
  | 'story'
  | 'activity'
  | 'reflection'
  | 'recap'
  | 'complete'

export type UnlockRule =
  | { type: 'always' }
  | { type: 'stage_completed'; stageId: string }
  | { type: 'activity_completed'; activityId: string }
  | { type: 'all_stages_completed'; stageIds: string[] }

export type LearningEventType =
  | 'quest_started'
  | 'quest_resumed'
  | 'quest_resume_failed'
  | 'stage_entered'
  | 'activity_started'
  | 'activity_answered'
  | 'activity_completed'
  | 'stage_completed'
  | 'quest_completed'
  | 'quest_reset'
  | 'safety_notice_shown'

export type QuestAction =
  | {
      type: 'emit_event'
      eventType: LearningEventType
      payload?: Record<string, unknown>
    }
  | { type: 'set_flag'; key: string; value: boolean | string | number }
  | { type: 'show_notice'; noticeId: string }

export interface QuestStageDefinition {
  id: string
  title: string
  type: QuestStageType
  activityId?: string
  unlockWhen?: UnlockRule
  onEnter?: QuestAction[]
  onComplete?: QuestAction[]
  next?: string
}

export const builtinActivityKinds = [
  'dialogue',
  'single-choice',
  'emotion-card',
  'scenario-choice',
  'breathing',
  'recap'
] as const

export type BuiltinActivityKind = typeof builtinActivityKinds[number]
export type ActivityKind = BuiltinActivityKind | (string & {})

export type ActivityCompletionRule =
  | { type: 'auto' }
  | { type: 'user_submit' }
  | { type: 'learning_signal_threshold'; minLearningSignal: number }
  | { type: 'time_elapsed'; minSeconds: number }

export interface ActivitySafetyDefinition {
  allowsFreeTextInput?: boolean
  maxInputLength?: number
  blockedTopics?: string[]
  dataSensitivity?: DataSensitivity
}

export interface ActivityDefinition<TConfig = unknown> {
  id: string
  kind: ActivityKind
  title?: string
  learningObjectiveIds: string[]
  config: TConfig
  completion: ActivityCompletionRule
  safety?: ActivitySafetyDefinition
}

export interface ActivityResult<TValue = unknown> {
  activityId: string
  completed: boolean
  learningSignal?: number
  value?: TValue
  metadata?: Record<string, unknown>
}

export type QuestAssetType = 'image' | 'audio' | 'spritesheet' | 'json' | 'video'

export interface QuestAsset {
  id: string
  type: QuestAssetType
  src: string
  alt?: string
  preload?: boolean
}

export interface QuestDefinition {
  id: string
  slug: string
  version: string
  status: QuestStatus
  title: string
  subtitle?: string
  description: string
  domain: QuestDomain
  ageBand: AgeBand
  estimatedMinutes: number
  learningObjectives: LearningObjective[]
  worldBinding?: QuestWorldBinding
  episodeIds?: string[]
  safety: QuestSafetyDefinition
  guardianSummary: GuardianSummary
  teacherGuide?: TeacherGuide
  stages: QuestStageDefinition[]
  activities: ActivityDefinition[]
  assets: QuestAsset[]
}

export interface QuestProgressSnapshot {
  schemaVersion: 1
  userId: string | 'anonymous'
  questId: string
  questVersion: string
  status: 'not_started' | 'in_progress' | 'completed'
  runtimeState?: 'idle' | 'playing' | 'paused' | 'completed' | 'error'
  currentStageId?: string
  currentActivityId?: string
  completedStageIds: string[]
  completedActivityIds: string[]
  activityState: Record<string, unknown>
  flags: Record<string, boolean | string | number>
  startedAt: string
  updatedAt: string
  completedAt?: string
  lastEventId?: string
}

export interface LearningEvent {
  id: string
  type: LearningEventType
  questId: string
  questVersion: string
  stageId?: string
  activityId?: string
  userId: string | 'anonymous'
  sessionId: string
  payload?: Record<string, unknown>
  createdAt: string
}

export interface QuestContext {
  quest: QuestDefinition
  userId: string | 'anonymous'
  sessionId: string
  currentStageId?: string
  currentActivityId?: string
  completedStageIds: string[]
  completedActivityIds: string[]
  activityState: Record<string, unknown>
  flags: Record<string, boolean | string | number>
  startedAt?: string
  updatedAt?: string
  completedAt?: string
  events: LearningEvent[]
  lastError?: string
}

export type QuestEvent =
  | { type: 'START' }
  | { type: 'RESUME'; snapshot: QuestProgressSnapshot }
  | { type: 'ENTER_STAGE'; stageId: string }
  | { type: 'ACTIVITY_STARTED'; activityId: string }
  | { type: 'ACTIVITY_PROGRESS'; activityId: string; value: unknown }
  | {
      type: 'ACTIVITY_COMPLETED'
      activityId: string
      result: ActivityResult
    }
  | { type: 'NEXT_STAGE' }
  | { type: 'RETRY_STAGE' }
  | { type: 'PAUSE' }
  | { type: 'RESET' }
  | { type: 'COMPLETE_QUEST' }
  | { type: 'ERROR'; message: string }

export interface CreateQuestMachineInput {
  quest: QuestDefinition
  userId?: string
  sessionId?: string
  initialSnapshot?: QuestProgressSnapshot | null
  now?: () => string
}

export interface LoadProgressInput {
  userId: string | 'anonymous'
  questId: string
  questVersion: string
}

export interface ResetProgressInput {
  userId: string | 'anonymous'
  questId: string
  questVersion: string
}

export interface ProgressRepository {
  loadProgress(input: LoadProgressInput): Promise<QuestProgressSnapshot | null>
  saveProgress(snapshot: QuestProgressSnapshot): Promise<void>
  resetProgress(input: ResetProgressInput): Promise<void>
}

export interface EventSink {
  append(event: LearningEvent): Promise<void>
  listRecent?(input: { sessionId: string; limit: number }): Promise<LearningEvent[]>
}

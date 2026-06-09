import { createContentHash } from '@sel-quest/review-core'

export type AiPromptPurpose =
  | 'content_generation'
  | 'content_validation'
  | 'content_refinement'
  | 'review_assistance'

export type AiPromptAudience =
  | 'authoring_team'
  | 'validator'
  | 'expert_reviewer'

export type AiDataClassification =
  | 'public_curriculum'
  | 'internal_authoring'
  | 'sensitive_child_data'

export type AiPromptMessageRole = 'system' | 'user' | 'assistant'

export type AiPromptRunStatus = 'completed' | 'failed' | 'blocked'

export type AiPromptRunErrorCode =
  | 'provider_error'
  | 'timeout'
  | 'policy_violation'
  | 'invalid_response'
  | 'unknown'

export type AiCandidateArtifactKind =
  | 'quest_candidate'
  | 'validation_candidate'
  | 'refinement_candidate'
  | 'review_assistance_note'

export interface AiModelSpec {
  provider: string
  model: string
  version?: string
}

export interface AiPromptPolicy {
  audience: AiPromptAudience
  childFacingOutput: boolean
  requiresHumanReview: boolean
  allowsPersonalChildData: boolean
  dataClassification: AiDataClassification
}

export interface AiPromptMessage {
  role: AiPromptMessageRole
  content: string
}

export interface AiPromptRequest {
  id: string
  purpose: AiPromptPurpose
  model: AiModelSpec
  messages: AiPromptMessage[]
  policy: AiPromptPolicy
  metadata?: Record<string, string | number | boolean>
}

declare const validatedAiPromptRequestBrand: unique symbol

export type ValidatedAiPromptRequest = AiPromptRequest & {
  readonly [validatedAiPromptRequestBrand]: true
}

export interface AiPromptResponse {
  requestId: string
  model: AiModelSpec
  output: unknown
  usage?: {
    inputTokens?: number
    outputTokens?: number
  }
}

export interface AiModelAdapter {
  runPrompt(request: ValidatedAiPromptRequest): Promise<AiPromptResponse>
}

export interface AiPromptRunRecord {
  id: string
  requestId: string
  purpose: AiPromptPurpose
  model: AiModelSpec
  policy: AiPromptPolicy
  status: AiPromptRunStatus
  promptHash: string
  outputHash?: string
  errorCode?: AiPromptRunErrorCode
  startedAt: string
  completedAt: string
  metadataKeys: string[]
  metadataHash?: string
}

export interface AiCandidateArtifact {
  id: string
  requestId: string
  kind: AiCandidateArtifactKind
  status: 'candidate'
  contentHash: string
  childFacingOutput: boolean
  requiresValidation: boolean
  requiresExpertReview: boolean
  createdAt: string
  noteCount: number
}

export class DisabledAiModelAdapter implements AiModelAdapter {
  runPrompt(): Promise<never> {
    return Promise.reject(
      new Error('AI runtime is disabled until a model adapter is injected.')
    )
  }
}

export function validateAuthoringPromptRequest(
  input: unknown
): ValidatedAiPromptRequest {
  const record = assertRecord(input, 'Prompt request must be an object.')
  const request: AiPromptRequest = {
    id: readSafeIdentifier(record, 'id', 'Prompt request id'),
    purpose: readEnum(record, 'purpose', promptPurposes, 'Prompt purpose is invalid.'),
    model: validateAiModelSpec(record.model),
    messages: validatePromptMessages(record.messages),
    policy: validatePromptPolicy(record.policy),
    metadata: validatePromptMetadata(record.metadata)
  }

  if (request.policy.childFacingOutput) {
    throw new Error('AI prompt requests must not produce child-facing output.')
  }

  if (!request.policy.requiresHumanReview) {
    throw new Error('AI prompt requests must require human review.')
  }

  if (request.policy.allowsPersonalChildData) {
    throw new Error('AI prompt requests must not allow personal child data.')
  }

  if (request.policy.dataClassification === 'sensitive_child_data') {
    throw new Error('AI prompt requests must not include sensitive child data.')
  }

  return deepFreeze(request) as ValidatedAiPromptRequest
}

export function runAuthoringPrompt(
  adapter: AiModelAdapter,
  request: unknown
): Promise<AiPromptResponse> {
  return adapter.runPrompt(validateAuthoringPromptRequest(request))
}

export function createAiPromptRunRecord(input: {
  request: unknown
  status: AiPromptRunStatus
  output?: unknown
  errorCode?: AiPromptRunErrorCode
  startedAt?: string
  completedAt?: string
  recordId?: string
}): AiPromptRunRecord {
  const request = validateAuthoringPromptRequest(input.request)
  const status = validateRunStatus(input.status)
  const startedAt = validateIsoTimestamp(
    input.startedAt ?? new Date().toISOString(),
    'AI prompt run start time'
  )
  const completedAt = validateIsoTimestamp(
    input.completedAt ?? startedAt,
    'AI prompt run completion time'
  )
  const recordId =
    input.recordId === undefined
      ? undefined
      : validateSafeIdentifier(input.recordId, 'AI prompt run record id')
  const errorCode =
    input.errorCode === undefined ? undefined : validateRunErrorCode(input.errorCode)
  const metadataKeys = request.metadata ? Object.keys(request.metadata).sort() : []

  if (status === 'completed' && input.output === undefined) {
    throw new Error('Completed AI prompt runs must include output for hashing.')
  }

  if (status === 'completed' && errorCode) {
    throw new Error('Completed AI prompt runs must not include an error code.')
  }

  if (status !== 'completed' && !errorCode) {
    throw new Error('Failed or blocked AI prompt runs must include an error code.')
  }

  return {
    id: recordId ?? `ai_run_${request.id}_${compactTimestamp(completedAt)}`,
    requestId: request.id,
    purpose: request.purpose,
    model: request.model,
    policy: request.policy,
    status,
    promptHash: createContentHash({
      purpose: request.purpose,
      model: request.model,
      messages: request.messages,
      metadata: request.metadata
    }),
    outputHash:
      input.output === undefined ? undefined : createContentHash(input.output),
    errorCode,
    startedAt,
    completedAt,
    metadataKeys,
    metadataHash: request.metadata
      ? createContentHash(request.metadata)
      : undefined
  }
}

export function createAiCandidateArtifact(input: {
  request: unknown
  kind: AiCandidateArtifactKind
  content: unknown
  createdAt?: string
  artifactId?: string
  noteCount?: number
}): AiCandidateArtifact {
  const request = validateAuthoringPromptRequest(input.request)
  const createdAt = validateIsoTimestamp(
    input.createdAt ?? new Date().toISOString(),
    'AI candidate artifact creation time'
  )
  const artifactId =
    input.artifactId === undefined
      ? undefined
      : validateSafeIdentifier(input.artifactId, 'AI candidate artifact id')

  return validateAiCandidateArtifact({
    id:
      artifactId ??
      `ai_candidate_${request.id}_${compactTimestamp(createdAt)}`,
    requestId: request.id,
    kind: validateCandidateArtifactKind(input.kind),
    status: 'candidate',
    contentHash: createContentHash(input.content),
    childFacingOutput: false,
    requiresValidation: true,
    requiresExpertReview: true,
    createdAt,
    noteCount: input.noteCount ?? 0
  })
}

export function validateAiCandidateArtifact(
  input: unknown
): AiCandidateArtifact {
  const artifact = assertRecord(input, 'AI candidate artifact must be an object.')
  const validated: AiCandidateArtifact = {
    id: readSafeIdentifier(
      artifact,
      'id',
      'AI candidate artifact id'
    ),
    requestId: readSafeIdentifier(
      artifact,
      'requestId',
      'AI candidate artifact request id'
    ),
    kind: readEnum(
      artifact,
      'kind',
      candidateArtifactKinds,
      'AI candidate artifact kind is invalid.'
    ),
    status: readLiteral(
      artifact,
      'status',
      'candidate',
      'AI artifacts must remain candidates until publication.'
    ),
    contentHash: readContentHash(
      artifact,
      'contentHash',
      'AI candidate artifact content hash is required.'
    ),
    childFacingOutput: readBoolean(
      artifact,
      'childFacingOutput',
      'AI candidate artifact child-facing flag is required.'
    ),
    requiresValidation: readBoolean(
      artifact,
      'requiresValidation',
      'AI candidate artifact validation flag is required.'
    ),
    requiresExpertReview: readBoolean(
      artifact,
      'requiresExpertReview',
      'AI candidate artifact review flag is required.'
    ),
    createdAt: readIsoTimestamp(
      artifact,
      'createdAt',
      'AI candidate artifact creation time'
    ),
    noteCount: readNonnegativeInteger(
      artifact,
      'noteCount',
      'AI candidate artifact note count must be a nonnegative integer.'
    )
  }

  if (validated.childFacingOutput) {
    throw new Error('AI candidate artifacts must not be child-facing output.')
  }

  if (!validated.requiresValidation) {
    throw new Error('AI candidate artifacts must require validation evidence.')
  }

  if (!validated.requiresExpertReview) {
    throw new Error('AI candidate artifacts must require expert review.')
  }

  return validated
}

const promptPurposes = [
  'content_generation',
  'content_validation',
  'content_refinement',
  'review_assistance'
] as const

const promptAudiences = [
  'authoring_team',
  'validator',
  'expert_reviewer'
] as const

const dataClassifications = [
  'public_curriculum',
  'internal_authoring',
  'sensitive_child_data'
] as const

const messageRoles = ['system', 'user', 'assistant'] as const

const runStatuses = ['completed', 'failed', 'blocked'] as const

const runErrorCodes = [
  'provider_error',
  'timeout',
  'policy_violation',
  'invalid_response',
  'unknown'
] as const

const candidateArtifactKinds = [
  'quest_candidate',
  'validation_candidate',
  'refinement_candidate',
  'review_assistance_note'
] as const

const sensitiveMetadataKeyPattern =
  /(child|student|learner|guardian|parent|class|session|user|email|phone|name)/i

function validateAiModelSpec(input: unknown): AiModelSpec {
  const model = assertRecord(input, 'AI model spec must be an object.')

  return {
    provider: readSafeIdentifier(model, 'provider', 'AI model provider'),
    model: readSafeIdentifier(model, 'model', 'AI model name'),
    version: readOptionalSafeIdentifier(model, 'version', 'AI model version')
  }
}

function validatePromptMessages(input: unknown): AiPromptMessage[] {
  if (!Array.isArray(input)) {
    throw new Error('Prompt request messages must be an array.')
  }

  if (input.length === 0) {
    throw new Error('Prompt request must include at least one message.')
  }

  return input.map((message, index) => {
    const record = assertRecord(message, `Prompt message ${index + 1} must be an object.`)

    return {
      role: readEnum(
        record,
        'role',
        messageRoles,
        `Prompt message ${index + 1} role is invalid.`
      ),
      content: readNonEmptyString(
        record,
        'content',
        'Prompt messages must not be empty.'
      )
    }
  })
}

function validatePromptPolicy(input: unknown): AiPromptPolicy {
  const policy = assertRecord(input, 'Prompt policy must be an object.')

  return {
    audience: readEnum(
      policy,
      'audience',
      promptAudiences,
      'Prompt policy audience is invalid.'
    ),
    childFacingOutput: readBoolean(
      policy,
      'childFacingOutput',
      'Prompt policy child-facing flag is required.'
    ),
    requiresHumanReview: readBoolean(
      policy,
      'requiresHumanReview',
      'Prompt policy human review flag is required.'
    ),
    allowsPersonalChildData: readBoolean(
      policy,
      'allowsPersonalChildData',
      'Prompt policy personal child data flag is required.'
    ),
    dataClassification: readEnum(
      policy,
      'dataClassification',
      dataClassifications,
      'Prompt policy data classification is invalid.'
    )
  }
}

function validatePromptMetadata(
  input: unknown
): Record<string, string | number | boolean> | undefined {
  if (input === undefined) return undefined

  const metadata = assertRecord(input, 'Prompt metadata must be an object.')
  const validated: Record<string, string | number | boolean> = {}

  for (const [key, value] of Object.entries(metadata)) {
    assertSafeMetadataKey(key)

    if (typeof value === 'string') {
      if (!/^[A-Za-z0-9_.:/-]{1,80}$/.test(value)) {
        throw new Error(
          `Prompt metadata ${key} must be a compact identifier, not free text.`
        )
      }
      validated[key] = value
      continue
    }

    if (typeof value === 'number') {
      if (!Number.isFinite(value)) {
        throw new Error(`Prompt metadata ${key} must be a finite number.`)
      }
      validated[key] = value
      continue
    }

    if (typeof value === 'boolean') {
      validated[key] = value
      continue
    }

    throw new Error(`Prompt metadata ${key} must be a string, number, or boolean.`)
  }

  return validated
}

function validateRunStatus(status: unknown): AiPromptRunStatus {
  if (!runStatuses.includes(status as AiPromptRunStatus)) {
    throw new Error('AI prompt run status is invalid.')
  }

  return status as AiPromptRunStatus
}

function validateRunErrorCode(errorCode: unknown): AiPromptRunErrorCode {
  if (!runErrorCodes.includes(errorCode as AiPromptRunErrorCode)) {
    throw new Error('AI prompt run error code is invalid.')
  }

  return errorCode as AiPromptRunErrorCode
}

function validateCandidateArtifactKind(
  kind: unknown
): AiCandidateArtifactKind {
  if (!candidateArtifactKinds.includes(kind as AiCandidateArtifactKind)) {
    throw new Error('AI candidate artifact kind is invalid.')
  }

  return kind as AiCandidateArtifactKind
}

function assertSafeMetadataKey(key: string) {
  validateSafeIdentifier(key, `Prompt metadata key ${key}`)
}

function readSafeIdentifier(
  record: Record<string, unknown>,
  key: string,
  label: string
) {
  const value = readNonEmptyString(record, key, `${label} is required.`)
  return validateSafeIdentifier(value, label)
}

function readOptionalSafeIdentifier(
  record: Record<string, unknown>,
  key: string,
  label: string
) {
  const value = record[key]
  if (value === undefined) return undefined
  if (typeof value !== 'string') {
    throw new Error(`${label} must be a compact identifier.`)
  }

  return validateSafeIdentifier(value, label)
}

function validateSafeIdentifier(value: string, label: string) {
  assertNonEmptyString(value, `${label} is required.`)

  if (!/^[A-Za-z0-9_.:-]{1,120}$/.test(value)) {
    throw new Error(`${label} must be a compact identifier.`)
  }

  if (sensitiveMetadataKeyPattern.test(value)) {
    throw new Error(`${label} may identify a child or session.`)
  }

  return value
}

function assertRecord(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(message)
  }

  return value as Record<string, unknown>
}

function readNonEmptyString(
  record: Record<string, unknown>,
  key: string,
  message: string
) {
  const value = record[key]
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(message)
  }

  return value
}

function readContentHash(
  record: Record<string, unknown>,
  key: string,
  message: string
) {
  const value = readNonEmptyString(record, key, message)
  if (!/^sha256_[0-9a-f]{64}$/.test(value)) {
    throw new Error(`${message} Expected sha256 content hash.`)
  }

  return value
}

function readIsoTimestamp(
  record: Record<string, unknown>,
  key: string,
  label: string
) {
  const value = readNonEmptyString(record, key, `${label} is required.`)
  return validateIsoTimestamp(value, label)
}

function validateIsoTimestamp(value: string, label: string) {
  assertNonEmptyString(value, `${label} is required.`)

  const parsed = new Date(value)
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString() !== value) {
    throw new Error(`${label} must be an ISO timestamp.`)
  }

  return value
}

function readBoolean(
  record: Record<string, unknown>,
  key: string,
  message: string
) {
  const value = record[key]
  if (typeof value !== 'boolean') {
    throw new Error(message)
  }

  return value
}

function readNonnegativeInteger(
  record: Record<string, unknown>,
  key: string,
  message: string
) {
  const value = record[key]
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(message)
  }

  return value
}

function readEnum<T extends readonly string[]>(
  record: Record<string, unknown>,
  key: string,
  values: T,
  message: string
): T[number] {
  const value = record[key]
  if (!values.includes(value as T[number])) {
    throw new Error(message)
  }

  return value as T[number]
}

function readLiteral<T extends string>(
  record: Record<string, unknown>,
  key: string,
  expected: T,
  message: string
): T {
  if (record[key] !== expected) {
    throw new Error(message)
  }

  return expected
}

function assertNonEmptyString(value: string, message: string) {
  if (value.trim().length === 0) {
    throw new Error(message)
  }
}

function compactTimestamp(value: string) {
  return value.replace(/[^0-9A-Za-z]/g, '')
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value
  }

  Object.freeze(value)

  for (const child of Object.values(value)) {
    deepFreeze(child)
  }

  return value
}

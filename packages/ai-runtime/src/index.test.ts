import { describe, expect, it } from 'vitest'
import {
  DisabledAiModelAdapter,
  createAiCandidateArtifact,
  createAiPromptRunRecord,
  runAuthoringPrompt,
  validateAiCandidateArtifact,
  validateAuthoringPromptRequest,
  type AiCandidateArtifact,
  type AiPromptRequest
} from './index'

describe('ai runtime boundaries', () => {
  it('keeps the default model adapter disabled behind request validation', async () => {
    await expect(
      runAuthoringPrompt(new DisabledAiModelAdapter(), createPromptRequest())
    ).rejects.toThrow('AI runtime is disabled until a model adapter is injected.')
  })

  it('accepts authoring-only prompt requests', () => {
    const request = createPromptRequest()

    expect(validateAuthoringPromptRequest(request)).toMatchObject(request)
  })

  it('rejects malformed prompt request inputs with boundary errors', () => {
    expect(() => validateAuthoringPromptRequest(null)).toThrow(
      'Prompt request must be an object.'
    )
    expect(() => validateAuthoringPromptRequest({})).toThrow(
      'Prompt request id is required.'
    )
    expect(() =>
      validateAuthoringPromptRequest({
        ...createPromptRequest(),
        messages: undefined
      })
    ).toThrow('Prompt request messages must be an array.')
  })

  it('rejects child-facing or sensitive prompt requests', () => {
    expect(() =>
      validateAuthoringPromptRequest(
        createPromptRequest({
          policy: {
            ...defaultPolicy,
            childFacingOutput: true
          }
        })
      )
    ).toThrow('AI prompt requests must not produce child-facing output.')

    expect(() =>
      validateAuthoringPromptRequest(
        createPromptRequest({
          policy: {
            ...defaultPolicy,
            requiresHumanReview: false
          }
        })
      )
    ).toThrow('AI prompt requests must require human review.')

    expect(() =>
      validateAuthoringPromptRequest(
        createPromptRequest({
          policy: {
            ...defaultPolicy,
            allowsPersonalChildData: true
          }
        })
      )
    ).toThrow('AI prompt requests must not allow personal child data.')

    expect(() =>
      validateAuthoringPromptRequest(
        createPromptRequest({
          policy: {
            ...defaultPolicy,
            dataClassification: 'sensitive_child_data'
          }
        })
      )
    ).toThrow('AI prompt requests must not include sensitive child data.')
  })

  it('rejects metadata that can carry child identifiers or free text', () => {
    expect(() =>
      validateAuthoringPromptRequest(
        createPromptRequest({
          metadata: {
            childName: 'Alex'
          }
        })
      )
    ).toThrow('Prompt metadata key childName may identify a child or session.')

    expect(() =>
      validateAuthoringPromptRequest(
        createPromptRequest({
          metadata: {
            contentItemId: 'This is a long free-text note about the prompt'
          }
        })
      )
    ).toThrow(
      'Prompt metadata contentItemId must be a compact identifier, not free text.'
    )

    expect(() =>
      validateAuthoringPromptRequest(
        createPromptRequest({
          metadata: {
            'Alex was upset after class': true
          }
        })
      )
    ).toThrow(
      'Prompt metadata key Alex was upset after class must be a compact identifier.'
    )
  })

  it('rejects persistent ids that can carry sensitive identifiers', () => {
    expect(() =>
      validateAuthoringPromptRequest({
        ...createPromptRequest(),
        id: 'child_alex_session_123'
      })
    ).toThrow('Prompt request id may identify a child or session.')

    expect(() =>
      createAiPromptRunRecord({
        request: createPromptRequest(),
        status: 'completed',
        output: {},
        recordId: 'ai_run_user_alex'
      })
    ).toThrow('AI prompt run record id may identify a child or session.')

    expect(() =>
      createAiCandidateArtifact({
        request: createPromptRequest(),
        kind: 'quest_candidate',
        content: {},
        artifactId: 'artifact_session_123'
      })
    ).toThrow('AI candidate artifact id may identify a child or session.')
  })

  it('rejects model spec fields that can carry persisted raw text', () => {
    expect(() =>
      validateAuthoringPromptRequest(
        createPromptRequest({
          model: {
            provider: 'provider error with raw prompt',
            model: 'none'
          }
        })
      )
    ).toThrow('AI model provider must be a compact identifier.')

    expect(() =>
      validateAuthoringPromptRequest(
        createPromptRequest({
          model: {
            provider: 'disabled',
            model: 'child_session_model'
          }
        })
      )
    ).toThrow('AI model name may identify a child or session.')
  })

  it('returns frozen validated requests before adapter execution', () => {
    const request = validateAuthoringPromptRequest(createPromptRequest())

    expect(Object.isFrozen(request)).toBe(true)
    expect(Object.isFrozen(request.messages)).toBe(true)
    expect(Object.isFrozen(request.messages[0])).toBe(true)
    expect(() => {
      request.messages[0].content = 'mutated child-facing output'
    }).toThrow()
  })

  it('records prompt runs without storing raw prompt, output, or metadata values', () => {
    const record = createAiPromptRunRecord({
      request: createPromptRequest({
        messages: [
          {
            role: 'system',
            content: 'Private authoring instruction for a SEL quest.'
          },
          {
            role: 'user',
            content: 'Generate a candidate scene about naming emotions.'
          }
        ],
        metadata: {
          contentItemId: 'emotion-detective',
          contentVersion: '1.0.0'
        }
      }),
      status: 'completed',
      output: {
        draft: 'Candidate scene text that still needs review.'
      },
      startedAt: '2026-06-10T00:00:00.000Z',
      completedAt: '2026-06-10T00:00:01.000Z',
      recordId: 'ai_run_test_001'
    })

    expect(record).toMatchObject({
      id: 'ai_run_test_001',
      requestId: 'prompt_001',
      purpose: 'content_generation',
      status: 'completed',
      metadataKeys: ['contentItemId', 'contentVersion']
    })
    expect(record.promptHash).toMatch(/^sha256_/)
    expect(record.outputHash).toMatch(/^sha256_/)
    expect(record.metadataHash).toMatch(/^sha256_/)
    expect(JSON.stringify(record)).not.toContain('Private authoring instruction')
    expect(JSON.stringify(record)).not.toContain('Candidate scene text')
    expect(JSON.stringify(record)).not.toContain('emotion-detective')
    expect(JSON.stringify(record)).not.toContain('1.0.0')
  })

  it('requires failed or blocked prompt runs to carry an error code only', () => {
    expect(() =>
      createAiPromptRunRecord({
        request: createPromptRequest(),
        status: 'blocked'
      })
    ).toThrow('Failed or blocked AI prompt runs must include an error code.')

    expect(() =>
      createAiPromptRunRecord({
        request: createPromptRequest(),
        status: 'failed',
        errorCode: 'provider error: raw prompt leaked' as never
      })
    ).toThrow('AI prompt run error code is invalid.')

    expect(() =>
      createAiPromptRunRecord({
        request: createPromptRequest(),
        status: 'failed',
        errorCode: 'provider_error',
        startedAt: 'not a timestamp',
        completedAt: '2026-06-10T00:00:01.000Z'
      })
    ).toThrow('AI prompt run start time must be an ISO timestamp.')

    const record = createAiPromptRunRecord({
      request: createPromptRequest(),
      status: 'failed',
      errorCode: 'provider_error',
      startedAt: '2026-06-10T00:00:00.000Z',
      completedAt: '2026-06-10T00:00:01.000Z'
    })

    expect(record.errorCode).toBe('provider_error')
    expect('errorMessage' in record).toBe(false)
  })

  it('creates candidate artifacts that must still pass validation and review', () => {
    const artifact = createAiCandidateArtifact({
      request: createPromptRequest(),
      kind: 'quest_candidate',
      content: {
        title: 'Emotion Detective candidate'
      },
      createdAt: '2026-06-10T00:00:00.000Z',
      artifactId: 'ai_candidate_001',
      noteCount: 1
    })

    expect(artifact).toMatchObject({
      id: 'ai_candidate_001',
      requestId: 'prompt_001',
      status: 'candidate',
      childFacingOutput: false,
      requiresValidation: true,
      requiresExpertReview: true,
      noteCount: 1
    })
    expect(artifact.contentHash).toMatch(/^sha256_/)
    expect(JSON.stringify(artifact)).not.toContain('Emotion Detective candidate')
  })

  it('rejects artifacts that try to bypass publication gates', () => {
    const artifact = createAiCandidateArtifact({
      request: createPromptRequest(),
      kind: 'refinement_candidate',
      content: {
        title: 'Refined candidate'
      }
    })

    expect(() =>
      validateAiCandidateArtifact({
        ...artifact,
        id: 'artifact_child_alex'
      })
    ).toThrow('AI candidate artifact id may identify a child or session.')

    expect(() =>
      validateAiCandidateArtifact({
        ...artifact,
        requestId: 'request_session_123'
      })
    ).toThrow('AI candidate artifact request id may identify a child or session.')

    expect(() =>
      validateAiCandidateArtifact({
        ...artifact,
        createdAt: 'today'
      })
    ).toThrow('AI candidate artifact creation time must be an ISO timestamp.')

    expect(() =>
      validateAiCandidateArtifact({
        ...artifact,
        contentHash: 'Raw candidate text'
      })
    ).toThrow(
      'AI candidate artifact content hash is required. Expected sha256 content hash.'
    )

    expect(() =>
      validateAiCandidateArtifact({
        ...artifact,
        childFacingOutput: true
      })
    ).toThrow('AI candidate artifacts must not be child-facing output.')

    expect(() =>
      validateAiCandidateArtifact({
        ...artifact,
        requiresValidation: false
      })
    ).toThrow('AI candidate artifacts must require validation evidence.')

    expect(() =>
      validateAiCandidateArtifact({
        ...artifact,
        status: 'published'
      } as AiCandidateArtifact)
    ).toThrow('AI artifacts must remain candidates until publication.')
  })
})

const defaultPolicy: AiPromptRequest['policy'] = {
  audience: 'authoring_team',
  childFacingOutput: false,
  requiresHumanReview: true,
  allowsPersonalChildData: false,
  dataClassification: 'internal_authoring'
}

function createPromptRequest(
  overrides: Partial<AiPromptRequest> = {}
): AiPromptRequest {
  return {
    id: 'prompt_001',
    purpose: 'content_generation',
    model: {
      provider: 'disabled',
      model: 'none'
    },
    messages: [
      {
        role: 'system',
        content: 'Generate candidate content for expert review only.'
      }
    ],
    policy: defaultPolicy,
    ...overrides
  }
}

import { deepStrictEqual } from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateSelQuestContent } from '@sel-quest/content-validation'
import { createContentBundleHash } from '@sel-quest/content-authoring'
import {
  validateAssetManifest,
  validateAssetManifestSemantics,
  validateWorldAssetReferences
} from '@sel-quest/asset-pipeline'
import {
  validateNarrativeDefinition,
  validateNarrativeSemantics,
  validateNarrativeReferences
} from '@sel-quest/narrative-core'
import {
  validateWorldBindingReference,
  validateWorldDefinition,
  validateWorldSemantics
} from '@sel-quest/world-core'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const contentRoot = path.resolve(scriptDir, '..')

export const questsRoot = process.env.CONTENT_QUESTS_ROOT
  ? path.resolve(process.env.CONTENT_QUESTS_ROOT)
  : path.join(contentRoot, 'src', 'quests')

const questSlugPattern = /^[a-z0-9][a-z0-9-]*$/
export const deterministicBaselineValidatorId = 'rule.sel_content_baseline'
export const deterministicSupplementalValidatorId =
  'rule.supplemental_content_evidence'

export function getPositionals(args) {
  return args.filter((arg) => !arg.startsWith('--'))
}

export function getQuestSlugArg(args, usage) {
  const slug = getPositionals(args)[0]

  if (!slug) {
    console.error(usage)
    process.exit(1)
  }

  assertValidQuestSlug(slug)
  return slug
}

export function assertValidQuestSlug(slug) {
  if (!questSlugPattern.test(slug)) {
    throw new Error(
      `invalid quest slug "${slug}"; expected lowercase letters, numbers, and hyphens`
    )
  }
}

export function getQuestDir(slug) {
  assertValidQuestSlug(slug)
  return path.join(questsRoot, slug)
}

export async function getRequestedQuestDirs(args) {
  const slugs = getPositionals(args)

  if (slugs.length > 0) {
    return slugs.map((slug) => ({
      slug,
      questDir: getQuestDir(slug)
    }))
  }

  return listQuestDirs()
}

export function assertQuestDirectorySlug(quest, slug) {
  if (quest.slug !== slug) {
    throw new Error(
      `quest slug "${quest.slug}" does not match quest directory "${slug}"`
    )
  }
}

export async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'))
  } catch (error) {
    if (error?.code === 'ENOENT') return null
    throw error
  }
}

export async function readSupplementalContentJson(questDir) {
  return {
    worldJson: await readJsonIfExists(path.join(questDir, 'world.json')),
    narrativeJson: await readJsonIfExists(path.join(questDir, 'narrative.json')),
    assetManifestJson: await readJsonIfExists(
      path.join(questDir, 'asset-manifest.json')
    )
  }
}

export function getContentBundleHash(quest, supplementalContent = {}) {
  const supplementalValidation = validateSupplementalContentForReport(
    quest,
    supplementalContent
  )

  return createContentBundleHash({
    quest,
    world: supplementalValidation.hashInput.world,
    narrative: supplementalValidation.hashInput.narrative,
    assetManifest: supplementalValidation.hashInput.assetManifest
  })
}

export function createContentBundleValidationReport(
  quest,
  supplementalContent = {},
  options = {}
) {
  const supplementalValidation = validateSupplementalContentForReport(
    quest,
    supplementalContent
  )
  const report = validateSelQuestContent(quest, {
    ...options,
    contentHash: createContentBundleHash({
      quest,
      world: supplementalValidation.hashInput.world,
      narrative: supplementalValidation.hashInput.narrative,
      assetManifest: supplementalValidation.hashInput.assetManifest
    })
  })

  return mergeSupplementalValidationIntoReport(
    report,
    supplementalValidation.issues
  )
}

export function getValidationReportDriftIssues(
  quest,
  report,
  supplementalContent = {}
) {
  const expectedReport = normalizeJson(
    createContentBundleValidationReport(quest, supplementalContent, {
      now: () => report.createdAt,
      reportId: report.id
    })
  )
  const actualBaselineValidator = report.validators.find(
    (validator) => validator.validatorId === deterministicBaselineValidatorId
  )
  const actualSupplementalValidator = report.validators.find(
    (validator) => validator.validatorId === deterministicSupplementalValidatorId
  )
  const expectedBaselineValidator = expectedReport.validators.find(
    (validator) => validator.validatorId === deterministicBaselineValidatorId
  )
  const expectedSupplementalValidator = expectedReport.validators.find(
    (validator) => validator.validatorId === deterministicSupplementalValidatorId
  )

  if (
    !actualBaselineValidator ||
    !actualSupplementalValidator ||
    !expectedBaselineValidator ||
    !expectedSupplementalValidator
  ) {
    return ['validation report does not match deterministic validator output']
  }

  try {
    deepStrictEqual(
      toDeterministicReportProjection(
        report,
        actualBaselineValidator,
        actualSupplementalValidator
      ),
      toDeterministicReportProjection(
        expectedReport,
        expectedBaselineValidator,
        expectedSupplementalValidator
      )
    )
    return []
  } catch {
    return ['validation report does not match deterministic validator output']
  }
}

export function mergeDeterministicBaselineReport(existingReport, baselineReport) {
  const extraValidators = Array.isArray(existingReport?.validators)
    ? existingReport.validators.filter(
        (validator) =>
          validator?.validatorId !== deterministicBaselineValidatorId &&
          validator?.validatorId !== deterministicSupplementalValidatorId
      )
    : []

  return {
    ...baselineReport,
    validators: [...baselineReport.validators, ...extraValidators]
  }
}

export function printValidationReportDrift(slug, issues) {
  console.error(`${slug}: validation report is out of date`)
  for (const issue of issues) {
    console.error(`- ${issue}`)
  }
  console.error(`- run npm run content:validate -- ${slug}`)
}

export function getBlockingIssueCount(report) {
  return report.issues.filter((issue) => issue.blocksPublishing).length
}

export function normalizeJson(value) {
  if (value === undefined) return undefined
  return JSON.parse(JSON.stringify(value))
}

function validateSupplementalContentForReport(quest, supplementalContent = {}) {
  const issues = []
  let world = null
  let narrative = null
  let assetManifest = null

  if (supplementalContent.worldJson != null) {
    const result = parseSupplementalDefinition({
      quest,
      source: 'world',
      value: supplementalContent.worldJson
    })
    world = result.value
    issues.push(...result.issues)
    if (world) {
      issues.push(
        ...validateWorldSemantics(world).map((issue) =>
          createSupplementalIssueFromValidationIssue({
            quest,
            source: 'world',
            issue
          })
        )
      )
    }
  }

  if (supplementalContent.narrativeJson != null) {
    const result = parseSupplementalDefinition({
      quest,
      source: 'narrative',
      value: supplementalContent.narrativeJson
    })
    narrative = result.value
    issues.push(...result.issues)
    if (narrative) {
      issues.push(
        ...validateNarrativeSemantics(narrative).map((issue) =>
          createSupplementalIssueFromValidationIssue({
            quest,
            source: 'narrative',
            issue
          })
        )
      )
    }
  }

  if (supplementalContent.assetManifestJson != null) {
    const result = parseSupplementalDefinition({
      quest,
      source: 'assetManifest',
      value: supplementalContent.assetManifestJson
    })
    assetManifest = result.value
    issues.push(...result.issues)
    if (assetManifest) {
      issues.push(
        ...validateAssetManifestSemantics(assetManifest).map((issue) =>
          createSupplementalIssueFromValidationIssue({
            quest,
            source: 'assetManifest',
            issue
          })
        )
      )
    }
  }

  if (quest) {
    issues.push(
      ...validateSupplementalReferences({
        quest,
        world,
        narrative,
        assetManifest,
        hasWorldJson: supplementalContent.worldJson != null,
        hasNarrativeJson: supplementalContent.narrativeJson != null,
        hasAssetManifestJson: supplementalContent.assetManifestJson != null
      })
    )
  }

  return {
    normalized: { world, narrative, assetManifest },
    hashInput: {
      world: world ?? supplementalContent.worldJson ?? null,
      narrative: narrative ?? supplementalContent.narrativeJson ?? null,
      assetManifest: assetManifest ?? supplementalContent.assetManifestJson ?? null
    },
    issues: issues.map((issue, index) => ({
      ...issue,
      id: `issue_supplemental_${String(index + 1).padStart(3, '0')}`
    }))
  }
}

function parseSupplementalDefinition(input) {
  try {
    if (input.source === 'world') {
      return { value: validateWorldDefinition(input.value), issues: [] }
    }

    if (input.source === 'narrative') {
      return { value: validateNarrativeDefinition(input.value), issues: [] }
    }

    return { value: validateAssetManifest(input.value), issues: [] }
  } catch (error) {
    return {
      value: null,
      issues: createSupplementalIssuesFromError({
        quest: input.quest,
        source: input.source,
        error
      })
    }
  }
}

function validateSupplementalReferences(input) {
  const issues = []

  if (input.quest.worldBinding && !input.hasWorldJson) {
    issues.push(
      createSupplementalIssue({
        quest: input.quest,
        source: 'world',
        path: 'world.json',
        code: 'missing_world_json',
        message: 'Quest declares worldBinding without world.json.'
      })
    )
  }

  if (input.quest.worldBinding && input.world) {
    issues.push(
      ...validateWorldBindingReference(input.quest.worldBinding, input.world).map(
        (issue) =>
          createSupplementalIssue({
            quest: input.quest,
            source: 'quest',
            path: issue.path,
            code: issue.code,
            message: issue.message
          })
      )
    )
  }

  if (input.world?.assetManifestId && !input.hasAssetManifestJson) {
    issues.push(
      createSupplementalIssue({
        quest: input.quest,
        source: 'assetManifest',
        path: 'asset-manifest.json',
        code: 'missing_asset_manifest_json',
        message: 'World declares assetManifestId without asset-manifest.json.'
      })
    )
  }

  if (!input.world?.assetManifestId && input.hasAssetManifestJson) {
    issues.push(
      createSupplementalIssue({
        quest: input.quest,
        source: 'assetManifest',
        path: 'asset-manifest.json',
        code: 'unexpected_asset_manifest_json',
        message: 'asset-manifest.json exists but world.json has no assetManifestId.'
      })
    )
  }

  if (input.world?.assetManifestId && input.assetManifest) {
    if (input.assetManifest.id !== input.world.assetManifestId) {
      issues.push(
        createSupplementalIssue({
          quest: input.quest,
          source: 'assetManifest',
          path: 'assetManifestId',
          code: 'asset_manifest_id_mismatch',
          message: 'World assetManifestId does not match the asset manifest id.'
        })
      )
    }

    issues.push(
      ...validateWorldAssetReferences(input.world, input.assetManifest).map(
        (issue) =>
          createSupplementalIssue({
            quest: input.quest,
            source: 'assetManifest',
            path: issue.path,
            code: issue.code,
            message: issue.message,
            severity: issue.severity
          })
      )
    )
  }

  if (input.quest.episodeIds?.length && !input.hasNarrativeJson) {
    issues.push(
      createSupplementalIssue({
        quest: input.quest,
        source: 'narrative',
        path: 'narrative.json',
        code: 'missing_narrative_json',
        message: 'Quest declares episodeIds without narrative.json.'
      })
    )
  }

  if (!input.narrative) return issues

  issues.push(
    ...validateNarrativeReferences(input.narrative, {
      questId: input.quest.id,
      episodeIds: input.quest.episodeIds,
      activityIds: input.quest.activities.map((activity) => activity.id),
      learningObjectiveIds: input.quest.learningObjectives.map(
        (objective) => objective.id
      ),
      worldZoneIds: input.world?.zones.map((zone) => zone.id) ?? [],
      sceneIds: input.world?.scenes.map((scene) => scene.id) ?? [],
      interactableIds:
        input.world?.interactables.map((interactable) => interactable.id) ?? [],
      characterIds: input.world?.characters.map((character) => character.id) ?? []
    }).map((issue) =>
      createSupplementalIssue({
        quest: input.quest,
        source: 'narrative',
        path: issue.path,
        code: issue.code,
        message: issue.message,
        severity: issue.severity
      })
    )
  )

  return issues
}

function mergeSupplementalValidationIntoReport(report, supplementalIssues) {
  if (supplementalIssues.length === 0) {
    return {
      ...report,
      validators: [
        ...report.validators,
        createSupplementalValidatorRun(report, supplementalIssues)
      ]
    }
  }

  const issues = [...report.issues, ...supplementalIssues]
  const status = deriveReportStatus(issues)

  return {
    ...report,
    status,
    validators: [
      ...report.validators,
      createSupplementalValidatorRun(report, supplementalIssues)
    ],
    issues,
    summary: {
      overallRisk: deriveReportRisk(issues),
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
    }
  }
}

function createSupplementalValidatorRun(report, issues) {
  const status =
    issues.length === 0
      ? 'passed'
      : issues.some((issue) => issue.blocksPublishing)
        ? 'failed'
        : 'flagged'

  return {
    id: `run_${report.contentItemId}_${report.contentVersion}_supplemental`,
    validatorId: deterministicSupplementalValidatorId,
    validatorType: 'rule',
    status,
    startedAt: report.createdAt,
    completedAt: report.createdAt,
    summary:
      issues.length === 0
        ? 'Supplemental content evidence validation passed.'
        : `Supplemental content evidence validation found ${issues.length} issue(s).`
  }
}

function createSupplementalIssuesFromError(input) {
  if (Array.isArray(input.error?.issues)) {
    return input.error.issues.map((issue) =>
      createSupplementalIssue({
        quest: input.quest,
        source: input.source,
        path: Array.isArray(issue.path)
          ? issue.path.join('.')
          : issue.path ?? input.source,
        code: issue.code ?? 'schema',
        message: issue.message ?? 'Supplemental content is invalid.',
        severity: issue.severity
      })
    )
  }

  return [
    createSupplementalIssue({
      quest: input.quest,
      source: input.source,
      path: input.source,
      code: 'invalid_supplemental_content',
      message: input.error?.message ?? String(input.error)
    })
  ]
}

function createSupplementalIssueFromValidationIssue(input) {
  return createSupplementalIssue({
    quest: input.quest,
    source: input.source,
    path: input.issue.path,
    code: input.issue.code,
    message: input.issue.message,
    severity: input.issue.severity
  })
}

function createSupplementalIssue(input) {
  const severity = input.severity === 'warning' ? 'minor' : 'major'

  return {
    id: 'issue_supplemental_pending',
    severity,
    type: 'ambiguous_scenario',
    location: createSupplementalIssueLocation({
      questId: input.quest?.id ?? 'unknown_quest',
      source: input.source,
      path: input.path
    }),
    explanation: `[${input.code}] ${input.message}`,
    suggestedFix: 'Fix the referenced supplemental content evidence and rerun content validation.',
    blocksPublishing: severity !== 'minor'
  }
}

function createSupplementalIssueLocation(input) {
  const fieldPath =
    input.source === 'quest'
      ? input.path
      : input.path
        ? `${input.source}.${input.path}`
        : input.source
  const location = {
    questId: input.questId,
    fieldPath
  }
  const parts = input.path.split('.')

  if (input.source === 'world') {
    location.worldId = idFromPath(parts, 'id')
    location.zoneId = idAfter(parts, 'zones')
    location.sceneId = idAfter(parts, 'scenes')
    location.characterId = idAfter(parts, 'characters')
    location.interactableId = idAfter(parts, 'interactables')
  }

  if (input.source === 'narrative') {
    location.narrativeId = idFromPath(parts, 'id')
    location.episodeId = idAfter(parts, 'episodes')
    location.beatId = idAfter(parts, 'beats')
    location.dialogueId = idAfter(parts, 'dialogues')
    location.cutsceneId = idAfter(parts, 'cutscenes')
  }

  if (input.source === 'assetManifest') {
    location.assetId = idAfter(parts, 'assets')
  }

  return Object.fromEntries(
    Object.entries(location).filter(([, value]) => value != null)
  )
}

function idAfter(parts, key) {
  const index = parts.indexOf(key)
  return index >= 0 ? parts[index + 1] : undefined
}

function idFromPath(parts, key) {
  return parts[0] === key ? parts[1] : undefined
}

function deriveReportStatus(issues) {
  if (issues.some((issue) => issue.severity === 'critical')) return 'blocked'
  if (issues.some((issue) => issue.severity === 'major')) {
    return 'needs_major_revision'
  }
  if (issues.length > 0) return 'needs_minor_revision'
  return 'passed'
}

function deriveReportRisk(issues) {
  if (issues.some((issue) => issue.severity === 'critical')) return 'critical'
  if (issues.some((issue) => issue.severity === 'major')) return 'high'
  if (issues.length > 0) return 'medium'
  return 'low'
}

function toDeterministicReportProjection(
  report,
  baselineValidator,
  supplementalValidator
) {
  return normalizeJson({
    id: report.id,
    contentItemId: report.contentItemId,
    contentVersion: report.contentVersion,
    contentHash: report.contentHash,
    status: report.status,
    validators: [baselineValidator, supplementalValidator],
    issues: report.issues,
    summary: report.summary,
    createdAt: report.createdAt
  })
}

async function listQuestDirs() {
  const entries = await readdir(questsRoot, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      slug: entry.name,
      questDir: getQuestDir(entry.name)
    }))
    .sort((left, right) => left.slug.localeCompare(right.slug))
}

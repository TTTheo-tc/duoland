import { deepStrictEqual } from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateSelQuestContent } from '@sel-quest/content-validation'
import {
  assertAssetManifestReference,
  assertWorldAssetReferences,
  validateAssetManifest
} from '@sel-quest/asset-pipeline'
import {
  assertNarrativeReferences,
  validateNarrativeDefinition
} from '@sel-quest/narrative-core'
import {
  assertWorldBindingReference,
  validateWorldDefinition
} from '@sel-quest/world-core'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const contentRoot = path.resolve(scriptDir, '..')

export const questsRoot = process.env.CONTENT_QUESTS_ROOT
  ? path.resolve(process.env.CONTENT_QUESTS_ROOT)
  : path.join(contentRoot, 'src', 'quests')

const questSlugPattern = /^[a-z0-9][a-z0-9-]*$/
export const deterministicBaselineValidatorId = 'rule.sel_content_baseline'

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

export function getValidationReportDriftIssues(quest, report) {
  const expectedReport = normalizeJson(
    validateSelQuestContent(quest, {
      now: () => report.createdAt,
      reportId: report.id
    })
  )
  const actualBaselineValidator = report.validators.find(
    (validator) => validator.validatorId === deterministicBaselineValidatorId
  )

  if (!actualBaselineValidator) {
    return ['validation report does not match deterministic validator output']
  }

  try {
    deepStrictEqual(
      toDeterministicBaselineProjection(report, actualBaselineValidator),
      toDeterministicBaselineProjection(
        expectedReport,
        expectedReport.validators[0]
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
          validator?.validatorId !== deterministicBaselineValidatorId
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

export function assertSupplementalContentEvidence(
  quest,
  worldJson,
  narrativeJson,
  assetManifestJson
) {
  const world = worldJson ? validateWorldDefinition(worldJson) : null
  const narrative = narrativeJson ? validateNarrativeDefinition(narrativeJson) : null

  if (quest.worldBinding && !world) {
    throw new Error('quest declares worldBinding without world.json')
  }

  if (quest.worldBinding && world) {
    assertWorldBindingReference(quest.worldBinding, world)
  }

  if (world?.assetManifestId && !assetManifestJson) {
    throw new Error('world declares assetManifestId without asset-manifest.json')
  }

  if (!world?.assetManifestId && assetManifestJson) {
    throw new Error('asset-manifest.json exists but world.json has no assetManifestId')
  }

  if (world?.assetManifestId && assetManifestJson) {
    const assetManifest = validateAssetManifest(assetManifestJson)
    assertAssetManifestReference(assetManifest, world.assetManifestId)
    assertWorldAssetReferences(world, assetManifest)
  }

  if (quest.episodeIds?.length && !narrative) {
    throw new Error('quest declares episodeIds without narrative.json')
  }

  if (!narrative) return

  assertNarrativeReferences(narrative, {
    questId: quest.id,
    episodeIds: quest.episodeIds,
    activityIds: quest.activities.map((activity) => activity.id),
    learningObjectiveIds: quest.learningObjectives.map(
      (objective) => objective.id
    ),
    worldZoneIds: world?.zones.map((zone) => zone.id) ?? [],
    sceneIds: world?.scenes.map((scene) => scene.id) ?? [],
    interactableIds:
      world?.interactables.map((interactable) => interactable.id) ?? [],
    characterIds: world?.characters.map((character) => character.id) ?? []
  })
}

export function structuredErrorMessages(error) {
  if (Array.isArray(error?.issues)) {
    return error.issues.map((issue) => {
      const severity = issue.severity ?? 'schema'
      const path = Array.isArray(issue.path) ? issue.path.join('.') : issue.path
      return `${severity}: ${issue.code} at ${path}`
    })
  }

  return [error?.message ?? String(error)]
}

function toDeterministicBaselineProjection(report, baselineValidator) {
  return normalizeJson({
    id: report.id,
    contentItemId: report.contentItemId,
    contentVersion: report.contentVersion,
    contentHash: report.contentHash,
    status: report.status,
    validators: [baselineValidator],
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

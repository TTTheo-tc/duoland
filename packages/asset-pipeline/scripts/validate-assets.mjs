import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  assertAssetManifestReference,
  assertWorldAssetReferences,
  validateAssetManifest
} from '@sel-quest/asset-pipeline'
import { validateWorldDefinition } from '@sel-quest/world-core'
import { ZodError } from 'zod'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..', '..', '..')
const questsRoot = process.env.CONTENT_QUESTS_ROOT
  ? path.resolve(process.env.CONTENT_QUESTS_ROOT)
  : path.join(repoRoot, 'packages', 'content', 'src', 'quests')

const requestedSlugs = process.argv.slice(2)
const questDirs =
  requestedSlugs.length > 0
    ? requestedSlugs.map((slug) => ({ slug, questDir: getQuestDir(slug) }))
    : await listQuestDirs()

let hasFailure = false

for (const { slug, questDir } of questDirs) {
  try {
    await readJsonRequired(path.join(questDir, 'quest.json'))
    const worldJson = await readJsonIfExists(path.join(questDir, 'world.json'))
    const manifest = await readJsonIfExists(
      path.join(questDir, 'asset-manifest.json')
    )
    const world = worldJson ? validateWorldDefinition(worldJson) : null

    if (world?.assetManifestId && !manifest) {
      throw new Error('world declares assetManifestId without asset-manifest.json')
    }

    if (!world?.assetManifestId && !manifest) {
      console.log(`${slug}: no asset manifest`)
      continue
    }

    if (!world?.assetManifestId && manifest) {
      throw new Error('asset-manifest.json exists but world.json has no assetManifestId')
    }

    const validatedManifest = validateAssetManifest(manifest)
    assertAssetManifestReference(validatedManifest, world.assetManifestId)
    assertWorldAssetReferences(world, validatedManifest)
    console.log(`${slug}: asset manifest valid (${validatedManifest.assets.length} asset(s))`)
  } catch (error) {
    hasFailure = true
    console.error(`${slug}: asset manifest invalid`)

    if (error instanceof ZodError) {
      for (const issue of error.issues) {
        console.error(`- schema: ${issue.code} at ${issue.path.join('.')}`)
      }
    } else if (Array.isArray(error?.issues)) {
      for (const issue of error.issues) {
        const severity = issue.severity ?? 'schema'
        const path = Array.isArray(issue.path) ? issue.path.join('.') : issue.path
        console.error(`- ${severity}: ${issue.code} at ${path}`)
      }
    } else {
      console.error(`- ${error?.message ?? String(error)}`)
    }
  }
}

if (hasFailure) {
  process.exitCode = 1
}

function getQuestDir(slug) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
    throw new Error(
      `invalid quest slug "${slug}"; expected lowercase letters, numbers, and hyphens`
    )
  }

  return path.join(questsRoot, slug)
}

async function listQuestDirs() {
  const entries = await readdir(questsRoot, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({ slug: entry.name, questDir: getQuestDir(entry.name) }))
    .sort((left, right) => left.slug.localeCompare(right.slug))
}

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'))
  } catch (error) {
    if (error?.code === 'ENOENT') return null
    throw error
  }
}

async function readJsonRequired(filePath) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'))
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new Error(`required file does not exist: ${filePath}`)
    }
    throw error
  }
}

import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const sourceExtensions = new Set([
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx'
])

const skippedDirectories = new Set([
  '.next',
  'coverage',
  'dist',
  'node_modules',
  'storybook-static'
])

const ruleSets = [
  {
    name: 'AI runtime stays out of child-facing runtime and renderers',
    roots: [
      'apps/web',
      'packages/activities',
      'packages/game-runtime',
      'packages/narrative-core',
      'packages/persistence',
      'packages/quest-core',
      'packages/renderer-phaser',
      'packages/renderer-r3f',
      'packages/safety',
      'packages/world-core'
    ],
    forbiddenReferences: ['@sel-quest/ai-runtime']
  },
  {
    name: 'Web-loaded content and authoring facades stay AI-free until Studio is split',
    roots: [
      'packages/content',
      'packages/content-authoring',
      'packages/content-refinement'
    ],
    forbiddenReferences: ['@sel-quest/ai-runtime']
  },
  {
    name: 'Studio app stays separate from child runtime and renderers',
    roots: ['apps/studio'],
    forbiddenImports: [
      '@sel-quest/activities',
      '@sel-quest/ai-runtime',
      '@sel-quest/game-runtime',
      '@sel-quest/persistence',
      '@sel-quest/renderer-phaser',
      '@sel-quest/renderer-r3f',
      '@sel-quest/safety',
      'phaser',
      'three'
    ]
  },
  {
    name: 'Core and authoring packages stay renderer-independent',
    roots: [
      'packages/ai-runtime',
      'packages/asset-pipeline',
      'packages/content',
      'packages/content-authoring',
      'packages/content-refinement',
      'packages/content-validation',
      'packages/narrative-core',
      'packages/quest-core',
      'packages/review-core',
      'packages/validator-evaluation',
      'packages/world-core'
    ],
    forbiddenImports: [
      '@react-three/fiber',
      '@sel-quest/renderer-phaser',
      '@sel-quest/renderer-r3f',
      'next',
      'phaser',
      'react',
      'react-dom',
      'three'
    ]
  },
  {
    name: 'Renderers do not own persistence, content, or AI authoring',
    roots: ['packages/renderer-phaser', 'packages/renderer-r3f'],
    forbiddenImports: [
      '@sel-quest/ai-runtime',
      '@sel-quest/content',
      '@sel-quest/content-authoring',
      '@sel-quest/content-refinement',
      '@sel-quest/persistence'
    ]
  }
]

const violations = []

for (const ruleSet of ruleSets) {
  for (const root of ruleSet.roots) {
    for (const filePath of listSourceFiles(path.join(repoRoot, root))) {
      const source = readFileSync(filePath, 'utf8')
      const relativePath = path.relative(repoRoot, filePath)

      for (const forbiddenReference of ruleSet.forbiddenReferences ?? []) {
        if (source.includes(forbiddenReference)) {
          violations.push({
            rule: ruleSet.name,
            filePath: relativePath,
            reference: forbiddenReference
          })
        }
      }

      const imports = listImports(source)
      for (const forbiddenImport of ruleSet.forbiddenImports ?? []) {
        if (imports.some((specifier) => matchesImport(specifier, forbiddenImport))) {
          violations.push({
            rule: ruleSet.name,
            filePath: relativePath,
            reference: forbiddenImport
          })
        }
      }
    }
  }
}

if (violations.length > 0) {
  console.error('Boundary validation failed:')
  for (const violation of violations) {
    console.error(
      `- ${violation.rule}: ${violation.filePath} references ${violation.reference}`
    )
  }
  process.exit(1)
}

console.log('Boundary validation passed')

function listSourceFiles(root) {
  if (!statExists(root)) return []

  const files = []
  const entries = readdirSync(root)
  for (const entry of entries) {
    if (skippedDirectories.has(entry)) continue

    const entryPath = path.join(root, entry)
    const stat = statSync(entryPath)
    if (stat.isDirectory()) {
      files.push(...listSourceFiles(entryPath))
      continue
    }

    if (sourceExtensions.has(path.extname(entryPath))) {
      files.push(entryPath)
    }
  }

  return files
}

function statExists(target) {
  try {
    statSync(target)
    return true
  } catch {
    return false
  }
}

function listImports(source) {
  const specifiers = []
  const importPattern =
    /(?:from\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]|import\s*\(\s*(?:\/\*[\s\S]*?\*\/\s*)*['"]([^'"]+)['"](?:\s*,[^)]*)?\s*\)|require\s*\(\s*['"]([^'"]+)['"]\s*\))/g
  let match = importPattern.exec(source)

  while (match) {
    specifiers.push(match[1] ?? match[2] ?? match[3] ?? match[4])
    match = importPattern.exec(source)
  }

  return specifiers
}

function matchesImport(specifier, forbiddenImport) {
  return (
    specifier === forbiddenImport || specifier.startsWith(`${forbiddenImport}/`)
  )
}

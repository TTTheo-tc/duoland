import { execFile } from 'node:child_process'
import { mkdtemp, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { describe, expect, it } from 'vitest'

const execFileAsync = promisify(execFile)
const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
)

describe('validator evaluation command', () => {
  it('passes when gold cases meet thresholds', async () => {
    const goldRoot = await writeGoldCases([
      {
        id: 'critical_no_safe',
        title: 'Missing safe response',
        mutation: 'scenario_without_safe_choice',
        expectedIssueTypes: ['no_safe_response_option'],
        expectedSeverity: 'critical'
      }
    ])

    const result = await runEvaluate(goldRoot)

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('validator gold cases: 1/1 passed')
  })

  it('fails when a gold case expectation is missed', async () => {
    const goldRoot = await writeGoldCases([
      {
        id: 'wrong_expectation',
        title: 'Wrong expectation',
        mutation: 'none',
        expectedIssueTypes: ['privacy_sensitive_prompt'],
        expectedSeverity: 'major'
      }
    ])

    const result = await runEvaluate(goldRoot)

    expect(result.exitCode).not.toBe(0)
    expect(result.stderr).toContain('gold case(s) failed')
    expect(result.stderr).toContain('case wrong_expectation failed')
  })

  it('fails for invalid threshold environment values', async () => {
    const goldRoot = await writeGoldCases([
      {
        id: 'critical_no_safe',
        title: 'Missing safe response',
        mutation: 'scenario_without_safe_choice',
        expectedIssueTypes: ['no_safe_response_option'],
        expectedSeverity: 'critical'
      }
    ])

    const result = await runEvaluate(goldRoot, {
      VALIDATOR_MIN_MAJOR_RECALL: 'abc'
    })

    expect(result.exitCode).not.toBe(0)
    expect(result.stderr).toContain('VALIDATOR_MIN_MAJOR_RECALL')
  })
})

async function writeGoldCases(cases: unknown[]) {
  const goldRoot = await mkdtemp(path.join(os.tmpdir(), 'validator-gold-'))
  await writeFile(
    path.join(goldRoot, 'cases.jsonl'),
    `${cases.map((testCase) => JSON.stringify(testCase)).join('\n')}\n`
  )
  return goldRoot
}

async function runEvaluate(goldRoot: string, env: Record<string, string> = {}) {
  try {
    const result = await execFileAsync(process.execPath, [
      path.join(packageRoot, 'scripts', 'evaluate-validators.mjs')
    ], {
      cwd: packageRoot,
      env: {
        ...process.env,
        VALIDATOR_GOLD_ROOT: goldRoot,
        ...env
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

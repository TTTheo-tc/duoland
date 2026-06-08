import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FlatCompat } from '@eslint/eslintrc'

const __dirname = dirname(fileURLToPath(import.meta.url))
const compat = new FlatCompat({
  baseDirectory: __dirname
})

const eslintConfig = [
  {
    ignores: [
      '.next/**',
      'next-env.d.ts'
    ]
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@sel-quest/content/src/registry',
              message:
                'Use @sel-quest/content for published content or @sel-quest/content/preview for preview-only draft content.'
            }
          ],
          patterns: [
            {
              group: [
                '@sel-quest/content/src/*',
                '@sel-quest/content/registry',
                '**/packages/content/src/registry*'
              ],
              message:
                'Use @sel-quest/content for published content or @sel-quest/content/preview for preview-only draft content.'
            }
          ]
        }
      ]
    }
  }
]

export default eslintConfig

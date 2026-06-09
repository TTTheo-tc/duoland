import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: [
    '@sel-quest/asset-pipeline',
    '@sel-quest/content',
    '@sel-quest/content-authoring',
    '@sel-quest/narrative-core',
    '@sel-quest/quest-core',
    '@sel-quest/review-core',
    '@sel-quest/world-core'
  ]
}

export default nextConfig

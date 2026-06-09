import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: [
    '@sel-quest/quest-core',
    '@sel-quest/content',
    '@sel-quest/activities',
    '@sel-quest/persistence',
    '@sel-quest/game-runtime',
    '@sel-quest/renderer-phaser',
    '@sel-quest/safety',
    '@sel-quest/ai-runtime'
  ]
}

export default nextConfig

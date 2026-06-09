import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: [
    '@sel-quest/quest-core',
    '@sel-quest/content',
    '@sel-quest/activities',
    '@sel-quest/persistence',
    '@sel-quest/game-runtime',
    '@sel-quest/renderer-phaser',
    '@sel-quest/renderer-r3f',
    '@sel-quest/safety'
  ]
}

export default nextConfig

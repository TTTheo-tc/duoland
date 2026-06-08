'use client'

import { useEffect, useRef } from 'react'
import type { QuestDefinition } from '@sel-quest/quest-core'

export function PhaserCanvas({
  quest,
  currentStageId,
  completedStageIds
}: {
  quest: QuestDefinition
  currentStageId?: string
  completedStageIds: string[]
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const gameRef = useRef<unknown>(null)

  useEffect(() => {
    let disposed = false

    async function mountGame() {
      if (!containerRef.current || gameRef.current) return
      const Phaser = await import('phaser')
      if (disposed || !containerRef.current) return

      class QuestMapScene extends Phaser.Scene {
        create() {
          const width = this.scale.width
          this.add.rectangle(width / 2, 140, width - 40, 210, 0xf7f0de, 1)
            .setStrokeStyle(2, 0x243447)
          this.add.text(24, 28, '心情颜色小镇', {
            color: '#243447',
            fontFamily: 'Arial',
            fontSize: '22px',
            fontStyle: 'bold'
          })
          quest.stages.forEach((stage, index) => {
            const x = 58 + index * 58
            const y = 138 + (index % 2) * 26
            const isDone = completedStageIds.includes(stage.id)
            const isCurrent = currentStageId === stage.id
            const color = isCurrent ? 0x2563eb : isDone ? 0x16a34a : 0xffffff
            this.add.circle(x, y, isCurrent ? 20 : 17, color, 1)
              .setStrokeStyle(3, 0x243447)
            this.add.text(x - 10, y - 9, String(index + 1), {
              color: isCurrent || isDone ? '#ffffff' : '#243447',
              fontFamily: 'Arial',
              fontSize: '16px',
              fontStyle: 'bold'
            })
          })
        }
      }

      gameRef.current = new Phaser.Game({
        type: Phaser.AUTO,
        parent: containerRef.current,
        width: 420,
        height: 280,
        backgroundColor: '#d7f5ff',
        scene: QuestMapScene,
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH
        }
      })
    }

    mountGame()

    return () => {
      disposed = true
      if (gameRef.current) {
        ;(gameRef.current as { destroy: (removeCanvas: boolean) => void }).destroy(true)
        gameRef.current = null
      }
    }
  }, [completedStageIds, currentStageId, quest.stages])

  return (
    <section className="map-panel" aria-label="任务地图">
      <div ref={containerRef} className="phaser-container" />
      <ol className="map-fallback">
        {quest.stages.map((stage) => (
          <li
            key={stage.id}
            className={stage.id === currentStageId ? 'active' : undefined}
          >
            {stage.title}
          </li>
        ))}
      </ol>
    </section>
  )
}

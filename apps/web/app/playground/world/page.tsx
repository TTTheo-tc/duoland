import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getQuestWorldBySlug } from '@sel-quest/content'
import { getPreviewQuestBySlug } from '@sel-quest/content/preview'
import { R3FWorldCanvas } from '@sel-quest/renderer-r3f'

export default function WorldPlaygroundPage() {
  if (process.env.NODE_ENV === 'production') notFound()

  const quest = getPreviewQuestBySlug('emotion-detective')
  const world = getQuestWorldBySlug('emotion-detective')

  if (!quest || !world) {
    return (
      <main className="page-shell">
        <section className="loading-card">World unavailable.</section>
      </main>
    )
  }

  const entrySceneId = quest.worldBinding?.entrySceneId

  return (
    <main className="world-playground-shell">
      <section className="world-stage" aria-label="3D world playground">
        <R3FWorldCanvas
          world={world}
          sceneId={entrySceneId}
          preserveDrawingBuffer
        />
      </section>
      <aside className="world-side-panel">
        <Link href="/preview/quests/emotion-detective" className="secondary-button">
          返回任务
        </Link>
        <div>
          <p className="eyebrow">{quest.ageBand} · {quest.estimatedMinutes} 分钟</p>
          <h1>{world.title}</h1>
        </div>
        <dl className="world-facts">
          <div>
            <dt>World</dt>
            <dd>{world.id}</dd>
          </div>
          <div>
            <dt>Scene</dt>
            <dd>{entrySceneId}</dd>
          </div>
          <div>
            <dt>Episode</dt>
            <dd>{quest.episodeIds?.[0]}</dd>
          </div>
        </dl>
      </aside>
    </main>
  )
}

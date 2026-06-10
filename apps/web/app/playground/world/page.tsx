import { notFound } from 'next/navigation'
import { getQuestNarrativeBySlug, getQuestWorldBySlug } from '@sel-quest/content'
import { getPreviewQuestBySlug } from '@sel-quest/content/preview'
import { WorldPlaygroundRuntime } from '../../../src/features/world-playground/WorldPlaygroundRuntime'

export default function WorldPlaygroundPage() {
  if (process.env.NODE_ENV === 'production') notFound()

  const quest = getPreviewQuestBySlug('emotion-detective')
  const world = getQuestWorldBySlug('emotion-detective')
  const narrative = getQuestNarrativeBySlug('emotion-detective')

  if (!quest || !world || !narrative) {
    return (
      <main className="page-shell">
        <section className="loading-card">World unavailable.</section>
      </main>
    )
  }

  return <WorldPlaygroundRuntime quest={quest} world={world} narrative={narrative} />
}

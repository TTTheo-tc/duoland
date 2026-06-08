import Link from 'next/link'
import { listQuests } from '@sel-quest/content'

export default function QuestsPage() {
  const quests = listQuests()

  return (
    <main className="page-shell">
      <header className="page-header">
        <p className="eyebrow">Quest Library</p>
        <h1>任务列表</h1>
      </header>
      <div className="quest-list">
        {quests.map((quest) => (
          <article className="quest-card" key={quest.id}>
            <p className="quest-meta">{quest.ageBand} · 约 {quest.estimatedMinutes} 分钟</p>
            <h2>{quest.title}</h2>
            <p>{quest.description}</p>
            <Link className="primary-button" href={`/quests/${quest.slug}`}>
              进入任务
            </Link>
          </article>
        ))}
      </div>
    </main>
  )
}

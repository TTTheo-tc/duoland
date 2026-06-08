import Link from 'next/link'
import { listPublishableQuests } from '@sel-quest/content'

export default function QuestsPage() {
  const quests = listPublishableQuests()

  return (
    <main className="page-shell">
      <header className="page-header">
        <p className="eyebrow">Quest Library</p>
        <h1>任务列表</h1>
      </header>
      {quests.length > 0 ? (
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
      ) : (
        <section className="empty-state">
          <h2>暂无已发布任务</h2>
          <p>内容需要通过自动验证和专家审核后才会出现在公开任务列表中。</p>
        </section>
      )}
    </main>
  )
}

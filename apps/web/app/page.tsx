import Link from 'next/link'
import { listPublishableQuests } from '@sel-quest/content'

export default function HomePage() {
  const [quest] = listPublishableQuests()

  return (
    <main className="home-shell">
      <section className="home-hero" aria-labelledby="home-title">
        <div>
          <p className="eyebrow">SEL Quest Runtime MVP</p>
          <h1 id="home-title">情绪侦探任务平台</h1>
          <p className="hero-copy">
            一个用于儿童社会情绪学习和家校共育课程的游戏化任务原型。
          </p>
          <div className="hero-actions">
            {quest ? (
              <Link className="primary-button" href={`/quests/${quest.slug}`}>
                开始体验
              </Link>
            ) : (
              <span className="disabled-pill">暂无已发布任务</span>
            )}
            <Link className="secondary-button" href="/quests">
              查看任务
            </Link>
          </div>
        </div>
        <div className="home-preview" aria-hidden="true">
          <div className="preview-orbit">
            <span>观察</span>
            <span>选择</span>
            <span>练习</span>
            <span>总结</span>
          </div>
        </div>
      </section>
    </main>
  )
}

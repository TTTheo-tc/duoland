import { listAuthoringQuestSummaries } from '@sel-quest/content'

const playAppUrl = process.env.NEXT_PUBLIC_PLAY_APP_URL ?? 'http://127.0.0.1:3000'

export default function StudioHomePage() {
  const summaries = listAuthoringQuestSummaries()

  return (
    <main className="studio-shell">
      <header className="studio-header">
        <div>
          <p className="eyebrow">Duoland Studio</p>
          <h1>内容生产与审核</h1>
        </div>
        <a className="secondary-button" href={playAppUrl}>
          打开儿童端
        </a>
      </header>

      <dl className="summary-strip" aria-label="内容总览">
        <Metric label="内容条目" value={summaries.length} />
        <Metric
          label="可发布"
          value={summaries.filter((summary) => summary.publishabilityReasons.length === 0).length}
        />
        <Metric
          label="待专家审核"
          value={
            summaries.filter(
              (summary) => summary.authoringState === 'needs_expert_review'
            ).length
          }
        />
        <Metric
          label="阻断问题"
          value={summaries.reduce(
            (total, summary) => total + summary.blockingIssueCount,
            0
          )}
        />
      </dl>

      <section className="content-grid" aria-label="内容状态">
        {summaries.map((summary) => (
          <article className="content-row" key={summary.id}>
            <div className="row-main">
              <p className="quest-meta">
                {summary.slug} · v{summary.version}
              </p>
              <h2>{summary.title}</h2>
              <div className="status-line">
                <span className={`state-pill state-${summary.authoringState}`}>
                  {formatState(summary.authoringState)}
                </span>
                <span>{summary.validationStatus}</span>
                <span>{summary.questStatus}</span>
              </div>
            </div>

            <dl className="row-facts">
              <div>
                <dt>Issues</dt>
                <dd>
                  {summary.validationIssueCount} / {summary.blockingIssueCount}
                </dd>
              </div>
              <div>
                <dt>Reviews</dt>
                <dd>
                  {summary.approvedReviewCount} / {summary.expertReviewCount}
                </dd>
              </div>
              <div>
                <dt>Coverage</dt>
                <dd>
                  {summary.presentCoverageSections.length} /{' '}
                  {summary.requiredCoverageSections.length}
                </dd>
              </div>
            </dl>

            <div className="coverage-tags" aria-label="审核覆盖">
              {summary.requiredCoverageSections.map((section) => (
                <span
                  className={
                    summary.missingCoverageSections.includes(section)
                      ? 'coverage-tag missing'
                      : 'coverage-tag present'
                  }
                  key={section}
                >
                  {section}
                </span>
              ))}
            </div>

            <div className="blockers">
              {summary.publishabilityReasons.slice(0, 4).map((reason) => (
                <p key={reason}>{reason}</p>
              ))}
              {summary.publishabilityReasons.length > 4 ? (
                <p>+{summary.publishabilityReasons.length - 4} more</p>
              ) : null}
            </div>

            <div className="row-actions">
              <a
                className="secondary-button"
                href={`${playAppUrl}/preview/quests/${summary.slug}`}
              >
                预览
              </a>
            </div>
          </article>
        ))}
      </section>
    </main>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

function formatState(state: string) {
  return state.replaceAll('_', ' ')
}

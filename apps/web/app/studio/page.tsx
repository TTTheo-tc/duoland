import Link from 'next/link'
import { listAuthoringQuestSummaries } from '@sel-quest/content'

export default function StudioPage() {
  const summaries = listAuthoringQuestSummaries()

  return (
    <main className="studio-shell">
      <header className="studio-header">
        <div>
          <p className="eyebrow">Authoring Studio</p>
          <h1>内容工作台</h1>
        </div>
        <Link className="secondary-button" href="/">
          返回首页
        </Link>
      </header>

      <section className="studio-grid" aria-label="内容状态">
        {summaries.map((summary) => (
          <article className="studio-card" key={summary.id}>
            <div className="studio-card-header">
              <div>
                <p className="quest-meta">
                  {summary.slug} · v{summary.version}
                </p>
                <h2>{summary.title}</h2>
              </div>
              <span className={`state-pill state-${summary.authoringState}`}>
                {formatState(summary.authoringState)}
              </span>
            </div>

            <dl className="studio-facts">
              <div>
                <dt>Quest</dt>
                <dd>{summary.questStatus}</dd>
              </div>
              <div>
                <dt>Validation</dt>
                <dd>{summary.validationStatus}</dd>
              </div>
              <div>
                <dt>Issues</dt>
                <dd>
                  {summary.validationIssueCount} total · {summary.blockingIssueCount}{' '}
                  blocking
                </dd>
              </div>
              <div>
                <dt>Reviews</dt>
                <dd>
                  {summary.approvedReviewCount}/{summary.expertReviewCount} approved
                </dd>
              </div>
            </dl>

            <div className="coverage-block">
              <h3>Coverage</h3>
              <div className="coverage-tags">
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
            </div>

            <div className="surface-row" aria-label="内容表面">
              <span>
                World {summary.reviewSurface.usesWorldNarrative ? 'on' : 'off'}
              </span>
              <span>
                Assets {summary.reviewSurface.usesAssetRepresentation ? 'on' : 'off'}
              </span>
            </div>

            <div className="blocker-list">
              {summary.publishabilityReasons.slice(0, 5).map((reason) => (
                <p key={reason}>{reason}</p>
              ))}
              {summary.publishabilityReasons.length > 5 ? (
                <p>+{summary.publishabilityReasons.length - 5} more</p>
              ) : null}
            </div>

            <div className="studio-actions">
              <Link
                className="secondary-button"
                href={`/preview/quests/${summary.slug}`}
              >
                预览
              </Link>
            </div>
          </article>
        ))}
      </section>
    </main>
  )
}

function formatState(state: string) {
  return state.replaceAll('_', ' ')
}

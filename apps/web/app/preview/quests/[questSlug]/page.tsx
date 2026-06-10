import { notFound } from 'next/navigation'
import { getPreviewQuestBySlug } from '@sel-quest/content/preview'
import { QuestPlayer } from '../../../../src/features/quest-player/QuestPlayer'

export default async function PreviewQuestPage({
  params
}: {
  params: Promise<{ questSlug: string }>
}) {
  if (process.env.NODE_ENV === 'production') notFound()

  const { questSlug } = await params
  const quest = getPreviewQuestBySlug(questSlug)

  if (!quest) notFound()

  return <QuestPlayer quest={quest} mode="preview" />
}

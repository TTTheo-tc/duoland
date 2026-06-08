import { notFound } from 'next/navigation'
import { getPublishableQuestBySlug } from '@sel-quest/content'
import { QuestPlayer } from '../../../src/features/quest-player/QuestPlayer'

export default async function QuestPage({
  params
}: {
  params: Promise<{ questSlug: string }>
}) {
  const { questSlug } = await params
  const quest = getPublishableQuestBySlug(questSlug)

  if (!quest) notFound()

  return <QuestPlayer quest={quest} />
}

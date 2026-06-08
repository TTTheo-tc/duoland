'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ActivityRendererProps } from './types'
import type {
  BreathingActivityConfig,
  DialogueActivityConfig,
  EmotionCardActivityConfig,
  RecapActivityConfig,
  ScenarioChoiceActivityConfig,
  SingleChoiceActivityConfig
} from './schemas'

export function DialogueActivity({
  activity,
  onComplete
}: ActivityRendererProps<DialogueActivityConfig, { lineIndex: number }>) {
  const [lineIndex, setLineIndex] = useState(0)
  const line = activity.config.lines[lineIndex]
  const isLastLine = lineIndex === activity.config.lines.length - 1

  return (
    <section className="activity-panel" aria-labelledby={`${activity.id}-title`}>
      <p className="activity-kicker">故事线索</p>
      <h2 id={`${activity.id}-title`}>{activity.title}</h2>
      <div className="dialogue-box">
        <p className="speaker">{line.speakerName}</p>
        <p className="dialogue-text">{line.text}</p>
      </div>
      <button
        className="primary-button"
        onClick={() => {
          if (isLastLine) {
            onComplete({
              activityId: activity.id,
              completed: true,
              value: { lineIndex }
            })
          } else {
            setLineIndex((current) => current + 1)
          }
        }}
      >
        {isLastLine ? '完成线索' : '继续'}
      </button>
    </section>
  )
}

export function SingleChoiceActivity({
  activity,
  value,
  onChange,
  onComplete
}: ActivityRendererProps<SingleChoiceActivityConfig, { selectedOptionId: string }>) {
  const selectedOptionId = value?.selectedOptionId
  const selected = activity.config.options.find((option) => option.id === selectedOptionId)

  return (
    <section className="activity-panel" aria-labelledby={`${activity.id}-title`}>
      <p className="activity-kicker">选择练习</p>
      <h2 id={`${activity.id}-title`}>{activity.config.prompt}</h2>
      <div className="option-grid">
        {activity.config.options.map((option) => (
          <button
            key={option.id}
            className={selectedOptionId === option.id ? 'choice selected' : 'choice'}
            aria-pressed={selectedOptionId === option.id}
            onClick={() => onChange({ selectedOptionId: option.id })}
          >
            {option.label}
          </button>
        ))}
      </div>
      {selected?.feedback ? <p className="feedback">{selected.feedback}</p> : null}
      <button
        className="primary-button"
        disabled={!selected}
        onClick={() =>
          selected &&
          onComplete({
            activityId: activity.id,
            completed: true,
            learningSignal: selected.learningSignal,
            value: { selectedOptionId: selected.id }
          })
        }
      >
        {activity.config.submitLabel ?? '提交'}
      </button>
    </section>
  )
}

export function EmotionCardActivity({
  activity,
  value,
  onChange,
  onComplete
}: ActivityRendererProps<EmotionCardActivityConfig, { selectedEmotionIds: string[] }>) {
  const selectedEmotionIds = value?.selectedEmotionIds ?? []
  const feedback = selectedEmotionIds
    .map((id) => activity.config.feedbackByEmotionId?.[id])
    .filter(Boolean)

  function toggleEmotion(id: string) {
    const next = selectedEmotionIds.includes(id)
      ? selectedEmotionIds.filter((emotionId) => emotionId !== id)
      : [...selectedEmotionIds, id]
    onChange({ selectedEmotionIds: next })
  }

  return (
    <section className="activity-panel" aria-labelledby={`${activity.id}-title`}>
      <p className="activity-kicker">情绪观察</p>
      <h2 id={`${activity.id}-title`}>{activity.config.prompt}</h2>
      <div className="emotion-grid">
        {activity.config.emotions.map((emotion) => (
          <button
            key={emotion.id}
            className={selectedEmotionIds.includes(emotion.id) ? 'emotion-card selected' : 'emotion-card'}
            aria-pressed={selectedEmotionIds.includes(emotion.id)}
            onClick={() => toggleEmotion(emotion.id)}
          >
            <span aria-hidden="true">{emotion.emoji}</span>
            <strong>{emotion.label}</strong>
            {emotion.description ? <small>{emotion.description}</small> : null}
          </button>
        ))}
      </div>
      {feedback.length > 0 ? (
        <div className="feedback" role="status">
          {feedback.map((text) => (
            <p key={text}>{text}</p>
          ))}
        </div>
      ) : null}
      <button
        className="primary-button"
        disabled={selectedEmotionIds.length === 0}
        onClick={() =>
          onComplete({
            activityId: activity.id,
            completed: true,
            learningSignal: estimateEmotionSignal(
              selectedEmotionIds,
              activity.config.correctEmotionIds
            ),
            value: { selectedEmotionIds }
          })
        }
      >
        确认观察
      </button>
    </section>
  )
}

export function ScenarioChoiceActivity({
  activity,
  value,
  onChange,
  onComplete
}: ActivityRendererProps<ScenarioChoiceActivityConfig, { selectedChoiceId: string }>) {
  const selectedChoiceId = value?.selectedChoiceId
  const selected = activity.config.choices.find((choice) => choice.id === selectedChoiceId)

  return (
    <section className="activity-panel" aria-labelledby={`${activity.id}-title`}>
      <p className="activity-kicker">应对练习</p>
      <h2 id={`${activity.id}-title`}>{activity.config.scenarioText}</h2>
      <div className="option-grid">
        {activity.config.choices.map((choice) => (
          <button
            key={choice.id}
            className={selectedChoiceId === choice.id ? 'choice selected' : 'choice'}
            aria-pressed={selectedChoiceId === choice.id}
            onClick={() => onChange({ selectedChoiceId: choice.id })}
          >
            {choice.label}
          </button>
        ))}
      </div>
      {selected ? (
        <div className="feedback" role="status">
          <p>{selected.outcomeText}</p>
        </div>
      ) : null}
      <button
        className="primary-button"
        disabled={!selected}
        onClick={() =>
          selected &&
          onComplete({
            activityId: activity.id,
            completed: true,
            learningSignal: selected.learningSignal,
            value: { selectedChoiceId: selected.id }
          })
        }
      >
        继续任务
      </button>
    </section>
  )
}

export function BreathingActivity({
  activity,
  onComplete
}: ActivityRendererProps<BreathingActivityConfig, { completedCycles: number }>) {
  const [remaining, setRemaining] = useState(activity.config.cycles)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const elapsedSecondsRef = useRef(0)
  const startedAt = useRef(Date.now())
  const hasCompleted = useRef(false)
  const reducedMotion = usePrefersReducedMotion()
  const secondsPerCycle = activity.config.inhaleSeconds +
    (activity.config.holdSeconds ?? 0) +
    activity.config.exhaleSeconds
  const minSeconds = activity.completion.type === 'time_elapsed'
    ? activity.completion.minSeconds
    : 0
  const canSubmit = elapsedSeconds >= minSeconds

  const complete = useCallback((completedCycles: number) => {
    if (hasCompleted.current) return
    hasCompleted.current = true
    onComplete({
      activityId: activity.id,
      completed: true,
      value: { completedCycles },
      metadata: { elapsedSeconds: elapsedSecondsRef.current }
    })
  }, [activity.id, onComplete])

  useEffect(() => {
    const interval = window.setInterval(() => {
      const nextElapsedSeconds = Math.floor((Date.now() - startedAt.current) / 1000)
      elapsedSecondsRef.current = nextElapsedSeconds
      setElapsedSeconds(nextElapsedSeconds)
    }, 250)

    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    if (remaining <= 0) {
      complete(activity.config.cycles)
      return
    }

    const timeout = window.setTimeout(() => {
      setRemaining((current) => current - 1)
    }, secondsPerCycle * 1000)

    return () => window.clearTimeout(timeout)
  }, [activity.config.cycles, complete, remaining, secondsPerCycle])

  return (
    <section className="activity-panel" aria-labelledby={`${activity.id}-title`}>
      <p className="activity-kicker">平静练习</p>
      <h2 id={`${activity.id}-title`}>{activity.title}</h2>
      <p>{activity.config.instruction}</p>
      <div className={reducedMotion ? 'breathing-circle reduced' : 'breathing-circle'} aria-hidden="true" />
      <p className="feedback" role="status">
        剩余 {Math.max(remaining, 0)} 轮
      </p>
      <button
        className="secondary-button"
        disabled={!canSubmit}
        onClick={() => complete(activity.config.cycles - remaining)}
      >
        我已经准备好了
      </button>
    </section>
  )
}

export function RecapActivity({
  activity,
  onComplete
}: ActivityRendererProps<RecapActivityConfig, { acknowledged: true }>) {
  return (
    <section className="activity-panel" aria-labelledby={`${activity.id}-title`}>
      <p className="activity-kicker">任务总结</p>
      <h2 id={`${activity.id}-title`}>{activity.config.title}</h2>
      <ul className="recap-list">
        {activity.config.summaryPoints.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
      <p className="takeaway">{activity.config.childTakeaway}</p>
      {activity.config.guardianTip ? (
        <p className="guardian-tip">{activity.config.guardianTip}</p>
      ) : null}
      <button
        className="primary-button"
        onClick={() =>
          onComplete({
            activityId: activity.id,
            completed: true,
            value: { acknowledged: true }
          })
        }
      >
        完成任务
      </button>
    </section>
  )
}

function estimateEmotionSignal(selectedIds: string[], correctIds?: string[]) {
  if (!correctIds?.length) return undefined
  return selectedIds.some((id) => correctIds.includes(id)) ? 1 : 0
}

function usePrefersReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(query.matches)

    const handleChange = () => setReducedMotion(query.matches)
    query.addEventListener('change', handleChange)
    return () => query.removeEventListener('change', handleChange)
  }, [])

  return reducedMotion
}

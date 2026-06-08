export interface ModelExplanation {
  summary: string
  factors?: Array<{
    name: string
    weight?: number
    description?: string
  }>
}

export interface ModelService<TInput, TOutput> {
  predict(input: TInput): Promise<TOutput>
  explain?(input: TInput, output: TOutput): Promise<ModelExplanation>
}

export class NullLlmClient {
  complete(): Promise<never> {
    return Promise.reject(new Error('LLM is disabled for the MVP.'))
  }
}

export class ScenarioOutcomeSimulator implements ModelService<{ learningSignal?: number }, { supportive: boolean }> {
  predict(input: { learningSignal?: number }): Promise<{ supportive: boolean }> {
    return Promise.resolve({ supportive: (input.learningSignal ?? 0) > 0 })
  }
}

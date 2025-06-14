import type { Draft, State } from './core'
import { produce } from './core'

// Batching queue for high-frequency updates
export class BatchQueue<T extends State> {
  private queue: Array<(draft: Draft<T>) => void> = []
  private readonly state: T

  constructor(state: T) {
    this.state = state
  }

  enqueue(recipe: (draft: Draft<T>) => void): this {
    this.queue.push(recipe)
    return this
  }

  execute(): T {
    return produce(this.state, (draft: Draft<T>) => {
      for (const recipe of this.queue) {
        recipe(draft)
      }
    })
  }
}

export function batchProduce<T extends State>(
  state: T,
  recipes: Array<(draft: Draft<T>) => void>,
): T {
  return produce(state, (draft: Draft<T>) => {
    for (const recipe of recipes) {
      recipe(draft)
    }
  })
}

export function createBatchQueue<T extends State>(state: T): BatchQueue<T> {
  return new BatchQueue(state)
}

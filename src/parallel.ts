import type { Draft, State } from './core'
import { produce } from './core'

// Sharding strategy interface
export interface ShardingStrategy<T extends State> {
  shard: (state: T) => Array<Partial<T>>
  merge: (chunks: Array<Partial<T>>) => T
}

// Default sharding strategy (by object keys)
export function defaultShardingStrategy<T extends State>(): ShardingStrategy<T> {
  return {
    shard(state: T): Array<Partial<T>> {
      if (typeof state !== 'object' || state === null) {
        return [state]
      }
      return Object.keys(state).map(key => ({ [key]: (state as any)[key] } as Partial<T>))
    },
    merge(chunks: Array<Partial<T>>): T {
      return Object.assign({}, ...chunks) as T
    },
  }
}

// Parallel produce with custom sharding
export function produceParallel<T extends State>(
  state: T,
  recipes: Array<(draft: Draft<Partial<T>>) => void>,
  strategy: ShardingStrategy<T> = defaultShardingStrategy<T>(),
): T {
  // Split the state into chunks
  const chunks = strategy.shard(state)

  // Check if we have the right number of recipes
  if (chunks.length !== recipes.length) {
    throw new Error('Mismatched chunks and recipes')
  }

  // Apply each recipe to its corresponding chunk
  const results = chunks.map((chunk, i) => {
    return produce(chunk, recipes[i])
  })

  return strategy.merge(results)
}

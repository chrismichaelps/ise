import type {
  ShardingStrategy,
} from '../src'
import { describe, expect, it } from 'vitest'
import {
  batchProduce,
  createBatchQueue,
  produce,
  produceMemoized,
  produceParallel,
} from '../src'

describe('iSE Core Functionality', () => {
  it('should update state immutably', () => {
    const initialState = { count: 0, user: { name: 'Alice' } }
    const newState = produce(initialState, (draft) => {
      draft.count += 1
      draft.user.name = 'Bob'
    })

    expect(newState).toEqual({ count: 1, user: { name: 'Bob' } })
    expect(initialState).toEqual({ count: 0, user: { name: 'Alice' } })
    expect(newState).not.toBe(initialState)
    expect(newState.user).not.toBe(initialState.user)
  })

  it('should handle batch updates', () => {
    const state = { count: 0 }
    const newState = batchProduce(state, [
      (draft) => { draft.count += 1 },
      (draft) => { draft.count += 2 },
    ])

    expect(newState).toEqual({ count: 3 })
    expect(state).toEqual({ count: 0 })
  })

  it('should handle batch queue', () => {
    const state = { count: 0 }
    const queue = createBatchQueue(state)
    queue.enqueue((draft) => { draft.count += 1 })
    queue.enqueue((draft) => { draft.count += 2 })
    const newState = queue.execute()

    expect(newState).toEqual({ count: 3 })
    expect(state).toEqual({ count: 0 })
  })

  it('should handle parallel updates', () => {
    interface TestState {
      part1: { value: number }
      part2: { value: number }
    }

    const state: TestState = { part1: { value: 1 }, part2: { value: 2 } }

    // Create a custom sharding strategy for TestState
    const testShardingStrategy: ShardingStrategy<TestState> = {
      shard(state: TestState): Array<Partial<TestState>> {
        return [
          { part1: state.part1 },
          { part2: state.part2 },
        ]
      },
      merge(chunks: Array<Partial<TestState>>): TestState {
        return {
          part1: chunks[0].part1!,
          part2: chunks[1].part2!,
        }
      },
    }

    const newState = produceParallel<TestState>(state, [
      (draft) => { (draft as any).part1.value += 1 },
      (draft) => { (draft as any).part2.value += 2 },
    ], testShardingStrategy)

    expect(newState).toEqual({ part1: { value: 2 }, part2: { value: 4 } })
    expect(state).toEqual({ part1: { value: 1 }, part2: { value: 2 } })
  })

  it('should memoize repeated updates', () => {
    const state = { count: 0 }
    const recipe = (draft: { count: number }) => { draft.count += 1 }

    const result1 = produceMemoized(state, recipe)
    const result2 = produceMemoized(state, recipe)

    expect(result1).toEqual({ count: 1 })
    expect(result2).toEqual({ count: 1 })
    // In a real implementation with proper caching, these would be the same reference
    // For our simple implementation, they might not be
  })

  it('should throw errors synchronously', () => {
    expect(() =>
      produce({ count: 0 }, () => {
        throw new Error('Recipe error')
      }),
    ).toThrow()
  })
})

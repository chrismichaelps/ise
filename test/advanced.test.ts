import type { Draft } from '../src/core'
import { describe, expect, it } from 'vitest'
import { batchProduce, createBatchQueue, ISEError, produce, produceMemoized } from '../src/core'

// Define types for our test data
interface UserProfile {
  name: string
  address: {
    street: string
    city: string
    zip: string
    coordinates: {
      lat: number
      lng: number
    }
  }
  preferences: {
    theme: string
    notifications: {
      email: boolean
      push: boolean
      sms: boolean
    }
  }
}

interface UserState {
  user: {
    profile: UserProfile
    roles: string[]
    metadata: {
      lastLogin: string
      loginCount: number
    }
  }
  settings: {
    language: string
    timezone: string
    features: {
      beta: boolean
      experimental: boolean
    }
  }
}

interface Item {
  id: number
  name: string
  tags: string[]
}

interface ItemState {
  items: Item[]
  metadata: {
    totalItems: number
    categories: string[]
  }
}

interface CounterState {
  counter: number
  history: Array<{
    type: string
    value: number
    timestamp: number
  }>
  metadata: {
    lastUpdated: number | null
    updateCount: number
  }
}

interface BatchCounterState {
  counters: {
    a: number
    b: number
    c: number
  }
  history: Array<{
    type: string
    value: number
    timestamp: number
  }>
}

interface DataState {
  data: Array<{
    id: number
    value: number
  }>
  metadata: {
    sum: number
    count: number
  }
}

interface CircularState {
  data: {
    name: string
    self?: any
  }
  metadata: {
    type: string
  }
}

interface LargeArrayState {
  items: Array<{
    id: number
    value: number
  }>
  metadata: {
    count: number
  }
}

describe('iSE Advanced Functionality', () => {
  // Test with deeply nested objects
  it('should handle deeply nested state updates', () => {
    const initialState: UserState = {
      user: {
        profile: {
          name: 'Alice',
          address: {
            street: '123 Main St',
            city: 'Boston',
            zip: '02108',
            coordinates: {
              lat: 42.3601,
              lng: -71.0589,
            },
          },
          preferences: {
            theme: 'dark',
            notifications: {
              email: true,
              push: false,
              sms: true,
            },
          },
        },
        roles: ['admin', 'user'],
        metadata: {
          lastLogin: '2025-06-06',
          loginCount: 42,
        },
      },
      settings: {
        language: 'en',
        timezone: 'America/New_York',
        features: {
          beta: true,
          experimental: false,
        },
      },
    }

    const newState = produce(initialState, (draft: Draft<UserState>) => {
      // Update deeply nested properties
      draft.user.profile.name = 'Bob'
      draft.user.profile.address.city = 'New York'
      draft.user.profile.address.coordinates.lat = 40.7128
      draft.user.profile.preferences.notifications.push = true
      draft.user.roles.push('editor')
      draft.settings.features.experimental = true
    })

    // Verify the new state
    expect(newState.user.profile.name).toBe('Bob')
    expect(newState.user.profile.address.city).toBe('New York')
    expect(newState.user.profile.address.coordinates.lat).toBe(40.7128)
    expect(newState.user.profile.preferences.notifications.push).toBe(true)
    expect(newState.user.roles).toEqual(['admin', 'user', 'editor'])
    expect(newState.settings.features.experimental).toBe(true)

    // Verify immutability
    expect(initialState.user.profile.name).toBe('Alice')
    expect(initialState.user.profile.address.city).toBe('Boston')
    expect(initialState.user.profile.address.coordinates.lat).toBe(42.3601)
    expect(initialState.user.profile.preferences.notifications.push).toBe(false)
    expect(initialState.user.roles).toEqual(['admin', 'user'])
    expect(initialState.settings.features.experimental).toBe(false)
  })

  // Test with arrays and array operations
  it('should handle array operations correctly', () => {
    const initialState: ItemState = {
      items: [
        { id: 1, name: 'Item 1', tags: ['tag1', 'tag2'] },
        { id: 2, name: 'Item 2', tags: ['tag2', 'tag3'] },
        { id: 3, name: 'Item 3', tags: ['tag1', 'tag3'] },
      ],
      metadata: {
        totalItems: 3,
        categories: ['category1', 'category2'],
      },
    }

    const newState = produce(initialState, (draft: Draft<ItemState>) => {
      // Add a new item
      draft.items.push({ id: 4, name: 'Item 4', tags: ['tag1', 'tag4'] })

      // Update an existing item
      draft.items[1].name = 'Updated Item 2'
      draft.items[1].tags.push('tag4')

      // Remove an item
      draft.items.splice(0, 1)

      // Update metadata
      draft.metadata.totalItems = draft.items.length
      draft.metadata.categories.push('category3')
    })

    // Verify the new state
    expect(newState.items.length).toBe(3)
    expect(newState.items[0].id).toBe(2) // First item was removed
    expect(newState.items[0].name).toBe('Updated Item 2')
    expect(newState.items[0].tags).toEqual(['tag2', 'tag3', 'tag4'])
    expect(newState.items[2].id).toBe(4) // New item was added
    expect(newState.metadata.totalItems).toBe(3)
    expect(newState.metadata.categories).toEqual(['category1', 'category2', 'category3'])

    // Verify immutability
    expect(initialState.items.length).toBe(3)
    expect(initialState.items[0].id).toBe(1)
    expect(initialState.items[1].name).toBe('Item 2')
    expect(initialState.items[1].tags).toEqual(['tag2', 'tag3'])
    expect(initialState.metadata.totalItems).toBe(3)
    expect(initialState.metadata.categories).toEqual(['category1', 'category2'])
  })

  // Test with complex batch operations
  it('should handle complex batch operations', () => {
    const initialState: CounterState = {
      counter: 0,
      history: [],
      metadata: {
        lastUpdated: null,
        updateCount: 0,
      },
    }

    const recipes = [
      // First recipe: increment counter and add to history
      (draft: Draft<CounterState>) => {
        draft.counter += 1
        draft.history.push({ type: 'increment', value: draft.counter, timestamp: Date.now() })
      },
      // Second recipe: increment counter again and update metadata
      (draft: Draft<CounterState>) => {
        draft.counter += 2
        draft.metadata.lastUpdated = Date.now()
        draft.metadata.updateCount += 1
      },
      // Third recipe: add a special entry to history
      (draft: Draft<CounterState>) => {
        draft.history.push({ type: 'special', value: draft.counter * 2, timestamp: Date.now() })
      },
    ]

    const newState = batchProduce(initialState, recipes)

    // Verify the new state
    expect(newState.counter).toBe(3) // 0 + 1 + 2
    expect(newState.history.length).toBe(2)
    expect(newState.history[0].type).toBe('increment')
    expect(newState.history[0].value).toBe(1)
    expect(newState.history[1].type).toBe('special')
    expect(newState.history[1].value).toBe(6) // 3 * 2
    expect(newState.metadata.lastUpdated).not.toBeNull()
    expect(newState.metadata.updateCount).toBe(1)

    // Verify immutability
    expect(initialState.counter).toBe(0)
    expect(initialState.history.length).toBe(0)
    expect(initialState.metadata.lastUpdated).toBeNull()
    expect(initialState.metadata.updateCount).toBe(0)
  })

  // Test with batch queue for high-frequency updates
  it('should handle high-frequency updates with batch queue', () => {
    const initialState: BatchCounterState = {
      counters: {
        a: 0,
        b: 0,
        c: 0,
      },
      history: [],
    }

    const queue = createBatchQueue(initialState)

    // Simulate high-frequency updates
    for (let i = 0; i < 10; i++) {
      queue.enqueue((draft: Draft<BatchCounterState>) => {
        draft.counters.a += 1
        draft.history.push({ type: 'a', value: draft.counters.a, timestamp: Date.now() })
      })
    }

    for (let i = 0; i < 5; i++) {
      queue.enqueue((draft: Draft<BatchCounterState>) => {
        draft.counters.b += 2
        draft.history.push({ type: 'b', value: draft.counters.b, timestamp: Date.now() })
      })
    }

    for (let i = 0; i < 3; i++) {
      queue.enqueue((draft: Draft<BatchCounterState>) => {
        draft.counters.c += 3
        draft.history.push({ type: 'c', value: draft.counters.c, timestamp: Date.now() })
      })
    }

    const newState = queue.execute()

    // Verify the new state
    expect(newState.counters.a).toBe(10) // 10 increments of 1
    expect(newState.counters.b).toBe(10) // 5 increments of 2
    expect(newState.counters.c).toBe(9) // 3 increments of 3
    expect(newState.history.length).toBe(18) // 10 + 5 + 3

    // Verify immutability
    expect(initialState.counters.a).toBe(0)
    expect(initialState.counters.b).toBe(0)
    expect(initialState.counters.c).toBe(0)
    expect(initialState.history.length).toBe(0)
  })

  // Test memoization with complex objects
  it('should memoize complex state transformations', () => {
    const initialState: DataState = {
      data: [
        { id: 1, value: 10 },
        { id: 2, value: 20 },
        { id: 3, value: 30 },
      ],
      metadata: {
        sum: 60,
        count: 3,
      },
    }

    // Complex recipe that transforms the state
    const recipe = (draft: Draft<DataState>) => {
      // Double all values
      draft.data.forEach((item) => {
        item.value *= 2
      })

      // Update metadata
      draft.metadata.sum = draft.data.reduce((sum, item) => sum + item.value, 0)
      draft.metadata.count = draft.data.length

      // Add a new item
      draft.data.push({ id: 4, value: 40 })

      // Update metadata again
      draft.metadata.sum += 40
      draft.metadata.count += 1
    }

    // First call should compute the result
    const result1 = produceMemoized(initialState, recipe)

    // Second call with the same state and recipe should return the cached result
    const result2 = produceMemoized(initialState, recipe)

    // Verify the results
    expect(result1).toEqual(result2) // Should be the same object reference
    expect(result1.data.length).toBe(4)
    expect(result1.data[0].value).toBe(20) // 10 * 2
    expect(result1.data[1].value).toBe(40) // 20 * 2
    expect(result1.data[2].value).toBe(60) // 30 * 2
    expect(result1.data[3].value).toBe(40) // New item
    expect(result1.metadata.sum).toBe(160) // 20 + 40 + 60 + 40
    expect(result1.metadata.count).toBe(4)

    // Verify immutability
    expect(initialState.data.length).toBe(3)
    expect(initialState.data[0].value).toBe(10)
    expect(initialState.metadata.sum).toBe(60)
    expect(initialState.metadata.count).toBe(3)
  })

  // Test error handling
  it('should handle errors in recipes', () => {
    const initialState = { count: 0 }

    // Recipe that throws an error
    const errorRecipe = (draft: Draft<{ count: number }>) => {
      draft.count += 1
      throw new Error('Test error')
    }

    // Verify that the error is wrapped in ISEError
    expect(() => {
      produce(initialState, errorRecipe)
    }).toThrow(ISEError)

    // Verify that the state is not modified when an error occurs
    expect(initialState.count).toBe(0)
  })

  // Test with circular references
  it('should handle circular references', () => {
    // Create an object with a circular reference
    const circular: any = { name: 'Circular' }
    circular.self = circular

    const initialState: CircularState = {
      data: circular,
      metadata: { type: 'circular' },
    }

    const newState = produce(initialState, (draft: Draft<CircularState>) => {
      draft.data.name = 'Updated Circular'
      draft.metadata.type = 'updated'
    })

    // Verify the new state
    expect(newState.data.name).toBe('Updated Circular')
    expect(newState.data.self).toBe(newState.data) // Circular reference is preserved
    expect(newState.metadata.type).toBe('updated')

    // Verify immutability
    expect(initialState.data.name).toBe('Circular')
    expect(initialState.metadata.type).toBe('circular')
  })

  // Test with large arrays
  it('should handle large arrays efficiently', () => {
    // Create a large array
    const largeArray = Array.from({ length: 1000 }, (_, i) => ({ id: i, value: i * 10 }))

    const initialState: LargeArrayState = {
      items: largeArray,
      metadata: { count: largeArray.length },
    }

    const newState = produce(initialState, (draft: Draft<LargeArrayState>) => {
      // Update every 10th item
      for (let i = 0; i < draft.items.length; i += 10) {
        draft.items[i].value *= 2
      }

      // Add 100 new items
      for (let i = 0; i < 100; i++) {
        draft.items.push({ id: 1000 + i, value: (1000 + i) * 10 })
      }

      // Update metadata
      draft.metadata.count = draft.items.length
    })

    // Verify the new state
    expect(newState.items.length).toBe(1100) // 1000 + 100
    expect(newState.items[0].value).toBe(0) // 0 * 2
    expect(newState.items[10].value).toBe(200) // 10 * 10 * 2
    expect(newState.items[20].value).toBe(400) // 20 * 10 * 2
    expect(newState.items[1000].id).toBe(1000)
    expect(newState.metadata.count).toBe(1100)

    // Verify immutability
    expect(initialState.items.length).toBe(1000)
    expect(initialState.items[10].value).toBe(100) // 10 * 10
    expect(initialState.metadata.count).toBe(1000)
  })
})

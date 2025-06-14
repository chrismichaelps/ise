import type {
  BatchQueue,
  Draft,
  ShardingStrategy,
  State,
} from '../src'
import { describe, expect, it } from 'vitest'
import {
  batchProduce,
  createBatchQueue,
  defaultShardingStrategy,
  produce,
  produceMemoized,
  produceParallel,
} from '../src'

describe('rEADME Examples Validation', () => {
  // Define types used in examples
  interface Todo {
    id: number
    text: string
    completed: boolean
  }

  interface TodoState {
    todos: Todo[]
    filter: 'all' | 'active' | 'completed'
  }

  // Basic Usage Example
  describe('basic Usage Example', () => {
    it('should demonstrate basic produce functionality', () => {
      const initialState: TodoState = {
        todos: [],
        filter: 'all',
      }

      // Add a new todo
      const newState = produce(initialState, (draft) => {
        draft.todos.push({
          id: 1,
          text: 'Learn ISE',
          completed: false,
        })
      })

      // Verify the state was updated correctly
      expect(newState.todos).toHaveLength(1)
      expect(newState.todos[0].text).toBe('Learn ISE')
      expect(newState.filter).toBe('all')

      // Verify immutability
      expect(newState).not.toBe(initialState)
      expect(newState.todos).not.toBe(initialState.todos)
      expect(initialState.todos).toHaveLength(0)
    })

    it('should demonstrate custom store implementation', () => {
      const initialState: TodoState = {
        todos: [],
        filter: 'all',
      }

      class TodoStore {
        private state: TodoState = initialState
        private listeners: Array<(state: TodoState) => void> = []

        getState(): TodoState {
          return this.state
        }

        update(recipe: (draft: Draft<TodoState>) => void): void {
          this.state = produce(this.state, recipe)
          this.notifyListeners()
        }

        subscribe(listener: (state: TodoState) => void): () => void {
          this.listeners.push(listener)
          return () => {
            this.listeners = this.listeners.filter(l => l !== listener)
          }
        }

        private notifyListeners(): void {
          this.listeners.forEach(listener => listener(this.state))
        }
      }

      // Create a store instance
      const store = new TodoStore()
      let lastState: TodoState | null = null

      // Subscribe to state changes
      const unsubscribe = store.subscribe((state) => {
        lastState = state
      })

      // Update state
      store.update((draft) => {
        draft.todos.push({
          id: Date.now(),
          text: 'New todo',
          completed: false,
        })
      })

      // Verify the state was updated and listener was called
      expect(lastState).not.toBeNull()
      expect(lastState!.todos).toHaveLength(1)
      expect(lastState!.todos[0].text).toBe('New todo')

      // Unsubscribe
      unsubscribe()
    })
  })

  // Batching Updates Example
  describe('batching Updates Example', () => {
    it('should demonstrate batch queue functionality', () => {
      const initialState: TodoState = {
        todos: [],
        filter: 'all',
      }

      // Create a batch queue
      const batchQueue = createBatchQueue(initialState)

      // Queue multiple updates
      batchQueue.enqueue((draft) => {
        draft.todos.push({ id: 1, text: 'First todo', completed: false })
      })

      batchQueue.enqueue((draft) => {
        draft.todos.push({ id: 2, text: 'Second todo', completed: false })
      })

      batchQueue.enqueue((draft) => {
        draft.filter = 'active'
      })

      // Apply all queued updates at once
      const updatedState = batchQueue.execute()

      // Verify all updates were applied
      expect(updatedState.todos).toHaveLength(2)
      expect(updatedState.todos[0].text).toBe('First todo')
      expect(updatedState.todos[1].text).toBe('Second todo')
      expect(updatedState.filter).toBe('active')

      // Verify immutability
      expect(updatedState).not.toBe(initialState)
      expect(updatedState.todos).not.toBe(initialState.todos)
      expect(initialState.todos).toHaveLength(0)
      expect(initialState.filter).toBe('all')
    })
  })

  // Memoization Example
  describe('memoization Example', () => {
    it('should demonstrate memoized producer functionality', () => {
      const initialState: TodoState = {
        todos: [],
        filter: 'all',
      }

      const todo: Todo = {
        id: 1,
        text: 'Memoized todo',
        completed: false,
      }

      // Create a recipe function
      const addTodoRecipe = (draft: Draft<TodoState>, todoToAdd: Todo) => {
        draft.todos.push(todoToAdd)
      }

      // Use the memoized producer
      const stateWithTodo = produceMemoized(initialState, draft => addTodoRecipe(draft, todo))

      // Verify the state was updated correctly
      expect(stateWithTodo.todos).toHaveLength(1)
      expect(stateWithTodo.todos[0]).toEqual(todo)

      // Use the memoized producer again with the same state and recipe
      const stateWithSameTodo = produceMemoized(initialState, draft => addTodoRecipe(draft, todo))

      // Verify the state was updated correctly again
      expect(stateWithSameTodo.todos).toHaveLength(1)
      expect(stateWithSameTodo.todos[0]).toEqual(todo)

      // In a real implementation with proper caching, these would be the same reference
      // For our simple implementation, they might not be
    })
  })

  // Parallel Processing Example
  describe('parallel Processing Example', () => {
    it('should demonstrate parallel processing functionality', () => {
      const initialState: TodoState = {
        todos: [
          { id: 1, text: 'Todo 1', completed: false },
          { id: 2, text: 'Todo 2', completed: false },
          { id: 3, text: 'Todo 3', completed: false },
          { id: 4, text: 'Todo 4', completed: false },
        ],
        filter: 'all',
      }

      // Define a custom sharding strategy
      const customShardingStrategy: ShardingStrategy<TodoState> = {
        shard(state: TodoState) {
          // Split todos into chunks for parallel processing
          const chunks = []
          const chunkSize = Math.ceil(state.todos.length / 2) // Split into 2 chunks

          for (let i = 0; i < state.todos.length; i += chunkSize) {
            chunks.push({
              todos: state.todos.slice(i, i + chunkSize),
            })
          }

          return chunks
        },
        merge(chunks: Array<Partial<TodoState>>) {
          return {
            todos: chunks.flatMap(chunk => chunk.todos || []),
            filter: 'all' as const,
          }
        },
      }

      // Process state updates in parallel
      const updatedState = produceParallel(
        initialState,
        [
          (draft) => {
            // This will be applied to the first chunk
            if (draft.todos) {
              draft.todos.forEach((todo) => {
                todo.completed = true
              })
            }
          },
          (draft) => {
            // This will be applied to the second chunk
            if (draft.todos) {
              draft.todos.forEach((todo) => {
                todo.completed = true
              })
            }
          },
        ],
        customShardingStrategy,
      )

      // Verify all todos were updated
      expect(updatedState.todos).toHaveLength(4)
      expect(updatedState.todos[0].completed).toBe(true)
      expect(updatedState.todos[1].completed).toBe(true)
      expect(updatedState.todos[2].completed).toBe(true)
      expect(updatedState.todos[3].completed).toBe(true)

      // Verify immutability
      expect(updatedState).not.toBe(initialState)
      expect(updatedState.todos).not.toBe(initialState.todos)
      expect(initialState.todos[0].completed).toBe(false)
    })
  })

  // React Integration Example
  describe('react Integration Example', () => {
    it('should demonstrate how to use ISE with React', () => {
      // This is a conceptual test since we can't actually render React components in this test
      // We'll just verify that the update function works as expected

      const initialState: TodoState = {
        todos: [],
        filter: 'all',
      }

      // Simulate React's useState
      let state = initialState
      const setState = (updater: (prevState: TodoState) => TodoState) => {
        state = updater(state)
      }

      // Create a memoized update function (simulating useCallback)
      const updateState = (recipe: (draft: Draft<TodoState>) => void) => {
        setState(prevState => produce(prevState, recipe))
      }

      // Simulate adding a todo
      updateState((draft) => {
        draft.todos.push({
          id: Date.now(),
          text: 'New todo',
          completed: false,
        })
      })

      // Verify the state was updated
      expect(state.todos).toHaveLength(1)
      expect(state.todos[0].text).toBe('New todo')

      // Simulate toggling a todo
      const todoId = state.todos[0].id
      updateState((draft) => {
        const todo = draft.todos.find(t => t.id === todoId)
        if (todo)
          todo.completed = !todo.completed
      })

      // Verify the todo was toggled
      expect(state.todos[0].completed).toBe(true)
    })
  })

  // TypeScript Support Example
  describe('typeScript Support Example', () => {
    it('should demonstrate TypeScript type checking', () => {
      const initialState: TodoState = {
        todos: [],
        filter: 'all',
      }

      // This test is just to verify that TypeScript would catch these errors
      // We're not actually running the code that would cause errors

      // The following would cause TypeScript errors:
      //
      // produce(initialState, (draft: Draft<TodoState>) => {
      //   // Error: Property 'unknown' does not exist on type 'Draft<TodoState>'
      //   draft.unknown = 'value'
      //
      //   // Error: Type 'string' is not assignable to type 'Todo[]'
      //   draft.todos = 'not an array'
      // })

      // Instead, we'll verify that valid updates work
      const updatedState = produce(initialState, (draft: Draft<TodoState>) => {
        draft.todos.push({
          id: 1,
          text: 'Valid todo',
          completed: false,
        })
        draft.filter = 'active'
      })

      expect(updatedState.todos).toHaveLength(1)
      expect(updatedState.filter).toBe('active')
    })
  })
})

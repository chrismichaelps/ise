/* eslint-disable no-console */
// This file is for demonstration and playground purposes. Console statements are intentional.

import type { Draft } from '../src'
import { createBatchQueue, produce, produceMemoized, produceParallel } from '../src'

// --- Types ---
interface Todo {
  id: number
  text: string
  completed: boolean
}

interface TodoState {
  todos: Todo[]
  filter: 'all' | 'active' | 'completed'
}

// --- Basic Usage Example ---
console.log('\n--- Basic Usage Example ---')
const initialState: TodoState = {
  todos: [],
  filter: 'all',
}
const updatedState = produce(initialState, (draft: Draft<TodoState>) => {
  draft.todos.push({
    id: 1,
    text: 'Learn ISE',
    completed: false,
  })
  draft.filter = 'active'
})

console.log('Updated state:', updatedState)

// --- Custom Store Implementation ---
console.log('\n--- Custom Store Implementation ---')
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
const store = new TodoStore()
const unsubscribe = store.subscribe((state) => {
  console.log('State updated:', state)
})
store.update((draft) => {
  draft.todos.push({
    id: 2,
    text: 'New todo',
    completed: false,
  })
})
console.log('Current todos:', store.getState().todos)
unsubscribe()

// --- Batching Updates Example ---
console.log('\n--- Batching Updates Example ---')
const batchQueue = createBatchQueue<TodoState>(initialState)
batchQueue.enqueue((draft) => {
  draft.todos.push({ id: 3, text: 'First todo', completed: false })
})
batchQueue.enqueue((draft) => {
  draft.todos.push({ id: 4, text: 'Second todo', completed: false })
})
batchQueue.enqueue((draft) => {
  draft.filter = 'active'
})
const batchedState = batchQueue.execute()
console.log('Batched state:', batchedState)

// --- Memoization Example ---
console.log('\n--- Memoization Example ---')
function addTodoRecipe(draft: Draft<TodoState>, todo: Todo): void {
  draft.todos.push(todo)
}
const todo = { id: 5, text: 'Memoized todo', completed: false }
const memoState1 = produceMemoized(initialState, draft => addTodoRecipe(draft, todo))
const memoState2 = produceMemoized(initialState, draft => addTodoRecipe(draft, todo))
console.log('Memoized state 1:', memoState1)
console.log('Memoized state 2:', memoState2)

// --- Parallel Processing Example ---
console.log('\n--- Parallel Processing Example ---')
const parallelInitial: TodoState = {
  todos: [
    { id: 6, text: 'Todo 1', completed: false },
    { id: 7, text: 'Todo 2', completed: false },
    { id: 8, text: 'Todo 3', completed: false },
    { id: 9, text: 'Todo 4', completed: false },
  ],
  filter: 'all',
}
const customShardingStrategy = {
  shard(state: TodoState) {
    const chunks = []
    const chunkSize = Math.ceil(state.todos.length / 2)
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
const parallelState = produceParallel(
  parallelInitial,
  [
    (draft) => {
      if (draft.todos) {
        draft.todos.forEach((todo) => {
          todo.completed = true
        })
      }
    },
    (draft) => {
      if (draft.todos) {
        draft.todos.forEach((todo) => {
          todo.completed = true
        })
      }
    },
  ],
  customShardingStrategy,
)
console.log('Parallel processed state:', parallelState)

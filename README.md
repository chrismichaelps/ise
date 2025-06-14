<div align="center">
  <img src="public/ise-logo.png" alt="ISE Logo" width="200" style="border-radius: 12px;" />
</div>

<div align="center">
<h1>Immutable State Effect (ISE)</h1>
ISE is a type-safe, scalable state management library inspired by Immer for front-end apps. It offers a mutable-style API for immutable state, backed by TypeScript generics. Built for complex state, ISE optimizes performance with batching, sharding, and memoization.
</div>

<div align="center">
  <img src="https://img.shields.io/npm/v/@chris5855/ise" alt="npm version" />
  <img src="https://img.shields.io/npm/dm/@chris5855/ise" alt="npm downloads" />
  <img src="https://img.shields.io/github/license/chrismichaelps/ise?color=blue" alt="license" />
  <img src="https://img.shields.io/github/stars/chrismichaelps/ise?style=social" alt="stars" />
</div>

---

## 📚 Documentation

### Installation (not yet available)

```bash
npm install @chris5855/ise
# or
yarn add @chris5855/ise
# or
pnpm add @chris5855/ise
```

### Basic Usage

ISE provides a simple API for managing immutable state with a mutable-style syntax:

```typescript
import { Draft, produce, State } from '@chris5855/ise'

// Define your state type
interface TodoState {
  todos: Todo[]
  filter: 'all' | 'active' | 'completed'
}

interface Todo {
  id: number
  text: string
  completed: boolean
}

// Create initial state
const initialState: TodoState = {
  todos: [],
  filter: 'all'
}

// Update state with a mutable-style API
const updatedState = produce(initialState, (draft: Draft<TodoState>) => {
  // Add a new todo
  draft.todos.push({
    id: Date.now(),
    text: 'Learn ISE',
    completed: false
  })

  // Modify existing state
  draft.filter = 'active'
})

console.log('Updated state:', updatedState)

// Create a state management system
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

// Subscribe to state changes
const unsubscribe = store.subscribe((state) => {
  console.log('State updated:', state)
})

// Update state
store.update((draft) => {
  draft.todos.push({
    id: Date.now(),
    text: 'New todo',
    completed: false
  })
})

// Get current state
const currentState = store.getState()
console.log('Current todos:', currentState.todos)

// Unsubscribe when no longer needed
unsubscribe()
```

### Advanced Features

#### Batching Updates

ISE provides batching capabilities for better performance:

```typescript
import { batchProduce, BatchQueue, createBatchQueue } from '@chris5855/ise'

// Create a batch queue
const batchQueue = createBatchQueue<TodoState>(initialState)

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
// Only one state update is performed
```

#### Memoization

ISE supports memoization to optimize performance:

```typescript
import { produceMemoized } from '@chris5855/ise'

// Create a recipe function
function addTodoRecipe(draft: Draft<TodoState>, todo: Todo) {
  draft.todos.push(todo)
}

// Use the memoized producer
const todo = { id: 1, text: 'Memoized todo', completed: false }
const stateWithTodo = produceMemoized(initialState, draft => addTodoRecipe(draft, todo))

// Subsequent calls with the same arguments will use the cached result
const stateWithSameTodo = produceMemoized(initialState, draft => addTodoRecipe(draft, todo))
// This will be much faster as it uses the cached result
```

#### Parallel Processing

For large state updates, ISE supports parallel processing:

```typescript
import { defaultShardingStrategy, produceParallel, ShardingStrategy } from '@chris5855/ise'

// Define a custom sharding strategy if needed
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
```

### TypeScript Support

ISE is built with TypeScript and provides excellent type safety:

```typescript
import { Draft, produce } from '@chris5855/ise'

// TypeScript will catch errors at compile time
const updatedState = produce(initialState, (draft: Draft<TodoState>) => {
  // Error: Property 'unknown' does not exist on type 'Draft<TodoState>'
  draft.unknown = 'value'

  // Error: Type 'string' is not assignable to type 'Todo[]'
  draft.todos = 'not an array'
})
```

---

## **:handshake: Contributing**

- Fork it!
- Create your feature branch: `git checkout -b my-new-feature`
- Commit your changes: `git commit -am 'Add some feature'`
- Push to the branch: `git push origin my-new-feature`
- Submit a pull request

---

### **:busts_in_silhouette: Credits**

- [Chris Michael](https://github.com/chrismichaelps) (Project Leader, and Developer)

---

### **:anger: Troubleshootings**

This is just a personal project created for study / demonstration purpose and to simplify my working life, it may or may
not be a good fit for your project(s).

---

### **:heart: Show your support**

Please :star: this repository if you like it or this project helped you!\
Feel free to open issues or submit pull-requests to help me improving my work.

<p>
  <a href="https://www.buymeacoffee.com/chrismichael" target="_blank">
    <img src="https://cdn.buymeacoffee.com/buttons/v2/default-red.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" />
  </a>
  <a href="https://paypal.me/chrismperezsantiago" target="_blank">
    <img src="https://www.paypalobjects.com/webstatic/mktg/logo/pp_cc_mark_111x69.jpg" alt="PayPal" style="height: 60px !important;" />
  </a>
</p>

---

### **:robot: Author**

_*Chris M. Perez*_

> You can follow me on
> [github](https://github.com/chrismichaelps)&nbsp;&middot;&nbsp;[twitter](https://twitter.com/Chris5855M)

---

Copyright ©2025 [ise](https://github.com/chrismichaelps/ise).

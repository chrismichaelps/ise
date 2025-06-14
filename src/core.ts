export class ISEError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ISEError'
  }
}

export type Draft<T> = T extends object
  ? { -readonly [K in keyof T]: Draft<T[K]> }
  : T

// Generic state constraint (objects or arrays)
export type State = object | any[]

// Create draft with lazy proxying
function createDraft<T extends State>(
  value: T,
  draftCache = new WeakMap<object, Draft<any>>(),
): Draft<T> {
  if (typeof value !== 'object' || value === null) {
    return value as Draft<T>
  }

  if (draftCache.has(value)) {
    return draftCache.get(value) as Draft<T>
  }

  const modifiedPaths = new Set<string | symbol>()
  const base = Array.isArray(value) ? [...value] : { ...value }

  const handler: ProxyHandler<any> = {
    get(target, prop, receiver) {
      // Handle array methods
      if (Array.isArray(target) && typeof prop === 'string') {
        const arrayMethod = Reflect.get(Array.prototype, prop)
        if (typeof arrayMethod === 'function') {
          return function (...args: any[]) {
            modifiedPaths.add(prop)
            return arrayMethod.apply(target, args)
          }
        }
      }

      const v = Reflect.get(target, prop, receiver)
      if (typeof v === 'object' && v !== null) {
        if (!draftCache.has(v)) {
          draftCache.set(v, createDraft(v, draftCache))
        }
        return draftCache.get(v)
      }
      return v
    },
    set(target, prop, value) {
      modifiedPaths.add(prop)
      target[prop] = typeof value === 'object' && value !== null
        ? createDraft(value, draftCache)
        : value
      return true
    },
    deleteProperty(target, prop) {
      modifiedPaths.add(prop)
      return Reflect.deleteProperty(target, prop)
    },
  }

  const proxy = new Proxy(base, handler) as Draft<T>
  draftCache.set(value, proxy)
  return proxy
}

// Finalize draft with structural sharing and circular reference handling
function finalizeDraft<T extends State>(draft: Draft<T>): T {
  if (typeof draft !== 'object' || draft === null) {
    return draft as T
  }

  function finalize(value: any, processed: WeakMap<object, any>): any {
    if (typeof value !== 'object' || value === null) {
      return value
    }
    if (processed.has(value)) {
      return processed.get(value)
    }
    const result: any = Array.isArray(value) ? [] : {}
    processed.set(value, result)
    const keys = Object.keys(value)
    for (const key of keys) {
      result[key] = finalize(value[key], processed)
    }
    return Object.freeze(result)
  }

  return finalize(draft, new WeakMap()) as T
}

// Deep clone that supports circular references
function deepClone<T>(obj: T, seen = new Map()): T {
  if (typeof obj !== 'object' || obj === null)
    return obj
  if (seen.has(obj))
    return seen.get(obj)
  const result: any = Array.isArray(obj) ? [] : {}
  seen.set(obj, result)
  for (const key of Object.keys(obj)) {
    result[key] = deepClone((obj as any)[key], seen)
  }
  return result
}

// Public produce function (synchronous)
export function produce<T extends State>(
  state: T,
  recipe: (draft: Draft<T>) => void,
): T {
  // Use deepClone to support circular references
  const stateCopy = deepClone(state)
  const draft = createDraft(stateCopy)

  try {
    recipe(draft)
  }
  catch (e) {
    throw new ISEError(`Recipe failed: ${e}`)
  }

  return finalizeDraft(draft)
}

// Batch produce function
export function batchProduce<T extends State>(
  state: T,
  recipes: Array<(draft: Draft<T>) => void>,
): T {
  // Use deepClone to support circular references
  const stateCopy = deepClone(state)
  const draft = createDraft(stateCopy)

  try {
    for (const recipe of recipes) {
      recipe(draft)
    }
  }
  catch (e) {
    throw new ISEError(`Batch recipe failed: ${e}`)
  }

  return finalizeDraft(draft)
}

// Batch queue for high-frequency updates
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
    return batchProduce(this.state, this.queue)
  }
}

export function createBatchQueue<T extends State>(state: T): BatchQueue<T> {
  return new BatchQueue(state)
}

const memoCache = new WeakMap<object, Map<string, any>>()

export function produceMemoized<T extends State>(
  state: T,
  recipe: (draft: Draft<T>) => void,
): T {
  // For primitive values, we can't use WeakMap, so we'll just call produce
  if (typeof state !== 'object' || state === null) {
    return produce(state, recipe)
  }

  // Create a unique key for this recipe
  const recipeKey = recipe.toString()

  // Get or create the cache for this state object
  if (!memoCache.has(state)) {
    memoCache.set(state, new Map())
  }

  const stateCache = memoCache.get(state)!

  // Check if we have a cached result for this recipe
  if (stateCache.has(recipeKey)) {
    return stateCache.get(recipeKey)
  }

  // If not, compute the result and cache it
  const result = produce(state, recipe)
  stateCache.set(recipeKey, result)

  return result
}

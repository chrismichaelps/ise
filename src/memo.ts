import type { Draft, State } from './core'
import { produce } from './core'

class Cache<K, V> {
  private cache = new Map<string, V>()

  private head: CacheNode | null = null
  private tail: CacheNode | null = null

  private objectRefs = new WeakMap<object, string>()

  private readonly maxSize: number
  private readonly ttl: number | null
  private readonly useWeakRefs: boolean

  constructor(options: {
    maxSize?: number
    ttl?: number | null
    useWeakRefs?: boolean
  } = {}) {
    this.maxSize = options.maxSize ?? 1000
    this.ttl = options.ttl ?? null
    this.useWeakRefs = options.useWeakRefs ?? true
  }

  private generateKey(key: K): string {
    if (key === null || key === undefined) {
      return String(key)
    }

    // For primitive values, use JSON.stringify
    if (typeof key !== 'object') {
      return JSON.stringify(key)
    }

    // For arrays, create a stable representation
    if (Array.isArray(key)) {
      return `array:${key.map(item => this.generateKey(item)).join(',')}`
    }

    // For objects, check if we already have a reference
    if (this.useWeakRefs && this.objectRefs.has(key as object)) {
      return this.objectRefs.get(key as object)!
    }

    // For objects, create a stable representation based on keys and values
    const objKey = key as object
    const objId = `obj:${Math.random().toString(36).substring(2, 9)}`

    if (this.useWeakRefs) {
      this.objectRefs.set(objKey, objId)
    }

    // For function keys (like recipes), use function name or toString
    if (typeof objKey === 'function') {
      const fnName = (objKey as { name?: string }).name || 'anonymous'
      return `fn:${fnName}:${objId}`
    }

    // For regular objects, use a combination of keys and values
    const entries = Object.entries(objKey as Record<string, any>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${this.generateKey(v)}`)
      .join('|')

    return `${objId}:${entries}`
  }

  get(key: K): V | undefined {
    const stringKey = this.generateKey(key)
    const value = this.cache.get(stringKey)

    if (value === undefined) {
      return undefined
    }

    // Update LRU order
    this.touch(stringKey)

    return value
  }

  set(key: K, value: V): void {
    const stringKey = this.generateKey(key)

    // If we're at capacity, evict the least recently used item
    if (this.cache.size >= this.maxSize) {
      this.evictLRU()
    }

    // Add to cache
    this.cache.set(stringKey, value)

    // Add to LRU list
    this.addToLRU(stringKey)
  }

  clear(): void {
    this.cache.clear()
    this.head = null
    this.tail = null
    // Note: objectRefs is a WeakMap, so it will be garbage collected automatically
  }

  getStats(): { size: number, maxSize: number, hitRate: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: this.hits / (this.hits + this.misses),
    }
  }

  private hits = 0
  private misses = 0

  private addToLRU(key: string): void {
    const node: CacheNode = { key, next: null, prev: null }

    if (!this.head) {
      this.head = this.tail = node
    }
    else {
      node.next = this.head
      this.head.prev = node
      this.head = node
    }
  }

  private touch(key: string): void {
    // Find the node
    let node = this.head
    while (node && node.key !== key) {
      node = node.next
    }

    if (!node)
      return

    // Remove from current position
    if (node.prev) {
      node.prev.next = node.next
    }
    else {
      this.head = node.next
    }

    if (node.next) {
      node.next.prev = node.prev
    }
    else {
      this.tail = node.prev
    }

    // Add to front (most recently used)
    node.next = this.head
    node.prev = null
    if (this.head) {
      this.head.prev = node
    }
    this.head = node

    if (!this.tail) {
      this.tail = node
    }
  }

  private evictLRU(): void {
    if (!this.tail)
      return

    const key = this.tail.key
    this.cache.delete(key)

    if (this.tail.prev) {
      this.tail.prev.next = null
      this.tail = this.tail.prev
    }
    else {
      this.head = this.tail = null
    }
  }
}

interface CacheNode {
  key: string
  next: CacheNode | null
  prev: CacheNode | null
}

const produceCache = new Cache<[State, (draft: Draft<any>) => void, any?], State>({
  maxSize: 1000,
  ttl: null,
  useWeakRefs: true,
})

export function produceMemoized<T extends State>(
  state: T,
  recipe: (draft: Draft<T>) => void,
  options?: {
    cacheKey?: any
    skipCache?: boolean
  },
): T {
  if (options?.skipCache) {
    return produce(state, recipe)
  }

  // Create a cache key from the state, recipe, and optional cacheKey
  const key: [T, (draft: Draft<T>) => void, any] = [state, recipe, options?.cacheKey]

  // Check if we have a cached result
  const cachedResult = produceCache.get(key)
  if (cachedResult) {
    return cachedResult as T
  }

  // If not, compute the result and cache it
  const result = produce(state, recipe)
  produceCache.set(key, result)

  return result
}

export function clearMemoizationCache(): void {
  produceCache.clear()
}

export function getMemoizationStats(): { size: number, maxSize: number, hitRate: number } {
  return produceCache.getStats()
}

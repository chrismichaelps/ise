// Generic state constraint (objects or arrays)
export type State = object | any[]

export type Draft<T> = T extends State
  ? { -readonly [K in keyof T]: Draft<T[K]> }
  : T

// Recipe type for state updates
export type Recipe<T extends State> = (draft: Draft<T>) => void

export interface ShardingStrategy<T extends State> {
  shard: (state: T) => Array<Partial<T>>
  merge: (chunks: Array<Partial<T>>) => T
}

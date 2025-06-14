// Core functionality
export {
  batchProduce,
  BatchQueue,
  createBatchQueue,
  type Draft,
  ISEError,
  produce,
  produceMemoized,
  type State,
} from './core'

// Parallel processing
export {
  defaultShardingStrategy,
  produceParallel,
  type ShardingStrategy,
} from './parallel'

// Type exports
export type { Recipe } from './types'

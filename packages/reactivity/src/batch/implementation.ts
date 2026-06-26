/**
 * Batch implementation - group signal updates into single flush.
 * @module
 */
import { endBatch, startBatch } from "../internal/system";

/**
 * Execute a callback while batching signal notifications into a single flush.
 *
 * `startBatch` increments the batch depth so writes queue their effects instead
 * of flushing immediately. `endBatch` decrements the depth and flushes only
 * when the outermost batch finishes. The `finally` block guarantees the batch
 * depth is restored and partial updates are flushed even when `fn` throws.
 *
 * @template T
 * @param {() => T} fn Callback to run within the batch.
 * @returns {T} Result of the callback.
 */
function batch<T>(fn: () => T): T {
  startBatch();
  try {
    return fn();
  } finally {
    endBatch();
  }
}

export { batch };

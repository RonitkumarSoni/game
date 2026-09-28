/**
 * Neon Rift Racers — Generic Object Pool
 *
 * Pre-allocates and recycles objects to avoid per-frame garbage creation.
 * Used for particles, projectiles, sound nodes, and other high-frequency
 * temporary objects.
 */

export interface Poolable {
  /** Reset this object for reuse. Called when the object is acquired from the pool. */
  reset(): void;
  /** Whether this object is currently active (in use). */
  active: boolean;
}

export class ObjectPool<T extends Poolable> {
  private readonly items: T[];
  private readonly factory: () => T;
  private readonly maxSize: number;
  private activeCount = 0;

  /**
   * @param factory - Function that creates a new instance of T.
   * @param initialSize - Number of objects to pre-allocate.
   * @param maxSize - Maximum pool size (prevents unbounded growth).
   */
  constructor(factory: () => T, initialSize: number, maxSize: number = initialSize * 2) {
    this.factory = factory;
    this.maxSize = maxSize;
    this.items = [];

    for (let i = 0; i < initialSize; i++) {
      const item = factory();
      item.active = false;
      this.items.push(item);
    }
  }

  /**
   * Acquire an inactive object from the pool. Returns null if the pool is
   * exhausted and at max capacity.
   */
  acquire(): T | null {
    // First, try to find an inactive item
    for (const item of this.items) {
      if (!item.active) {
        item.active = true;
        item.reset();
        this.activeCount++;
        return item;
      }
    }

    // Pool exhausted — grow if under max
    if (this.items.length < this.maxSize) {
      const item = this.factory();
      item.active = true;
      item.reset();
      this.items.push(item);
      this.activeCount++;
      return item;
    }

    // At max capacity
    return null;
  }

  /**
   * Release an object back to the pool.
   */
  release(item: T): void {
    if (item.active) {
      item.active = false;
      this.activeCount--;
    }
  }

  /**
   * Release all active objects.
   */
  releaseAll(): void {
    for (const item of this.items) {
      item.active = false;
    }
    this.activeCount = 0;
  }

  /**
   * Iterate over all active items. The callback should not acquire or release.
   */
  forEachActive(fn: (item: T) => void): void {
    for (const item of this.items) {
      if (item.active) fn(item);
    }
  }

  /**
   * Get the number of currently active objects.
   */
  getActiveCount(): number {
    return this.activeCount;
  }

  /**
   * Get the total pool capacity (active + inactive).
   */
  getCapacity(): number {
    return this.items.length;
  }

  /**
   * Dispose the pool and all items. If items have a dispose method, call it.
   */
  dispose(): void {
    for (const item of this.items) {
      if ('dispose' in item && typeof (item as Record<string, unknown>).dispose === 'function') {
        (item as unknown as { dispose: () => void }).dispose();
      }
    }
    this.items.length = 0;
    this.activeCount = 0;
  }
}

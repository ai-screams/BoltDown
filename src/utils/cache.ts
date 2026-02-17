/**
 * Simple LRU (Least Recently Used) cache backed by a Map.
 * Map iteration order reflects insertion order, so the first key
 * is the oldest entry — which gets evicted when maxSize is exceeded.
 */
export class LruCache<V> {
  private readonly map: Map<string, V>
  private readonly maxSize: number

  constructor(maxSize: number) {
    this.map = new Map()
    this.maxSize = maxSize
  }

  get(key: string): V | undefined {
    const value = this.map.get(key)
    if (value === undefined) return undefined
    // Move to end (most recently used)
    this.map.delete(key)
    this.map.set(key, value)
    return value
  }

  set(key: string, value: V): void {
    // If key already exists, delete first so it moves to end
    if (this.map.has(key)) {
      this.map.delete(key)
    } else if (this.map.size >= this.maxSize) {
      // Evict oldest entry (first key in iteration order)
      const firstKey = this.map.keys().next().value as string
      this.map.delete(firstKey)
    }
    this.map.set(key, value)
  }

  clear(): void {
    this.map.clear()
  }

  get size(): number {
    return this.map.size
  }
}

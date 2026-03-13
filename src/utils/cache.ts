/**
 * Zotero Paper Copilot - Cache Module
 *
 * Local caching layer for LLM responses, parsing results, etc.
 * Supports configurable TTL and cache key generation
 */

import { config } from "../../package.json";

export interface CacheOptions {
  ttl?: number; // Time to live in milliseconds (default: 1 hour)
  maxSize?: number; // Maximum number of items (default: 100)
}

export interface CacheEntry<T> {
  value: T;
  timestamp: number;
  expiresAt: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
}

/**
 * Generate cache key from multiple arguments
 * @param args - Arguments to generate key from
 * @returns Cache key string
 */
export function generateCacheKey(
  ...args: (string | number | object | undefined | null)[]
): string {
  return args
    .map((arg) => {
      if (arg === undefined || arg === null) {
        return "";
      }
      if (typeof arg === "object") {
        // Sort object keys for consistent hashing
        try {
          return JSON.stringify(arg, Object.keys(arg).sort());
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    })
    .filter(Boolean)
    .join(":");
}

/**
 * Generate hash for cache key
 * @param key - Key string
 * @returns Hash string
 */
function hashKey(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Local memory cache implementation
 */
export class LocalCache<T = any> {
  private cache: Map<string, CacheEntry<T>>;
  private options: Required<CacheOptions>;
  private stats: CacheStats;

  /**
   * Create a new cache instance
   * @param name - Cache name (used for prefix)
   * @param options - Cache configuration options
   */
  constructor(
    public readonly name: string = "default",
    options: CacheOptions = {},
  ) {
    this.cache = new Map();
    this.options = {
      ttl: options.ttl ?? 3600000, // 1 hour default
      maxSize: options.maxSize ?? 100,
    };
    this.stats = {
      hits: 0,
      misses: 0,
      size: 0,
    };
  }

  /**
   * Get value from cache
   * @param key - Cache key
   * @returns Cached value or undefined if not found/expired
   */
  get(key: string): T | undefined {
    const fullKey = this.getFullKey(key);
    const entry = this.cache.get(fullKey);

    if (!entry) {
      this.stats.misses++;
      return undefined;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(fullKey);
      this.stats.size = this.cache.size;
      this.stats.misses++;
      return undefined;
    }

    this.stats.hits++;
    return entry.value;
  }

  /**
   * Set value in cache
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttl - Optional TTL override (milliseconds)
   */
  set(key: string, value: T, ttl?: number): void {
    const fullKey = this.getFullKey(key);
    const now = Date.now();
    const entryTTL = ttl ?? this.options.ttl;

    // Evict oldest entries if cache is full
    if (this.cache.size >= this.options.maxSize && !this.cache.has(fullKey)) {
      this.evictOldest();
    }

    const entry: CacheEntry<T> = {
      value,
      timestamp: now,
      expiresAt: now + entryTTL,
    };

    this.cache.set(fullKey, entry);
    this.stats.size = this.cache.size;
  }

  /**
   * Check if key exists in cache (without updating stats)
   * @param key - Cache key
   * @returns True if key exists and is not expired
   */
  has(key: string): boolean {
    const fullKey = this.getFullKey(key);
    const entry = this.cache.get(fullKey);

    if (!entry) {
      return false;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(fullKey);
      this.stats.size = this.cache.size;
      return false;
    }

    return true;
  }

  /**
   * Delete a key from cache
   * @param key - Cache key
   * @returns True if key was deleted
   */
  delete(key: string): boolean {
    const fullKey = this.getFullKey(key);
    const result = this.cache.delete(fullKey);
    this.stats.size = this.cache.size;
    return result;
  }

  /**
   * Clear all entries from cache
   */
  clear(): void {
    this.cache.clear();
    this.stats.size = 0;
  }

  /**
   * Get cache statistics
   * @returns Cache stats
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.stats.hits = 0;
    this.stats.misses = 0;
  }

  /**
   * Get cache hit rate as percentage
   * @returns Hit rate percentage (0-100)
   */
  getHitRate(): number {
    const total = this.stats.hits + this.stats.misses;
    if (total === 0) return 0;
    return Math.round((this.stats.hits / total) * 100);
  }

  /**
   * Update TTL for cache instance
   * @param ttl - New TTL in milliseconds
   */
  setTTL(ttl: number): void {
    this.options.ttl = ttl;
  }

  /**
   * Get full key with namespace prefix
   */
  private getFullKey(key: string): string {
    return `${this.name}:${hashKey(key)}`;
  }

  /**
   * Evict oldest entry from cache
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Get all keys (for debugging)
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Clean up expired entries
   */
  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    this.stats.size = this.cache.size;
    return cleaned;
  }
}

/**
 * Cache manager for centralized cache access
 */
export class CacheManager {
  private static caches: Map<string, LocalCache> = new Map();
  private static initialized = false;

  /**
   * Initialize cache manager
   */
  public static init(): void {
    if (this.initialized) return;

    this.initialized = true;

    if (typeof ztoolkit !== "undefined") {
      ztoolkit.log("Paper Copilot: Cache manager initialized");
    }
  }

  /**
   * Get or create a named cache
   * @param name - Cache name
   * @param options - Cache options
   */
  public static getCache<T = any>(
    name: string,
    options?: CacheOptions,
  ): LocalCache<T> {
    let cache = this.caches.get(name);

    if (!cache) {
      cache = new LocalCache<T>(name, options);
      this.caches.set(name, cache);
    }

    return cache;
  }

  /**
   * Get LLM response cache (with longer default TTL)
   */
  public static getLLMCache(): LocalCache {
    return this.getCache("llm", { ttl: 24 * 60 * 60 * 1000, maxSize: 200 }); // 24 hours
  }

  /**
   * Get PDF parsing cache
   */
  public static getPDFCache(): LocalCache {
    return this.getCache("pdf", { ttl: 60 * 60 * 1000, maxSize: 50 }); // 1 hour
  }

  /**
   * Get semantic scholar cache
   */
  public static getSemanticScholarCache(): LocalCache {
    return this.getCache("semantic-scholar", {
      ttl: 12 * 60 * 60 * 1000,
      maxSize: 100,
    }); // 12 hours
  }

  /**
   * Clear all caches
   */
  public static clearAll(): void {
    for (const cache of this.caches.values()) {
      cache.clear();
    }

    if (typeof ztoolkit !== "undefined") {
      ztoolkit.log("Paper Copilot: All caches cleared");
    }
  }

  /**
   * Get combined stats from all caches
   */
  public static getStats(): Record<string, CacheStats> {
    const result: Record<string, CacheStats> = {};

    for (const [name, cache] of this.caches.entries()) {
      result[name] = cache.getStats();
    }

    return result;
  }

  /**
   * Clean up expired entries in all caches
   */
  public static cleanupAll(): number {
    let total = 0;

    for (const cache of this.caches.values()) {
      total += cache.cleanup();
    }

    return total;
  }
}

/**
 * Decorator for caching async function results
 */
export function cached<T extends (...args: any[]) => Promise<any>>(
  cache: LocalCache,
  keyGenerator?: (...args: Parameters<T>) => string,
): (
  target: any,
  propertyKey: string,
  descriptor: TypedPropertyDescriptor<T>,
) => void {
  return function (
    target: any,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<T>,
  ) {
    const originalMethod = descriptor.value!;

    descriptor.value = async function (...args: Parameters<T>) {
      // Generate cache key
      const key = keyGenerator
        ? keyGenerator(...args)
        : generateCacheKey(propertyKey, ...args);

      // Check cache
      const cachedValue = cache.get(key);
      if (cachedValue !== undefined) {
        return cachedValue;
      }

      // Call original method
      const result = await originalMethod.apply(this, args);

      // Store in cache
      cache.set(key, result);

      return result;
    } as T;

    return descriptor;
  };
}

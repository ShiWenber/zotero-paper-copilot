/**
 * Zotero Paper Copilot - Cache Module
 *
 * Local caching layer for LLM responses, parsing results, etc.
 * Supports configurable TTL, LRU eviction, and access frequency tracking
 * 
 * Enhanced with smart caching features:
 * - LRU (Least Recently Used) eviction policy
 * - Access frequency tracking for better cache decisions
 * - Item-specific TTL based on modification timestamps
 * - Pagination support for large datasets
 */

import { config } from "../../package.json";

export interface CacheOptions {
  ttl?: number; // Time to live in milliseconds (default: 1 hour)
  maxSize?: number; // Maximum number of items (default: 100)
  enableLRU?: boolean; // Enable LRU eviction policy (default: true)
  trackAccess?: boolean; // Track access frequency (default: true)
}

export interface CacheEntry<T> {
  value: T;
  timestamp: number;
  expiresAt: number;
}

export interface SmartCacheEntry<T> {
  value: T;
  timestamp: number;
  expiresAt: number;
  accessCount: number;
  lastAccessed: number;
  modifiedAt?: number; // Item modification timestamp for smart invalidation
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  evictions: number;
}

export interface SmartCacheStats extends CacheStats {
  lruEvictions: number;
  ttlEvictions: number;
  accessFrequency: Map<string, number>;
}

export interface PaginationOptions {
  offset?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  hasMore: boolean;
  nextOffset?: number;
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
      enableLRU: options.enableLRU ?? false,
      trackAccess: options.trackAccess ?? false,
    };
    this.stats = {
      hits: 0,
      misses: 0,
      size: 0,
      evictions: 0,
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

// ============== Smart Cache (LRU + Access Frequency + Pagination) ==============

/**
 * Smart cache with LRU eviction, access frequency tracking, and pagination support
 */
export class SmartCache<T = any> {
  private cache: Map<string, SmartCacheEntry<T>>;
  private options: {
    ttl: number;
    maxSize: number;
    enableLRU: boolean;
    trackAccess: boolean;
  };
  private stats: {
    hits: number;
    misses: number;
    size: number;
    lruEvictions: number;
    ttlEvictions: number;
  };

  /**
   * Create a new smart cache instance
   */
  constructor(
    public readonly name: string = "smart",
    options: CacheOptions = {},
  ) {
    this.cache = new Map();
    this.options = {
      ttl: options.ttl ?? 3600000,
      maxSize: options.maxSize ?? 500,
      enableLRU: options.enableLRU ?? true,
      trackAccess: options.trackAccess ?? true,
    };
    this.stats = {
      hits: 0,
      misses: 0,
      size: 0,
      lruEvictions: 0,
      ttlEvictions: 0,
    };
  }

  /**
   * Get value from cache
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
      this.stats.ttlEvictions++;
      return undefined;
    }

    // Update access stats
    if (this.options.trackAccess) {
      entry.accessCount++;
      entry.lastAccessed = Date.now();
    }

    this.stats.hits++;
    return entry.value;
  }

  /**
   * Set value in cache with optional modification timestamp
   */
  set(key: string, value: T, options?: {
    ttl?: number;
    modifiedAt?: number;
  }): void {
    const fullKey = this.getFullKey(key);
    const now = Date.now();
    const entryTTL = options?.ttl ?? this.options.ttl;

    // Evict if necessary
    if (this.cache.size >= this.options.maxSize && !this.cache.has(fullKey)) {
      this.evict();
    }

    const entry: SmartCacheEntry<T> = {
      value,
      timestamp: now,
      expiresAt: now + entryTTL,
      accessCount: 0,
      lastAccessed: now,
      modifiedAt: options?.modifiedAt,
    };

    this.cache.set(fullKey, entry);
    this.stats.size = this.cache.size;
  }

  /**
   * Get value with pagination support
   */
  getPaginated(
    key: string,
    pagination: PaginationOptions,
  ): PaginatedResult<T> | undefined {
    const value = this.get(key);
    
    if (value === undefined) {
      return undefined;
    }

    // Handle array pagination
    if (Array.isArray(value)) {
      const offset = pagination.offset ?? 0;
      const limit = pagination.limit ?? 50;
      const items = value.slice(offset, offset + limit);
      
      return {
        items,
        total: value.length,
        hasMore: offset + limit < value.length,
        nextOffset: offset + limit < value.length ? offset + limit : undefined,
      };
    }

    // Handle object with items property
    if (typeof value === "object" && value !== null && "items" in value) {
      const obj = value as any;
      const items = obj.items as T[];
      const offset = pagination.offset ?? 0;
      const limit = pagination.limit ?? 50;
      const paginatedItems = items.slice(offset, offset + limit);
      
      return {
        items: paginatedItems,
        total: items.length,
        hasMore: offset + limit < items.length,
        nextOffset: offset + limit < items.length ? offset + limit : undefined,
      };
    }

    // Non-paginated value
    return {
      items: [value],
      total: 1,
      hasMore: false,
    };
  }

  /**
   * Check if key exists
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
   * Delete a key
   */
  delete(key: string): boolean {
    const fullKey = this.getFullKey(key);
    return this.cache.delete(fullKey);
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear();
    this.stats.size = 0;
  }

  /**
   * Get statistics
   */
  getStats(): SmartCacheStats {
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      size: this.stats.size,
      evictions: this.stats.lruEvictions + this.stats.ttlEvictions,
      lruEvictions: this.stats.lruEvictions,
      ttlEvictions: this.stats.ttlEvictions,
      accessFrequency: new Map(
        Array.from(this.cache.entries()).map(([k, v]) => [k, v.accessCount])
      ),
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats.hits = 0;
    this.stats.misses = 0;
    this.stats.lruEvictions = 0;
    this.stats.ttlEvictions = 0;
  }

  /**
   * Get hit rate
   */
  getHitRate(): number {
    const total = this.stats.hits + this.stats.misses;
    if (total === 0) return 0;
    return Math.round((this.stats.hits / total) * 100);
  }

  /**
   * Invalidate entries modified before a certain time
   */
  invalidateModifiedBefore(timestamp: number): number {
    let invalidated = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.modifiedAt && entry.modifiedAt < timestamp) {
        this.cache.delete(key);
        invalidated++;
      }
    }

    this.stats.size = this.cache.size;
    return invalidated;
  }

  /**
   * Get most frequently accessed keys
   */
  getMostAccessed(count: number = 10): Array<{ key: string; accessCount: number; value: T }> {
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => b[1].accessCount - a[1].accessCount)
      .slice(0, count)
      .map(([key, entry]) => ({
        key: key.replace(`${this.name}:`, ""),
        accessCount: entry.accessCount,
        value: entry.value,
      }));

    return entries;
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
        this.stats.ttlEvictions++;
      }
    }

    this.stats.size = this.cache.size;
    return cleaned;
  }

  /**
   * Evict entry using LRU policy
   */
  private evict(): void {
    if (!this.options.enableLRU) {
      // Just evict oldest by timestamp
      let oldestKey: string | null = null;
      let oldestTime = Infinity;

      for (const [key, entry] of this.cache.entries()) {
        if (entry.lastAccessed < oldestTime) {
          oldestTime = entry.lastAccessed;
          oldestKey = key;
        }
      }

      if (oldestKey) {
        this.cache.delete(oldestKey);
        this.stats.lruEvictions++;
      }
      return;
    }

    // LRU: Find least recently accessed entry
    let lruKey: string | null = null;
    let oldestAccess = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestAccess) {
        oldestAccess = entry.lastAccessed;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
      this.stats.lruEvictions++;
    }
  }

  private getFullKey(key: string): string {
    return `${this.name}:${hashKey(key)}`;
  }
}

// ============== Smart Cache Manager ==============

/**
 * Manager for smart caches with enhanced statistics
 */
export class SmartCacheManager {
  private static caches: Map<string, SmartCache> = new Map();

  /**
   * Get or create a smart cache
   */
  public static getCache<T = any>(
    name: string,
    options?: CacheOptions,
  ): SmartCache<T> {
    let cache = this.caches.get(name);

    if (!cache) {
      cache = new SmartCache<T>(name, options);
      this.caches.set(name, cache);
    }

    return cache;
  }

  /**
   * Get knowledge base smart cache
   */
  public static getKnowledgeBaseCache(): SmartCache {
    return this.getCache("knowledge-base", {
      ttl: 30 * 60 * 1000,
      maxSize: 500,
      enableLRU: true,
      trackAccess: true,
    });
  }

  /**
   * Clear all smart caches
   */
  public static clearAll(): void {
    for (const cache of this.caches.values()) {
      cache.clear();
    }
  }

  /**
   * Get combined stats from all smart caches
   */
  public static getStats(): Record<string, SmartCacheStats> {
    const result: Record<string, SmartCacheStats> = {};

    for (const [name, cache] of this.caches.entries()) {
      result[name] = cache.getStats();
    }

    return result;
  }

  /**
   * Cleanup expired entries in all smart caches
   */
  public static cleanupAll(): number {
    let total = 0;

    for (const cache of this.caches.values()) {
      total += cache.cleanup();
    }

    return total;
  }
}

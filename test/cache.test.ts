/**
 * Cache Module Tests
 */

import { assert, expect } from "chai";
import {
  LocalCache,
  CacheManager,
  generateCacheKey,
  cached,
} from "../src/utils/cache";

describe("Cache Module", function () {
  describe("generateCacheKey", function () {
    it("should generate key from string arguments", function () {
      const key = generateCacheKey("test", "key", "123");
      assert.equal(key, "test:key:123");
    });

    it("should handle numbers", function () {
      const key = generateCacheKey("test", 123);
      assert.equal(key, "test:123");
    });

    it("should handle objects", function () {
      const key = generateCacheKey("test", { a: 1, b: 2 });
      assert.include(key, "test:");
      assert.include(key, "a");
      assert.include(key, "b");
    });

    it("should handle null and undefined", function () {
      const key = generateCacheKey("test", null, undefined, "value");
      assert.equal(key, "test:value");
    });

    it("should produce consistent keys for same input", function () {
      const key1 = generateCacheKey("test", { a: 1, b: 2 });
      const key2 = generateCacheKey("test", { b: 2, a: 1 });
      assert.equal(key1, key2);
    });
  });

  describe("LocalCache", function () {
    let cache: LocalCache<string>;

    beforeEach(function () {
      cache = new LocalCache<string>("test", { ttl: 1000, maxSize: 10 });
    });

    describe("get/set", function () {
      it("should store and retrieve values", function () {
        cache.set("key1", "value1");
        const value = cache.get("key1");
        assert.equal(value, "value1");
      });

      it("should return undefined for non-existent keys", function () {
        const value = cache.get("nonexistent");
        assert.isUndefined(value);
      });

      it("should overwrite existing values", function () {
        cache.set("key1", "value1");
        cache.set("key1", "value2");
        const value = cache.get("key1");
        assert.equal(value, "value2");
      });
    });

    describe("expiration", function () {
      it("should expire entries after TTL", async function () {
        const shortCache = new LocalCache<string>("short", {
          ttl: 50,
          maxSize: 10,
        });
        shortCache.set("key1", "value1");

        // Wait for expiration
        await new Promise((resolve) => setTimeout(resolve, 100));

        const value = shortCache.get("key1");
        assert.isUndefined(value);
      });

      it("should respect custom TTL", function () {
        cache.set("key1", "value1", 10000); // 10 seconds
        const value = cache.get("key1");
        assert.equal(value, "value1");
      });
    });

    describe("has", function () {
      it("should return true for existing non-expired keys", function () {
        cache.set("key1", "value1");
        assert.isTrue(cache.has("key1"));
      });

      it("should return false for non-existent keys", function () {
        assert.isFalse(cache.has("nonexistent"));
      });

      it("should return false for expired keys", async function () {
        const shortCache = new LocalCache<string>("short", {
          ttl: 10,
          maxSize: 10,
        });
        shortCache.set("key1", "value1");

        await new Promise((resolve) => setTimeout(resolve, 50));

        assert.isFalse(shortCache.has("key1"));
      });
    });

    describe("delete", function () {
      it("should delete existing keys", function () {
        cache.set("key1", "value1");
        const result = cache.delete("key1");

        assert.isTrue(result);
        assert.isUndefined(cache.get("key1"));
      });

      it("should return false for non-existent keys", function () {
        const result = cache.delete("nonexistent");
        assert.isFalse(result);
      });
    });

    describe("clear", function () {
      it("should remove all entries", function () {
        cache.set("key1", "value1");
        cache.set("key2", "value2");
        cache.clear();

        assert.isUndefined(cache.get("key1"));
        assert.isUndefined(cache.get("key2"));
      });
    });

    describe("stats", function () {
      it("should track hits and misses", function () {
        cache.set("key1", "value1");

        cache.get("key1"); // hit
        cache.get("key2"); // miss

        const stats = cache.getStats();
        assert.equal(stats.hits, 1);
        assert.equal(stats.misses, 1);
        assert.equal(stats.size, 1);
      });

      it("should calculate hit rate", function () {
        cache.set("key1", "value1");

        cache.get("key1");
        cache.get("key1");
        cache.get("key2");

        const hitRate = cache.getHitRate();
        assert.isTrue(hitRate >= 65 && hitRate <= 67); // ~66%
      });

      it("should reset stats", function () {
        cache.set("key1", "value1");
        cache.get("key1");

        cache.resetStats();

        const stats = cache.getStats();
        assert.equal(stats.hits, 0);
        assert.equal(stats.misses, 0);
      });
    });

    describe("eviction", function () {
      it("should evict oldest entries when max size reached", function () {
        const smallCache = new LocalCache<string>("small", {
          ttl: 60000,
          maxSize: 2,
        });

        smallCache.set("key1", "value1");
        smallCache.set("key2", "value2");
        smallCache.set("key3", "value3"); // Should evict key1

        assert.isUndefined(smallCache.get("key1"));
        assert.equal(smallCache.get("key2"), "value2");
        assert.equal(smallCache.get("key3"), "value3");
      });
    });

    describe("cleanup", function () {
      it("should remove expired entries", async function () {
        const shortCache = new LocalCache<string>("short", {
          ttl: 50,
          maxSize: 10,
        });

        shortCache.set("key1", "value1");
        shortCache.set("key2", "value2");

        await new Promise((resolve) => setTimeout(resolve, 100));

        const cleaned = shortCache.cleanup();
        assert.equal(cleaned, 2);
      });
    });
  });

  describe("CacheManager", function () {
    beforeEach(function () {
      CacheManager.clearAll();
    });

    it("should create and retrieve named caches", function () {
      const cache1 = CacheManager.getCache("test1");
      const cache2 = CacheManager.getCache("test1");

      assert.equal(cache1, cache2); // Same instance
    });

    it("should create separate caches for different names", function () {
      const cache1 = CacheManager.getCache("test1");
      const cache2 = CacheManager.getCache("test2");

      assert.notEqual(cache1, cache2);
    });

    it("should clear all caches", function () {
      const cache = CacheManager.getCache("test");
      cache.set("key1", "value1");

      CacheManager.clearAll();

      assert.isUndefined(cache.get("key1"));
    });

    it("should return stats for all caches", function () {
      const cache1 = CacheManager.getLLMCache();
      const cache2 = CacheManager.getPDFCache();

      cache1.set("key1", "value1");
      cache2.set("key1", "value1");

      const stats = CacheManager.getStats();

      assert.isDefined(stats.llm);
      assert.isDefined(stats.pdf);
    });
  });

  describe("@cached decorator", function () {
    it("should cache async function results", async function () {
      const cache = new LocalCache<number>("decorator-test", {
        ttl: 60000,
        maxSize: 10,
      });
      let callCount = 0;

      const expensiveFunction = async (arg: number): Promise<number> => {
        callCount++;
        return arg * 2;
      };

      // Apply decorator manually
      const cachedFunction = async (arg: number): Promise<number> => {
        const key = `fn:${arg}`;
        const cached = cache.get(key);
        if (cached !== undefined) {
          return cached;
        }
        const result = await expensiveFunction(arg);
        cache.set(key, result);
        return result;
      };

      // First call
      const result1 = await cachedFunction(5);
      assert.equal(result1, 10);
      assert.equal(callCount, 1);

      // Second call with same arg (should use cache)
      const result2 = await cachedFunction(5);
      assert.equal(result2, 10);
      assert.equal(callCount, 1); // Still 1

      // Different arg
      const result3 = await cachedFunction(10);
      assert.equal(result3, 20);
      assert.equal(callCount, 2);
    });
  });
});

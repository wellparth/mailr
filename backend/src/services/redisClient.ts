import Redis from 'ioredis';

/**
 * In-memory fallback entry structure with TTL support.
 */
interface CacheEntry {
  value: string;
  expiresAt: number | null; // Timestamp in ms
}

/**
 * Resilient Redis & Caching Service for Mailr.
 * 
 * Provides high-performance distributed caching, pub/sub, and agent state storage.
 * Gracefully degrades to an in-memory TTL store if Redis is offline or not configured,
 * ensuring 100% continuous uptime across development and production environments.
 */
export class RedisService {
  private static instance: RedisService;
  private client: Redis | null = null;
  private subscriberClient: Redis | null = null;
  private isConnected = false;
  private memoryCache = new Map<string, CacheEntry>();
  private subscriptions = new Map<string, Set<(message: string) => void>>();
  private redisUrl: string;

  private constructor() {
    this.redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
    this.init();
  }

  public static getInstance(): RedisService {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService();
    }
    return RedisService.instance;
  }

  /**
   * Initializes Redis connection with non-blocking lazy connect and exponential backoff.
   */
  private async init() {
    try {
      this.client = new Redis(this.redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        connectTimeout: 2000,
        retryStrategy: (times) => {
          if (times > 5) {
            // After 5 attempts, back off to 30s checks to reduce noise
            return 30000;
          }
          return Math.min(times * 1000, 5000);
        },
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        console.log(`[RedisService] Connected to Redis instance at ${this.redisUrl.replace(/:[^:@]+@/, ':****@')}`);
      });

      this.client.on('ready', () => {
        this.isConnected = true;
      });

      this.client.on('error', (err) => {
        if (this.isConnected) {
          console.warn('[RedisService] Redis connection error, falling back to memory cache:', err.message);
        }
        this.isConnected = false;
      });

      this.client.on('close', () => {
        this.isConnected = false;
      });

      // Attempt initial connection without blocking app startup
      await this.client.connect().catch((err) => {
        console.info(`[RedisService] Redis at ${this.redisUrl.replace(/:[^:@]+@/, ':****@')} not currently accessible (${err.message}). Using resilient in-memory fallback cache.`);
        this.isConnected = false;
      });
    } catch (err: any) {
      console.warn('[RedisService] Failed to initialize Redis client, using memory fallback:', err.message);
      this.isConnected = false;
    }

    // Periodic cleanup of expired entries in memory fallback cache (every 60s)
    setInterval(() => this.cleanupMemoryCache(), 60000).unref();
  }

  /**
   * Removes expired keys from the in-memory fallback store.
   */
  private cleanupMemoryCache() {
    const now = Date.now();
    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.expiresAt !== null && entry.expiresAt <= now) {
        this.memoryCache.delete(key);
      }
    }
  }

  /**
   * Retrieve parsed JSON or string from Redis / fallback cache.
   */
  async get<T = any>(key: string): Promise<T | null> {
    if (this.isConnected && this.client) {
      try {
        const raw = await this.client.get(key);
        if (!raw) return null;
        try {
          return JSON.parse(raw) as T;
        } catch {
          return raw as unknown as T;
        }
      } catch (err) {
        console.warn(`[RedisService] Error getting key "${key}" from Redis:`, err);
      }
    }

    // Memory fallback
    const entry = this.memoryCache.get(key);
    if (!entry) return null;

    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      this.memoryCache.delete(key);
      return null;
    }

    try {
      return JSON.parse(entry.value) as T;
    } catch {
      return entry.value as unknown as T;
    }
  }

  /**
   * Set a key-value pair in Redis / fallback cache with optional TTL in seconds.
   */
  async set(key: string, value: any, ttlSeconds?: number): Promise<boolean> {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);

    if (this.isConnected && this.client) {
      try {
        if (ttlSeconds && ttlSeconds > 0) {
          await this.client.set(key, serialized, 'EX', ttlSeconds);
        } else {
          await this.client.set(key, serialized);
        }
        return true;
      } catch (err) {
        console.warn(`[RedisService] Error setting key "${key}" in Redis:`, err);
      }
    }

    // Memory fallback
    const expiresAt = ttlSeconds && ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null;
    this.memoryCache.set(key, { value: serialized, expiresAt });
    return true;
  }

  /**
   * Delete a key from cache.
   */
  async del(key: string): Promise<boolean> {
    if (this.isConnected && this.client) {
      try {
        await this.client.del(key);
      } catch (err) {
        console.warn(`[RedisService] Error deleting key "${key}" in Redis:`, err);
      }
    }
    this.memoryCache.delete(key);
    return true;
  }

  /**
   * Delete all keys matching a wildcard pattern (e.g. "mailr:ai:notes:*").
   */
  async delPattern(pattern: string): Promise<number> {
    let deletedCount = 0;

    if (this.isConnected && this.client) {
      try {
        const keys = await this.client.keys(pattern);
        if (keys.length > 0) {
          const res = await this.client.del(...keys);
          deletedCount += res;
        }
      } catch (err) {
        console.warn(`[RedisService] Error deleting pattern "${pattern}" in Redis:`, err);
      }
    }

    // Memory fallback pattern matching
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    for (const key of Array.from(this.memoryCache.keys())) {
      if (regex.test(key)) {
        this.memoryCache.delete(key);
        deletedCount++;
      }
    }

    return deletedCount;
  }

  /**
   * Checks if a key exists in cache.
   */
  async exists(key: string): Promise<boolean> {
    if (this.isConnected && this.client) {
      try {
        const count = await this.client.exists(key);
        return count > 0;
      } catch {}
    }
    const entry = this.memoryCache.get(key);
    if (!entry) return false;
    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      this.memoryCache.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Publish an event to a Redis channel or dispatch to in-process subscribers.
   */
  async publish(channel: string, message: any): Promise<number> {
    const payload = typeof message === 'string' ? message : JSON.stringify(message);

    if (this.isConnected && this.client) {
      try {
        return await this.client.publish(channel, payload);
      } catch (err) {
        console.warn(`[RedisService] Publish error on channel "${channel}":`, err);
      }
    }

    // In-memory dispatch
    const handlers = this.subscriptions.get(channel);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(payload);
        } catch (hErr) {
          console.error(`[RedisService] Error in subscriber handler for channel "${channel}":`, hErr);
        }
      }
      return handlers.size;
    }
    return 0;
  }

  /**
   * Subscribe to a channel.
   */
  async subscribe(channel: string, handler: (message: string) => void): Promise<void> {
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());
    }
    this.subscriptions.get(channel)!.add(handler);

    if (this.isConnected && this.client && !this.subscriberClient) {
      try {
        this.subscriberClient = new Redis(this.redisUrl, {
          lazyConnect: true,
          enableOfflineQueue: false,
        });
        await this.subscriberClient.connect();
        this.subscriberClient.on('message', (ch, msg) => {
          const chHandlers = this.subscriptions.get(ch);
          if (chHandlers) {
            chHandlers.forEach((h) => h(msg));
          }
        });
      } catch (err) {
        console.warn('[RedisService] Failed to initialize dedicated subscriber client:', err);
      }
    }

    if (this.subscriberClient && this.isConnected) {
      try {
        await this.subscriberClient.subscribe(channel);
      } catch {}
    }
  }

  /**
   * Get live Redis connection and memory cache diagnostics.
   */
  getStatus() {
    return {
      connected: this.isConnected,
      mode: this.isConnected ? 'redis' : 'memory-fallback',
      redisUrl: this.redisUrl.replace(/:[^:@]+@/, ':****@'),
      memoryKeysCount: this.memoryCache.size,
      activeSubscriptions: Array.from(this.subscriptions.keys()),
    };
  }

  /**
   * Disconnect Redis connection gracefully.
   */
  async disconnect() {
    if (this.subscriberClient) {
      await this.subscriberClient.quit().catch(() => {});
      this.subscriberClient = null;
    }
    if (this.client) {
      await this.client.quit().catch(() => {});
      this.client = null;
    }
    this.isConnected = false;
  }
}

export const redis = RedisService.getInstance();

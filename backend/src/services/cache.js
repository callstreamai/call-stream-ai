const NodeCache = require('node-cache');

const DEFAULT_TTL = parseInt(process.env.CACHE_TTL || '120', 10);

class CacheService {
  constructor() {
    this.cache = new NodeCache({
      stdTTL: DEFAULT_TTL,
      checkperiod: 60,
      useClones: false
    });
    this.stats = { hits: 0, misses: 0 };
  }

  buildKey(parts) {
    return parts.filter(Boolean).join(':');
  }

  get(key) {
    const val = this.cache.get(key);
    if (val !== undefined) {
      this.stats.hits++;
      return val;
    }
    this.stats.misses++;
    return null;
  }

  set(key, value, ttl) {
    this.cache.set(key, value, ttl || DEFAULT_TTL);
  }

  invalidateClient(clientId) {
    const keys = this.cache.keys().filter(k => k.includes(clientId));
    keys.forEach(k => this.cache.del(k));
    return keys.length;
  }

  invalidateDeployment(deploymentId) {
    const keys = this.cache.keys().filter(k => k.includes(deploymentId));
    keys.forEach(k => this.cache.del(k));
    return keys.length;
  }

  flush() {
    this.cache.flushAll();
  }

  getStats() {
    return { ...this.stats, keys: this.cache.getStats() };
  }
}

const cacheService = new CacheService();
module.exports = { cacheService, CacheService };

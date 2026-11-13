// Short-lived shared cache with in-flight de-duplication: identical requests from several users within the
// TTL share ONE upstream call (the same promise). Failures are not cached.
export function memo(name, { ttl, max = 1000 }) {
  const store = new Map(); // key -> { exp, promise }
  const stats = { hits: 0, misses: 0 };
  return {
    stats,
    get(key, fn, ttlOverride) {
      const now = Date.now();
      const hit = store.get(key);
      if (hit && hit.exp > now) {
        stats.hits++;
        return hit.promise;
      }
      stats.misses++;
      const promise = Promise.resolve().then(fn);
      if (store.size >= max) {
        for (const [k, v] of store) {
          if (v.exp <= now || store.size >= max) store.delete(k);
          if (store.size < max * 0.9) break;
        }
      }
      store.set(key, { exp: now + (ttlOverride ?? ttl), promise });
      promise.catch(() => {
        if (store.get(key)?.promise === promise) store.delete(key);
      });
      return promise;
    },
    clear: () => store.clear(),
    name,
  };
}

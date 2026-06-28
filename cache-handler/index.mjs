import { getEntry, setEntry } from './s3Store.mjs';
import { markRevalidated, maxRevalidatedAt } from './tagStore.mjs';
import { config } from './config.mjs';

// Next.js 16.2 단수 cacheHandler (incremental-cache/index.d.ts 계약).
// 메서드: get / set / revalidateTag(tags, durations?) / resetRequestCache.
// refreshTags 훅은 단수 핸들러에 없으므로(그건 cacheHandlers 복수=use cache 전용),
// 멀티 인스턴스 태그 검증은 get() 내부에서 수행한다.
export default class CacheHandler {
    constructor(ctx) {
        this.ctx = ctx;
    }

    async get(cacheKey, ctx) {
        if (config.disabled) return null; // 런타임 비상 킬스위치
        const entry = await getEntry(cacheKey, ctx?.kind);
        if (!entry) return null;
        // soft invalidation: 엔트리 태그 중 하나라도 lastModified 이후 revalidate됐으면 stale.
        if (maxRevalidatedAt(entry.tags || []) > entry.lastModified)
            return null;
        return entry.value;
    }

    async set(cacheKey, data, ctx) {
        if (config.disabled) return;
        await setEntry(cacheKey, ctx?.kind, {
            value: data,
            lastModified: Date.now(),
            tags: ctx?.tags || [],
            kind: ctx?.kind,
        });
    }

    // durations(Next16 SWR profile)는 soft invalidation에선 무시하고 now만 기록한다.
    async revalidateTag(tags) {
        const arr = Array.isArray(tags) ? tags : [tags];
        const now = Date.now();
        for (const tag of arr) markRevalidated(tag, now);
    }

    resetRequestCache() {} // 로컬 태그맵은 per-request 상태가 아니므로 no-op
}

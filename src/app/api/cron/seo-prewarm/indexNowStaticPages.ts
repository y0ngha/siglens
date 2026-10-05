import 'server-only';
import { STATIC_PAGE_PATHS } from '@/entities/sitemap-entry/lib/staticPagePaths';
import type { SitemapEntry } from '@/entities/sitemap-entry/model';
import { getRedisClient } from '@/shared/cache/redisClient';
import { SITE_URL } from '@/shared/lib/seo';

/** 마지막으로 IndexNow에 알린 정적 페이지 lastmod(해시: URL → ISO). */
export const STATIC_LASTMOD_KEY = 'indexnow:static-lastmod';

const TRACKED_STATIC_URLS: ReadonlySet<string> = new Set(
    STATIC_PAGE_PATHS.map(path => `${SITE_URL}${path}`)
);

export interface StaticLastmodDiff {
    /** 저장된 값과 다르거나 처음 보는 URL. */
    readonly changedUrls: readonly string[];
    /** 변한 URL의 새 값 — 제출이 큐에 들어간 **뒤에** 저장한다. */
    readonly updates: Readonly<Record<string, string>>;
}

/**
 * 감시 대상 엔트리의 lastmod를 저장된 값과 비교한다 — 순수 함수.
 *
 * 저장된 값이 없는 URL은 "변했다"로 센다. 그래서 **첫 실행이 곧 시드 + 1회 제출**이다
 * (별도 시드 단계가 없다). lastmod를 모르는 엔트리(`lastModified` 생략)는 비교할 수 없어 건너뛴다.
 */
export function diffStaticLastmod(
    entries: readonly SitemapEntry[],
    stored: Readonly<Record<string, string>>
): StaticLastmodDiff {
    const updates = Object.fromEntries(
        entries
            .filter(
                (entry): entry is SitemapEntry & { lastModified: Date } =>
                    TRACKED_STATIC_URLS.has(entry.url) &&
                    entry.lastModified !== undefined
            )
            .map(
                entry => [entry.url, entry.lastModified.toISOString()] as const
            )
            .filter(([url, current]) => stored[url] !== current)
    );
    return { changedUrls: Object.keys(updates), updates };
}

/** 저장된 해시를 읽는다. Redis가 없거나 비었으면 `{}`. 값은 `String()`으로 정규화한다. */
export async function readStaticLastmods(): Promise<Record<string, string>> {
    const redis = getRedisClient();
    if (redis === null) return {};
    const stored =
        await redis.hgetall<Record<string, unknown>>(STATIC_LASTMOD_KEY);
    if (stored === null) return {};
    return Object.fromEntries(
        Object.entries(stored).map(([url, value]) => [url, String(value)])
    );
}

/** 알린 lastmod를 저장한다 — 다음 tick이 같은 변화를 다시 알리지 않게. */
export async function writeStaticLastmods(
    updates: Readonly<Record<string, string>>
): Promise<void> {
    const redis = getRedisClient();
    if (redis === null || Object.keys(updates).length === 0) return;
    await redis.hset(STATIC_LASTMOD_KEY, { ...updates });
}

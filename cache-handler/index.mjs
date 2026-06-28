import { getEntry, setEntry } from './s3Store.mjs';
import { markRevalidated, maxRevalidatedAt } from './tagStore.mjs';
import { config } from './config.mjs';

// Next 16.2가 set()에 넘기는 페이지 태그 헤더 키.
// 출처: next/dist/lib/constants.js:275 — NEXT_CACHE_TAGS_HEADER = 'x-next-cache-tags'.
const NEXT_CACHE_TAGS_HEADER = 'x-next-cache-tags';

// set()의 모든 실태그 소스를 union한다.
//
// Next 16.2 source 검증(node_modules/next/dist/...):
//   - FETCH 엔트리: set context(SetIncrementalFetchCacheContext, response-cache/types.d.ts:177)는
//     `tags`만 갖는다. softTags는 GET context에만 있으나(types.d.ts:164) 멀티인스턴스/방어 목적으로
//     ctx.softTags도 union한다(없으면 무해). 추가로 CachedFetchValue.tags(types.d.ts:47)가 값 자체에
//     실린다 — file-system-cache.get이 data.value.tags를 신뢰하는 부분(file-system-cache.js:122).
//   - APP_PAGE / APP_ROUTE / PAGES 엔트리: set context에 `tags` 필드가 없다
//     (SetIncrementalResponseCacheContext, types.d.ts:184). Next는 페이지 태그를 캐시 값의 헤더
//     `x-next-cache-tags`에서 읽는다 — file-system-cache.get의
//     data.value.headers?.[NEXT_CACHE_TAGS_HEADER] (file-system-cache.js:214-216).
//     커스텀 cacheHandler.set(key, data, ctx)에서 data는 그 value 객체 자체이므로
//     헤더는 data.headers[NEXT_CACHE_TAGS_HEADER]에 위치한다(set 경로의 `headers: data.headers`,
//     file-system-cache.js set 블록과 동일 shape).
//
// 기존 `ctx?.tags || []`는 페이지를 항상 tags:[]로 저장해 revalidateTag가 ISR 페이지를
// 영구히 무효화하지 못했다(get의 maxRevalidatedAt(entry.tags)가 빈 배열만 봄).
export function collectTags(data, ctx) {
    const filterTags = list =>
        Array.isArray(list)
            ? list.filter(t => typeof t === 'string' && t.length > 0)
            : [];

    // APP_PAGE / APP_ROUTE / PAGES: 헤더 x-next-cache-tags(쉼표 구분).
    const header = data?.headers?.[NEXT_CACHE_TAGS_HEADER];
    const headerTags =
        typeof header === 'string'
            ? header
                  .split(',')
                  .map(t => t.trim())
                  .filter(t => t.length > 0)
            : [];

    return [
        ...new Set([
            // FETCH: set context의 tags(+방어적 softTags)와 값 자체의 tags.
            ...filterTags(ctx?.tags),
            ...filterTags(ctx?.softTags),
            ...filterTags(data?.tags),
            ...headerTags,
        ]),
    ];
}

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
        // Next 16.2 계약: get()은 CacheHandlerValue 래퍼 { lastModified, value }를 반환해야 한다.
        return { lastModified: entry.lastModified, value: entry.value };
    }

    async set(cacheKey, data, ctx) {
        // Next 계약: file-system-cache.set은 data가 falsy면 즉시 return한다
        // (incremental-cache/file-system-cache.js: `if (!this.flushToDisk || !data) return`).
        if (config.disabled || !data) return;
        // 빈/실패 렌더를 영속 캐시에 굳히지 않는다(#657 빈 ISR 캐시 동결 방지).
        // 캐시가 이제 재시작 간 durable하므로, html이 비어있거나 status가 4xx/5xx인
        // APP_PAGE/PAGES는 저장하지 않는다. notFound()는 body가 있는 404를 만드는데,
        // 이를 S3에 영속화하면 페이지 복구 후에도 404가 stale로 남는다(SEO 악영향).
        // status 필드는 response-cache/types.d.ts의 IncrementalCachedAppPageValue.status /
        // IncrementalCachedPageValue.status(number | undefined)에 실린다.
        const kind = data.kind;
        if (
            (kind === 'APP_PAGE' || kind === 'PAGES') &&
            (!data.html || (data.status && data.status >= 400))
        )
            return;
        // APP_ROUTE 엔트리(route handler 응답)는 html이 아니라 data.body(Buffer)+data.status를
        // 쓰므로 위 가드를 우회한다(CachedRouteValue, response-cache/types.d.ts:70 — body:Buffer,
        // status:number). 현재 캐시되는 APP_ROUTE는 순수 함수 og/twitter 이미지뿐이라 안전하나,
        // 미래에 에러를 반환하는 cached route handler가 4xx/5xx나 빈 body를 영속화하지 못하도록
        // 방어한다(#657 빈/실패 응답 동결 방지와 동일 취지).
        if (
            kind === 'APP_ROUTE' &&
            (!data.body || (data.status && data.status >= 400))
        )
            return;
        // set context엔 kind가 없다. fetch 엔트리는 data.kind==='FETCH'로 식별되므로,
        // get(ctx.kind)와 동일한 subfolder로 라우팅되도록 set은 data.kind를 사용한다.
        await setEntry(cacheKey, kind, {
            value: data,
            lastModified: Date.now(),
            tags: collectTags(data, ctx),
        });
    }

    // durations(Next16 SWR profile)는 soft invalidation에선 무시하고 now만 기록한다.
    async revalidateTag(tags) {
        const arr = Array.isArray(tags) ? tags : [tags];
        const now = Date.now();
        arr.forEach(tag => markRevalidated(tag, now));
    }

    resetRequestCache() {} // 로컬 태그맵은 per-request 상태가 아니므로 no-op
}

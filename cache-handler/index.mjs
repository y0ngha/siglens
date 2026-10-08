import { lookupEntry as s3Lookup } from './s3Store.mjs';
import {
    getEntry as memGet,
    setEntry as memSet,
    deleteEntry as memDelete,
} from './memStore.mjs';
import {
    getEntry as pageMemGet,
    setEntry as pageMemSet,
} from './pageMemStore.mjs';
import { pendingEntry, scheduleUpload } from './uploadQueue.mjs';
import { createBoundedLru } from './boundedLru.mjs';
import {
    ensureTagsFresh,
    markRevalidated,
    maxExpiredAt,
    maxRevalidatedAt,
    publishRevalidated,
} from './tagStore.mjs';
import { seedCacheControl, staleLastModified } from './nextInternals.mjs';
import { config } from './config.mjs';

// Next 16.2가 set()에 넘기는 페이지 태그 헤더 키.
// 출처: next/dist/lib/constants.js:275 — NEXT_CACHE_TAGS_HEADER = 'x-next-cache-tags'.
const NEXT_CACHE_TAGS_HEADER = 'x-next-cache-tags';

// FETCH 엔트리는 **크기로 갈라** 작은 것만 프로세스 내 LRU에 둔다 — 분포 근거는
// memStore.mjs 상단. 요약: `fetch/` 객체의 88%가 (gzip 기준) 8KB 이하인데 용량은 3%뿐이라
// S3 PUT 요청비만 만들고 있었다. 반대로 `bars-static` 같은 큰 엔트리는 재생성이
// 비싸고 인스턴스 간 공유가 값을 하므로 S3에 남긴다.
//
// FETCH에는 `fmpGet`뿐 아니라 Next `unstable_cache` 전체가 섞여 있고 그중 일부는
// Redis가 아니라 DB가 백엔드다. 크기 게이트가 그 비싼 쪽을 S3에 붙잡아 둔다.
//
// get은 메모리 → 업로드 대기 사본 → (네거티브 캐시) → S3 순으로 본다. 같은 키가 커져서
// S3로 승격되면 set이 메모리 사본을 지우므로, 메모리 히트가 낡은 값을 가릴 일은 없다.
// 페이지 엔트리도 같은 순서지만 메모리 계층이 pageMemStore.mjs(짧은 TTL)다.
//
// 태그 무효화 의미론은 저장소와 무관하다: 어디서 읽었든 아래 get()의
// ensureTagsFresh + maxExpiredAt / maxRevalidatedAt 판정을 똑같이 거친다.
function isFetchKind(kind) {
    return kind === 'FETCH';
}

// FETCH의 S3 404 네거티브 캐시.
//
// 작은 FETCH는 메모리에만 살고 S3에 쓰이지 않는다(memStore 게이트). 그래서 메모리에서
// 축출됐거나 재시작 후인 작은 키는 S3 GET이 **반드시** 404인데, 매번 GET을 냈다
// (2026-10 감사: S3 GET의 ~90%가 FETCH miss). 404를 짧게 기억해 같은 키의 연속 miss를
// 한 번의 GET으로 줄인다. set이 오면 그 키의 기억을 지운다.
//
// 인스턴스 로컬이라 다른 인스턴스가 그 사이 S3에 쓴 값을 TTL 동안 못 볼 수 있다 — 결과는
// "이 인스턴스가 한 번 더 재생성"이지 잘못된 값이 아니다. 그래서 TTL을 짧게 둔다.
const NEGATIVE_TTL_MS = 30_000;
const NEGATIVE_MAX_ENTRIES = 20_000;
const fetchNotFound = createBoundedLru({
    maxEntries: NEGATIVE_MAX_ENTRIES,
    ttlMs: NEGATIVE_TTL_MS,
});
// 큰 FETCH의 S3 쓰기 횟수. GET이 날아가는 사이 같은 키가 S3에 쓰이면(set이 기억을 지운 뒤
// GET의 404가 도착) 낡은 404를 기억하게 된다. GET 전후로 이 값이 바뀌었으면 기억하지
// 않는다 — 키별 추적 대신 전역 카운터인 이유는 S3로 가는 FETCH 쓰기가 드물어서다.
let fetchS3Writes = 0;

async function readFetchEntry(cacheKey) {
    const local = memGet(cacheKey) ?? pendingEntry(cacheKey, 'FETCH');
    if (local) return local;
    if (fetchNotFound.get(cacheKey)) return null;
    const writesBefore = fetchS3Writes;
    const { status, entry } = await s3Lookup(cacheKey, 'FETCH');
    if (status === 'not-found' && writesBefore === fetchS3Writes)
        fetchNotFound.set(cacheKey, true);
    return entry;
}

// 페이지 set 횟수(프로세스 전역). S3 GET이 날아가는 사이 같은 키에 set이 오면(재생성 완료)
// 늦게 도착한 GET의 **옛** 객체가 방금 쓴 새 값을 메모리 계층에서 덮어쓰고, 메모리 계층이
// 대기 사본보다 먼저 읽히므로 TTL 내내 옛 값이 이긴다. GET 전후로 이 값이 바뀌었으면 옛
// 객체를 메모리에 넣지 않고, 그 사이 쓰인 로컬 값을 우선한다. 키별이 아니라 전역인 이유는
// 페이지 쓰기가 드물어(재생성 빈도) 오탐의 비용이 "S3 객체를 이번만 메모리에 안 넣음"뿐이라서다.
let pageWrites = 0;

async function readPageEntry(cacheKey, kind) {
    const local = pageMemGet(cacheKey) ?? pendingEntry(cacheKey, kind);
    if (local) return local;
    const writesBefore = pageWrites;
    const { entry } = await s3Lookup(cacheKey, kind);
    if (writesBefore !== pageWrites) {
        return pageMemGet(cacheKey) ?? pendingEntry(cacheKey, kind) ?? entry;
    }
    if (entry) pageMemSet(cacheKey, entry);
    return entry;
}

// Next 기본 FileSystemCache.revalidateTag와 같은 판정
// (next/dist/server/lib/incremental-cache/file-system-cache.js:54-73):
// durations가 없으면 즉시 만료, 있으면 stale 표시. `revalidateTag(tag, 'max')`는
// `{ expire: 31536000 }`을 넘긴다(next/dist/server/revalidation-utils.js:119-123),
// `updateTag`·단일 인자 `revalidateTag`는 durations 없이 부른다(같은 파일 :125-135).
// expire가 0 이하면 FileSystemCache도 `expired = now`가 되므로 즉시 만료로 본다.
// 양수 expire의 미래 만료는 stale로 근사한다 — tagStore.mjs "미래 시점 expire는 근사한다".
export function isImmediateExpiry(durations) {
    if (!durations) return true;
    return typeof durations.expire === 'number' && durations.expire <= 0;
}

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
        const kind = ctx?.kind;
        const entry = isFetchKind(kind)
            ? await readFetchEntry(cacheKey)
            : await readPageEntry(cacheKey, kind);
        if (!entry) return null;
        // 재시작으로 Next 메모리에서 사라진 라우트 revalidate/expire를 되살린다.
        // IncrementalCache가 cacheControls를 읽기 전에 해야 같은 요청부터 맞는 판정·
        // Cache-Control이 나간다 — nextInternals.mjs `seedCacheControl` 참고.
        if (!isFetchKind(kind)) seedCacheControl(cacheKey, entry.cacheControl);
        // 멀티 인스턴스: 다른 인스턴스가 기록한 revalidateTag를 로컬 맵에 병합한다.
        // 콜드 인스턴스의 최초 1회만 실제로 await되고(공유 S3 엔트리를 fresh로 오판하지
        // 않도록), 이후에는 백그라운드로 돌아 read 경로에 지연을 더하지 않는다.
        await ensureTagsFresh();
        const tags = entry.tags || [];
        // 즉시 만료(updateTag 등): miss → Next가 블로킹 재생성. FileSystemCache가
        // areTagsExpired면 null을 돌려주는 것과 같다(file-system-cache.js:222-228, 242-246).
        if (maxExpiredAt(tags) > entry.lastModified) return null;
        // stale 무효화('max'): 엔트리를 버리지 않고 Next가 stale로 판정할 lastModified를
        // 돌려준다 → stale 서빙 + 백그라운드 재생성. 표현할 수 없는 경우(revalidate:false,
        // cacheControl 미상, expire 경계)만 예전처럼 miss다 — nextInternals.mjs 참고.
        if (maxRevalidatedAt(tags) > entry.lastModified) {
            const lastModified = staleLastModified({
                cacheKey,
                kind,
                entry,
                ctx,
                now: Date.now(),
            });
            return lastModified === null
                ? null
                : { lastModified, value: entry.value };
        }
        // Next 16 계약: get()은 CacheHandlerValue 래퍼 { lastModified, value }를 반환해야 한다.
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
        const entry = {
            value: data,
            lastModified: Date.now(),
            tags: collectTags(data, ctx),
        };
        if (isFetchKind(kind)) {
            fetchNotFound.delete(cacheKey);
            // 크기 게이트를 통과하면 메모리에서 끝. 통과하지 못하면 S3로 보내고,
            // 같은 키의 낡은 메모리 사본을 지워 get이 그걸 먼저 집지 않게 한다.
            if (memSet(cacheKey, entry)) return;
            memDelete(cacheKey);
            fetchS3Writes += 1;
        } else {
            // 라우트 revalidate/expire를 엔트리와 함께 영속한다 — Next는 이 값을 메모리에만
            // 두므로(incremental-cache/index.js:557) 재시작 후 get()이 되살린다.
            const cacheControl = ctx?.cacheControl;
            if (cacheControl && typeof cacheControl === 'object') {
                entry.cacheControl = {
                    revalidate: cacheControl.revalidate,
                    expire: cacheControl.expire,
                };
            }
            // 빌드(prerender)는 S3를 쓰지 않으므로(s3Store `config.buildPhase`) 페이지를
            // 들고 있을 이유가 없다 — 빌드 워커 힙에 수백 페이지를 쌓지 않는다.
            if (config.buildPhase) return;
            pageWrites += 1;
            pageMemSet(cacheKey, entry);
        }
        // 응답이 S3 PUT을 기다리지 않게 백그라운드로 올린다 — uploadQueue.mjs 참고.
        // 업로드가 끝날 때까지 같은 인스턴스의 get은 대기 사본을 본다.
        await scheduleUpload(cacheKey, kind, entry);
    }

    // durations: 'max' 등 프로필이면 stale(SWR), 없거나 expire<=0이면 즉시 만료.
    // 위 `isImmediateExpiry` 참고.
    async revalidateTag(tags, durations) {
        // 로컬과 원격이 같은 집합을 보도록 여기서 한 번만 정규화·필터한다.
        // (필터가 publishRevalidated에만 있으면 빈 문자열 같은 값이 로컬 맵에만 남는다.)
        const arr = (Array.isArray(tags) ? tags : [tags]).filter(
            tag => typeof tag === 'string' && tag.length > 0
        );
        if (arr.length === 0) return;

        const now = Date.now();
        const expired = isImmediateExpiry(durations);
        // 로컬 먼저 — 이 인스턴스의 read-your-writes는 원격 성패와 무관하게 보장된다.
        arr.forEach(tag => markRevalidated(tag, now, { expired }));
        // 그다음 durable 기록. 실패해도 throw하지 않고 로컬 전용으로 degrade한다.
        await publishRevalidated(arr, now, { expired });
    }

    resetRequestCache() {} // 태그맵은 per-request 상태가 아니므로 no-op
}

/** 테스트 격리용 — 네거티브 캐시와 쓰기 카운터를 초기화한다. */
export function __resetForTests() {
    fetchNotFound.clear();
    fetchS3Writes = 0;
    pageWrites = 0;
}

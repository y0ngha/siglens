// 페이지 엔트리(APP_PAGE / APP_ROUTE / PAGES) 전용 프로세스 내 L1 (bounded LRU + 짧은 TTL).
//
// ## 왜 필요한가
//
// `cacheMaxMemorySize: 0`이고 커스텀 핸들러라 Next 쪽 L1이 없다(next.config.ts 주석).
// 그래서 같은 페이지를 연달아 읽어도 매번 S3 GET + gunzip + v8.deserialize를 탄다 —
// 렌더된 HTML/RSC는 수백 KB라 이 비용이 요청 지연의 대부분이다. 크롤러가 같은 심볼의
// 탭들을 몰아서 치는 패턴에서 특히 두드러진다.
//
// ## 무엇을 보장하나
//
// - 태그 무효화 의미론은 그대로다. 이 맵은 핸들러 **안쪽**이라 `index.mjs` get()의
//   태그 판정(`maxExpiredAt` / `maxRevalidatedAt`)을 저장소와 무관하게 통과한다.
// - 같은 인스턴스의 set은 즉시 이 맵을 갱신한다(쓰기 직후 읽기는 새 값).
// - TTL(기본 30초, 상한 60초)은 **다른 인스턴스**가 S3에 쓴 새 값과의 괴리 상한이다.
//   운영은 1대라 실제로는 S3와 항상 같지만, 스케일아웃 시에도 낡은 페이지가 TTL 이상
//   머물지 않게 짧게 묶는다.
//
// ## 예산
//
// 바이트 예산(기본 128MB)이 실질 상한이다. 크기는 `approximateBytes`로 근사한다 —
// 문자열은 길이(UTF-16 코드 유닛 수), Buffer는 byteLength의 합이다. memStore.mjs와 같은
// 관례로 "본문 계상"이지 RSS가 아니다(한국어 HTML은 V8이 2바이트 문자열로 들고 있을 수
// 있어 최악 2배). 2026-10-04 실측 컨테이너 610MiB / 상한 2.5GiB라 여유 안이다.
// 운영 중 조정: SSM `/siglens/ISR_PAGE_CACHE_MAX_BYTES`, `/siglens/ISR_PAGE_CACHE_TTL_MS`.
// 킬 스위치: `ISR_PAGE_CACHE_DISABLED=true` — 이 계층만 우회한다(예전처럼 매번 S3).

import { createBoundedLru, readPositiveBound } from './boundedLru.mjs';

const MAX_TTL_MS = 60_000;

const TTL_MS = Math.min(
    readPositiveBound('ISR_PAGE_CACHE_TTL_MS', 30_000),
    MAX_TTL_MS
);
const MAX_BYTES = readPositiveBound(
    'ISR_PAGE_CACHE_MAX_BYTES',
    128 * 1024 * 1024
);
// 개수 상한은 보조 제동이다(작은 APP_ROUTE가 대량으로 쌓이는 경우). 바이트가 먼저 걸린다.
const MAX_ENTRIES = readPositiveBound('ISR_PAGE_CACHE_MAX_ENTRIES', 5_000);

const lru = createBoundedLru({
    maxEntries: MAX_ENTRIES,
    maxBytes: MAX_BYTES,
    ttlMs: TTL_MS,
});

// 호출 시점에 읽는다 — memStore.mjs `isDisabled`와 같은 이유(테스트 가능성 + 즉시 반영).
function isDisabled() {
    return process.env.ISR_PAGE_CACHE_DISABLED === 'true';
}

// 상태 로그. memStore.mjs `fetch-mem`과 같은 형식·주기(5분, JSON 한 줄)라 같은 Logs Insights
// 쿼리를 `filter event = "page-mem"`으로 바꿔 쓰면 된다. hit·miss·evicted는 프로세스 시작
// 이후 누적 카운터다. 이게 없으면 히트율 0%나 축출 스래싱이 밖에서 보이지 않는다.
const STATS_LOG_INTERVAL_MS = 5 * 60 * 1000;
const STATS_EVENT = 'page-mem';
let hits = 0;
let misses = 0;
// 0 = 아직 로그 없음 → 첫 접근에서 즉시 한 줄 남긴다(생존 확인).
let lastStatsLogAt = 0;

function logStatsThrottled() {
    const now = Date.now();
    if (now - lastStatsLogAt < STATS_LOG_INTERVAL_MS) return;
    lastStatsLogAt = now;
    const { size, totalBytes, evictions } = lru.stats();
    console.log(
        JSON.stringify({
            tag: 'isr-cache',
            event: STATS_EVENT,
            size,
            bytes: totalBytes,
            hit: hits,
            miss: misses,
            evicted: evictions,
        })
    );
}

function sizeOf(part) {
    if (typeof part === 'string') return part.length;
    if (Buffer.isBuffer(part) || ArrayBuffer.isView(part))
        return part.byteLength;
    return 0;
}

/**
 * 페이지 값 크기 근사. 필드는 response-cache/types.d.ts의
 * IncrementalCachedAppPageValue(html·rscData·postponed·segmentData),
 * IncrementalCachedPageValue(html·pageData), CachedRouteValue(body)다.
 * PAGES의 pageData(객체)는 이 앱에 Pages Router가 없어 고정 추정치로 둔다.
 */
export function approximateBytes(value) {
    if (!value || typeof value !== 'object') return 1024;
    const segments =
        value.segmentData instanceof Map
            ? [...value.segmentData.values()].reduce(
                  (sum, part) => sum + sizeOf(part),
                  0
              )
            : 0;
    const pageData = value.pageData ? 1024 : 0;
    return (
        sizeOf(value.html) +
        sizeOf(value.rscData) +
        sizeOf(value.postponed) +
        sizeOf(value.body) +
        segments +
        pageData
    );
}

export function getEntry(key) {
    if (isDisabled()) return null;
    logStatsThrottled();
    const entry = lru.get(key);
    if (entry === undefined) {
        misses += 1;
        return null;
    }
    hits += 1;
    return entry;
}

/** 받아들이면 true. 예산보다 큰 엔트리는 거부하고 같은 키의 옛 사본을 지운다. */
export function setEntry(key, entry) {
    if (isDisabled()) return false;
    return lru.set(key, entry, approximateBytes(entry?.value));
}

export function deleteEntry(key) {
    lru.delete(key);
}

/** 테스트 격리용. */
export function __resetForTests() {
    lru.clear();
    hits = 0;
    misses = 0;
    lastStatsLogAt = 0;
}

/** 테스트/진단용 현재 상태. */
export function statsForTest() {
    return { ...lru.stats(), hits, misses };
}

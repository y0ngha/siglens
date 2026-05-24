# News-Card 분석 결과: Redis 캐싱 → DB 영속화 설계

**날짜:** 2026-05-07
**범위:** siglens-core (결과 캐싱 제거) + siglens 앱 (DB-first 필터링)

---

## 배경 및 목표

news-card 분석 결과(번역·감성·요약)가 현재 두 곳에 이중 저장되고 있다:

- **Redis** — `v1:analysis:news-card:{newsId}:gemini-2.5-flash-lite`, TTL 30일
- **DB** — `news` 테이블의 `titleKo / bodyKo / summaryKo / sentiment / category / priceImpact / analyzedAt`

뉴스 원본이 이미 DB에서 관리되므로 분석 결과도 DB가 primary store가 되어야 한다. Redis 30일 TTL로 메모리가 계속 쌓이고, Redis 장애 시 번역 캐시가 소실되는 문제도 있다.

**목표:** news-card 결과 캐싱용 Redis를 완전히 제거하고 DB를 단일 진실의 원천으로 만든다.
job tracking Redis(`setJobMeta` / `getJobStatus` / `getJobResult` / `cleanupJob`)는 변경 범위 밖이다.

---

## 현재 흐름

```
FMP fetch
  → upsert DB (모든 항목)
  → submitNewsCardAnalysis (① Redis cache.get → hit이면 cached 반환, miss이면 워커 POST)
  → pollNewsCardAnalysis (② 완료 시 Redis cache.set 30일 + DB attachAnalysis)
```

문제:
- `ensureNewsCardsAnalyzedAction`이 모든 항목에 대해 `submitNewsCardAnalysis`를 호출 → 이미 DB에 분석된 항목도 Redis hit 발생
- Redis miss 시 불필요한 AI 재호출 발생 가능

---

## 변경 후 흐름

```
FMP fetch
  → upsert DB (모든 항목)
  → DB에서 analyzedAt == null 필터링
  → [미분석 항목만] submitNewsCardAnalysis (Redis 체크 없음, 바로 워커 POST)
  → pollNewsCardAnalysis (완료 시 DB attachAnalysis만, Redis 저장 없음)
```

---

## 변경 명세

### 1. siglens-core — `submitNewsCardAnalysis`

**제거:**
- `buildNewsCardCacheKey(item.id)` 호출
- `createCacheProvider()` 호출
- `cache.get(cacheKey)` Redis 캐시 체크 블록 전체 (Step 1)
- `setJobMeta` 호출의 `cacheKey` 파라미터

**결과:** 함수는 항상 `submitted`를 반환한다. `cached` 분기가 사라진다.

```ts
// Before
async function submitNewsCardAnalysis(options) {
    const cacheKey = buildNewsCardCacheKey(item.id);
    const cache = createCacheProvider();
    if (cache !== null) {
        const cached = await cache.get(cacheKey);
        if (cached !== null) return { status: 'cached', result: normalize(cached) };
    }
    await setJobMeta(jobId, { symbol, modelId, cacheKey }); // cacheKey 포함
    ...
}

// After
async function submitNewsCardAnalysis(options) {
    // Redis 캐시 체크 없음 — 항상 워커로 디스패치
    await setJobMeta(jobId, { symbol, modelId }); // cacheKey 제거
    ...
}
```

### 2. siglens-core — `pollNewsCardAnalysis`

**제거:**
- `done` 분기의 `meta?.cacheKey` 참조
- `cache.set(meta.cacheKey, result, NEWS_CARD_CACHE_TTL_SECONDS)` 블록 전체

**결과:** 완료 시 Redis 저장을 하지 않는다. 결과를 반환만 한다.

```ts
// Before (done 분기)
if (meta?.cacheKey) {
    const cache = createCacheProvider();
    if (cache !== null) {
        fireAndForget(cache.set(meta.cacheKey, result, NEWS_CARD_CACHE_TTL_SECONDS), options);
    }
}

// After (done 분기)
// Redis 저장 없음 — 호출 측(siglens 앱)이 DB에 저장한다
```

### 3. siglens — `ensureNewsCardsAnalyzedAction`

upsert 완료 후 `analyzeAndPersist` 호출 전에 DB에서 이미 분석된 항목을 필터링한다.

```ts
// upsert 완료 후
const rows = await repo.listBySymbol(symbol, NEWS_ANALYSIS_LOOKBACK_MS);
const analyzedIds = new Set(
    rows.filter(r => r.analyzedAt !== null).map(r => r.id)
);
const unanalyzed = fresh.filter(item => !analyzedIds.has(item.id));

// analyzeAndPersist는 미분석 항목만 처리
const analyzeSettled = await Promise.allSettled(
    unanalyzed.map(item => analyzeAndPersist(item, repo))
);
```

**변경 전:** `fresh.map(item => analyzeAndPersist(item, repo))` — 전체 호출
**변경 후:** `unanalyzed.map(item => analyzeAndPersist(item, repo))` — 미분석만 호출

---

## 기존 Redis 데이터 처리

별도 migration 불필요. 기존 `v1:analysis:news-card:*` 키는 30일 TTL에 의해 자연 만료된다. 앱이 더 이상 읽지 않으므로 영향 없음.

---

## 타입 변경

`SubmitNewsCardAnalysisResult`에서 `cached` variant가 제거된다.

```ts
// Before
type SubmitNewsCardAnalysisResult =
    | { status: 'cached'; result: NewsCardAnalysis }
    | { status: 'submitted'; jobId: string };

// After
type SubmitNewsCardAnalysisResult =
    | { status: 'submitted'; jobId: string };
```

siglens 앱의 `analyzeAndPersist`에서 `cached` 분기 처리 코드도 함께 제거한다.

---

## 작업 순서

1. **siglens-core** — `submitNewsCardAnalysis` 변경 (Redis 체크 제거, cacheKey 파라미터 제거)
2. **siglens-core** — `pollNewsCardAnalysis` 변경 (Redis 저장 제거)
3. **siglens-core** — 타입 변경 (`SubmitNewsCardAnalysisResult`에서 `cached` 제거)
4. **siglens-core** — `buildNewsCardCacheKey` / `NEWS_CARD_CACHE_TTL_SECONDS` 제거 (다른 참조 없으면)
5. **siglens** — `ensureNewsCardsAnalyzedAction` 변경 (DB-first 필터링 + `cached` 분기 제거)
6. **siglens** — `analyzeAndPersist` 내 `cached` 분기 제거

---

## 영향 범위

| 파일 | 레포 | 변경 종류 |
|---|---|---|
| `application/news/submitNewsCardAnalysis.ts` | siglens-core | Redis 캐시 체크 제거 |
| `application/news/pollNewsCardAnalysis.ts` | siglens-core | Redis 결과 저장 제거 |
| `application/news/types.ts` (또는 해당 위치) | siglens-core | `cached` variant 제거 |
| `infrastructure/cache/config.ts` | siglens-core | `buildNewsCardCacheKey` 등 제거 |
| `infrastructure/market/ensureNewsCardsAnalyzedAction.ts` | siglens | DB-first 필터링 추가, `cached` 분기 제거 |

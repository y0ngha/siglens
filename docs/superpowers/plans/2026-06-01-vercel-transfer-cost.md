# Vercel 트랜스퍼 비용 절감 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** robots.txt 봇 차단 + OG 이미지/[symbol] 페이지 엣지 캐싱 + 404 캐시 오염 방지로 Vercel Fast Origin/Data Transfer 비용을 절감한다.

**Architecture:** (1) robots.txt로 기생 SEO 봇 차단(요청 수↓). (2) OG 이미지·정적 성격 페이지에 `revalidate` 부여(compute 호출↓). (3) `tf`를 읽는 chart/overall은 서버 searchParams 읽기를 제거하고 client `useSearchParams`로 위임(+`<Suspense>`)해 ISR 가능화. (4) FMP 인프라 에러를 throw로 바꿔 ISR이 일시 장애를 404로 캐싱하는 오염을 차단.

**Tech Stack:** Next.js 16 (App Router, ISR `revalidate`), React `Suspense`, Vitest, `@y0ngha/siglens-core`.

**Spec:** `docs/superpowers/specs/2026-06-01-vercel-transfer-cost-design.md`

**Git/Review flow (project convention, CLAUDE.md):** 구현은 orchestrator가 수행하고, 커밋·push·PR은 **git-agent**가 담당한다. 전체 구현 후 `review-agent → mistake-managing-agent → git-agent` 사이클을 거친다. 각 Task 끝의 "Checkpoint"는 typecheck/test green 확인 지점이며, 직접 커밋하지 않는다.

**공통 검증 명령:**
- 타입체크 + 린트: `yarn lint`
- 단위 테스트(특정 파일): `yarn test <path>`
- 전체 테스트: `yarn test`
- 빌드(라우트 캐싱 타입 확인): `yarn build`

---

## ⚠️ 구현 중 발견된 정정 (Corrections)

구현·빌드 검증 중 발견: **동적 라우트 `[symbol]`에는 `export const revalidate`만으로 ISR이 걸리지 않는다** (빌드가 `ƒ Dynamic`으로 표기, 매 요청 동적 렌더). Next.js 공식 동작상 "generateStaticParams가 배열을 반환(빈 배열이라도)하거나 `dynamic = 'force-static'`이어야 런타임 ISR이 활성화"된다.

따라서 아래 Task들의 실제 구현은 plan 원문에 더해 다음을 포함한다:
- **Task 5·6·7 (페이지 ISR)**: `revalidate`에 더해 각 page에 `export async function generateStaticParams(): Promise<{ symbol: string }[]> { return []; }` 추가 → 빌드에서 `● (SSG)`로 전환 확인.
- **Task 4 (OG/트위터 이미지)**: `revalidate`만으로는 `ƒ`로 남아, 12개 파일에 `export const dynamic = 'force-static'` 추가(이미지가 동적 요청 API 미사용이라 안전) → 빌드에서 `○ (Static)`로 전환 확인.
- `[symbol]/news`는 의도대로 `ƒ` 유지(D2①).

(이 정정은 `docs/MISTAKES.md` 후보: "동적 라우트 ISR엔 revalidate만으로 부족 — generateStaticParams/force-static 필요".)

## File Structure

| 파일 | 책임 | 변경 |
|---|---|---|
| `src/app/robots.ts` | robots.txt 생성 | 기생봇 Disallow 규칙 추가 (rules 배열화) |
| `src/app/__tests__/robots.test.ts` | robots 단위 테스트 | 배열 구조에 맞게 갱신 + 봇 차단 케이스 |
| `src/entities/ticker/lib/fmpTickerApi.ts` | FMP 티커 검색 | `strict` 옵션 추가 — 인프라 에러 throw |
| `src/entities/ticker/__tests__/lib/fmpTickerApi.test.ts` | 위 단위 테스트 | strict throw/lenient degrade 케이스 |
| `src/entities/ticker/lib/getAssetInfo.ts` | 티커 정보 resolve | `searchBySymbol(upper, { strict: true })` |
| `src/entities/ticker/__tests__/lib/getAssetInfo.test.ts` | 위 단위 테스트 | FMP throw 전파 케이스 |
| `src/app/[symbol]/**/{opengraph-image,twitter-image}.tsx` (12) | OG/트위터 이미지 | `export const revalidate = 2592000` |
| `src/app/[symbol]/options/page.tsx` · `fundamental/page.tsx` · `fear-greed/page.tsx` | 종목 탭(동적 트리거 없음) | `export const revalidate = 3600` |
| `src/app/[symbol]/page.tsx` | 차트 페이지 | 서버 `searchParams(tf)` 제거 + `<Suspense>` + `revalidate=3600` |
| `src/app/[symbol]/overall/page.tsx` | 종합 분석 페이지 | 서버 `searchParams(tf)` 제거 + `<Suspense>` + `revalidate=3600` |
| `src/widgets/overall/OverallContent.tsx` | 종합 분석 client | `timeframe` prop 제거 → `useSearchParams`로 client read |

**구현 순서(의존):** Task 1(봇, 독립) → Task 2·3(D3 안전장치, ISR 선결) → Task 4(OG) → Task 5(클린 페이지 ISR) → Task 6(차트 ISR) → Task 7(overall ISR) → Task 8(빌드 검증).

---

## Task 1: robots.txt 기생 봇 차단

**Files:**
- Modify: `src/app/robots.ts`
- Test: `src/app/__tests__/robots.test.ts`

- [ ] **Step 1: 기존 테스트를 배열 구조로 갱신 (실패 유도)**

`src/app/__tests__/robots.test.ts`의 `describe('robots', ...)` 내부를 아래로 교체. (기존 `rules`를 객체로 단언하던 3개 케이스가 배열로 바뀜)

```ts
    it('returns a valid robots config', () => {
        const result = robots();
        expect(result).toBeDefined();
        expect(Array.isArray(result.rules)).toBe(true);
    });

    it('allows all paths for the default user agent but disallows /api/', () => {
        const result = robots();
        expect(result.rules).toContainEqual(
            expect.objectContaining({
                userAgent: '*',
                allow: '/',
                disallow: ['/api/'],
            })
        );
    });

    it('disallows parasite SEO crawlers entirely', () => {
        const result = robots();
        expect(result.rules).toContainEqual(
            expect.objectContaining({
                userAgent: expect.arrayContaining([
                    'AhrefsBot',
                    'SemrushBot',
                    'MJ12bot',
                    'DotBot',
                    'BLEXBot',
                    'DataForSeoBot',
                ]),
                disallow: '/',
            })
        );
    });

    it('points sitemap to the correct URL', () => {
        const result = robots();
        expect(result.sitemap).toBe('https://siglens.io/sitemap.xml');
    });
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `yarn test src/app/__tests__/robots.test.ts`
Expected: FAIL — `result.rules`가 아직 객체라 `toContainEqual`/`Array.isArray` 실패.

- [ ] **Step 3: robots.ts 구현**

`src/app/robots.ts`를 아래로 교체:

```ts
import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/shared/lib/seo';

// 검색엔진이 아닌 기생 SEO 크롤러(백링크/순위 분석 SaaS). 포털 랭킹에 기여하지 않으면서
// 트래픽만 유발하므로 전면 Disallow한다 — Googlebot/Yeti/Bingbot/Daumoa 등 실제
// 검색엔진은 절대 포함하지 않는다. 이 봇들은 robots.txt를 준수한다.
const PARASITE_BOT_USER_AGENTS = [
    'AhrefsBot',
    'SemrushBot',
    'MJ12bot',
    'DotBot',
    'BLEXBot',
    'DataForSeoBot',
];

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: '*',
                allow: '/',
                // API 라우트는 disallow로 유지 — 응답이 JSON/이미지 등 SEO 가치
                // 없는 자원이라 crawl budget 절약 목적.
                disallow: ['/api/'],
            },
            {
                userAgent: PARASITE_BOT_USER_AGENTS,
                disallow: '/',
            },
        ],
        sitemap: `${SITE_URL}/sitemap.xml`,
    };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `yarn test src/app/__tests__/robots.test.ts`
Expected: PASS (4 케이스)

- [ ] **Step 5: Checkpoint**

Run: `yarn lint`
Expected: 통과. (다음 Task로 진행)

---

## Task 2: fmpTickerApi `strict` 에러 모드 (D3 part 1)

**Files:**
- Modify: `src/entities/ticker/lib/fmpTickerApi.ts`
- Test: `src/entities/ticker/__tests__/lib/fmpTickerApi.test.ts`

**배경:** 현재 `fetchFmpEndpoint`는 `!config`·`!res.ok`·network/timeout을 전부 `return []`로 삼킨다. `getAssetInfo`(ISR 렌더 경로)가 이를 통해 일시 장애를 "no-match"로 오인 → `notFound()` → ISR이 정상 종목 404를 캐시. `strict` 옵션을 추가해 **인프라 실패는 throw**, **200+빈배열만 `[]`**(legit no-match)로 구분한다. 인터랙티브 검색(`searchTicker.ts`)은 lenient 기본값 유지.

- [ ] **Step 1: 실패 테스트 작성**

`src/entities/ticker/__tests__/lib/fmpTickerApi.test.ts`의 `describe('searchBySymbol/searchByName', ...)` 블록 안(기존 `beforeEach` 뒤)에 추가:

```ts
    describe('strict mode (getAssetInfo 경로)', () => {
        it('!res.ok(429/5xx)면 throw한다', async () => {
            mockFetch.mockResolvedValue({ ok: false, status: 429 });
            await expect(
                searchBySymbol('AAPL', { strict: true })
            ).rejects.toThrow();
        });

        it('network/timeout 예외면 throw한다', async () => {
            mockFetch.mockRejectedValue(new Error('network down'));
            await expect(
                searchBySymbol('AAPL', { strict: true })
            ).rejects.toThrow();
        });

        it('200 + 빈 배열은 throw하지 않고 [] 반환 (legit no-match)', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                json: async () => [],
            });
            await expect(
                searchBySymbol('NOPE', { strict: true })
            ).resolves.toEqual([]);
        });

        it('lenient(기본값)는 에러 시 여전히 []로 degrade한다', async () => {
            mockFetch.mockResolvedValue({ ok: false, status: 500 });
            await expect(searchBySymbol('AAPL')).resolves.toEqual([]);
        });
    });
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `yarn test src/entities/ticker/__tests__/lib/fmpTickerApi.test.ts`
Expected: FAIL — `searchBySymbol`가 아직 `strict` 옵션을 모르고 throw하지 않음.

- [ ] **Step 3: fmpTickerApi.ts 구현**

`fetchFmpEndpoint`와 `searchBySymbol`을 아래로 교체 (`searchByName`은 그대로 둔다):

```ts
async function fetchFmpEndpoint(
    endpoint: FmpEndpoint,
    query: string,
    options?: { strict?: boolean }
): Promise<FmpSearchResult[]> {
    const strict = options?.strict ?? false;

    const config = tryReadFmpConfig();
    if (!config) {
        // strict(getAssetInfo): 미설정은 인프라 문제 — null→404 캐싱을 막기 위해 throw.
        // lenient(검색 UI): 기존대로 빈 결과로 degrade.
        if (strict) throw new Error('[fmpTickerApi] FMP config missing');
        return [];
    }

    const params = new URLSearchParams({
        query,
        limit: String(FMP_SEARCH_LIMIT),
        apikey: config.apiKey,
    });
    const url = `${FMP_BASE_URL}/${endpoint}?${params}`;

    let res: Response;
    try {
        res = await fetch(url, {
            signal: AbortSignal.timeout(FMP_FETCH_TIMEOUT_MS),
        });
    } catch (e) {
        if (strict)
            throw new Error(`[fmpTickerApi] ${endpoint} fetch failed`, {
                cause: e,
            });
        return [];
    }

    if (!res.ok) {
        if (strict)
            throw new Error(`[fmpTickerApi] ${endpoint} HTTP ${res.status}`);
        return [];
    }

    let raw: unknown;
    try {
        raw = await res.json();
    } catch (e) {
        if (strict)
            throw new Error(`[fmpTickerApi] ${endpoint} JSON parse failed`, {
                cause: e,
            });
        return [];
    }

    // 비배열 응답은 신뢰할 수 없는 형태 — strict에선 throw해 no-match로 오인/캐싱 방지.
    if (!Array.isArray(raw)) {
        if (strict)
            throw new Error(
                `[fmpTickerApi] ${endpoint} unexpected non-array response`
            );
        return [];
    }

    // FMP search endpoints return a JSON array of records matching FmpSearchResult.
    // 200 + 빈 배열은 정상적인 "매칭 없음"이므로 strict에서도 throw하지 않는다.
    return toFmpSearchResults(raw);
}

export async function searchBySymbol(
    query: string,
    options?: { strict?: boolean }
): Promise<FmpSearchResult[]> {
    return fetchFmpEndpoint('search-symbol', query, options);
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `yarn test src/entities/ticker/__tests__/lib/fmpTickerApi.test.ts`
Expected: PASS (신규 4 + 기존 케이스 전부)

- [ ] **Step 5: Checkpoint**

Run: `yarn lint`
Expected: 통과.

---

## Task 3: getAssetInfo strict 적용 (D3 part 2)

**Files:**
- Modify: `src/entities/ticker/lib/getAssetInfo.ts:186`
- Test: `src/entities/ticker/__tests__/lib/getAssetInfo.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`getAssetInfo.test.ts` 상단 mock 중 `searchBySymbol` mock이 options를 전달하도록 보정 (정확성):

```ts
vi.mock('../../lib/fmpTickerApi', async () => {
    const actual = await vi.importActual('../../lib/fmpTickerApi');
    return {
        ...actual,
        searchBySymbol: (q: string, options?: { strict?: boolean }) =>
            searchBySymbolMock(q, options),
    };
});
```

그리고 테스트 케이스 추가 (적절한 `describe` 블록 내):

```ts
    it('FMP 인프라 에러를 throw로 전파한다 (null로 degrade하지 않음)', async () => {
        createCacheProviderMock.mockReturnValue(null); // 캐시 미스
        tryGetTickerDatabaseClientMock.mockReturnValue(null); // DB 미가용 → FMP로 fall-through
        searchBySymbolMock.mockRejectedValue(new Error('FMP HTTP 429'));

        await expect(getAssetInfo('AAPL')).rejects.toThrow('FMP HTTP 429');
    });

    it('getAssetInfo가 searchBySymbol을 strict로 호출한다', async () => {
        createCacheProviderMock.mockReturnValue(null);
        tryGetTickerDatabaseClientMock.mockReturnValue(null);
        searchBySymbolMock.mockResolvedValue([]); // 200 빈 결과 → null

        await getAssetInfo('NOPE');

        expect(searchBySymbolMock).toHaveBeenCalledWith('NOPE', {
            strict: true,
        });
    });
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `yarn test src/entities/ticker/__tests__/lib/getAssetInfo.test.ts`
Expected: FAIL — 두 번째 케이스에서 `searchBySymbol`이 `{ strict: true }` 없이 호출됨.

- [ ] **Step 3: getAssetInfo.ts 구현**

`src/entities/ticker/lib/getAssetInfo.ts:186` 한 줄을 변경:

```ts
    const fmpResults = await searchBySymbol(upper, { strict: true });
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `yarn test src/entities/ticker/__tests__/lib/getAssetInfo.test.ts`
Expected: PASS (신규 2 + 기존 전부). 기존 케이스는 `searchBySymbolMock`이 resolve 값을 반환하므로 영향 없음.

- [ ] **Step 5: Checkpoint**

Run: `yarn lint && yarn test src/entities/ticker`
Expected: 통과. (D3 완료 — 이제 ISR 적용 안전)

---

## Task 4: OG/트위터 이미지 캐싱 (12개 파일)

**Files (각각 Modify):**
- `src/app/[symbol]/opengraph-image.tsx`, `twitter-image.tsx`
- `src/app/[symbol]/options/opengraph-image.tsx`, `twitter-image.tsx`
- `src/app/[symbol]/fundamental/opengraph-image.tsx`, `twitter-image.tsx`
- `src/app/[symbol]/news/opengraph-image.tsx`, `twitter-image.tsx`
- `src/app/[symbol]/fear-greed/opengraph-image.tsx`, `twitter-image.tsx`
- `src/app/[symbol]/overall/opengraph-image.tsx`, `twitter-image.tsx`

**배경:** 이미지 콘텐츠는 `buildSymbolOgImage({ ticker, label })`의 순수 함수 — fresh 데이터/`getAssetInfo` 호출 없음 → 404 위험 없이 길게 캐시 가능. 템플릿 변경은 배포 시 캐시 자동 무효화.

- [ ] **Step 1: 12개 파일 각각에 revalidate 추가**

각 파일의 기존 `export const size = ...` 줄 **위**(import 직후)에 한 줄 추가:

```ts
// OG 이미지는 (ticker, label) 순수 함수라 fresh 데이터가 없음 → 길게 캐시.
// 템플릿 변경은 배포 시 캐시가 무효화된다.
export const revalidate = 2592000; // 30d
```

- [ ] **Step 2: 빌드로 OG 라우트 캐싱 확인**

Run: `yarn build`
Expected: 빌드 성공. 빌드 라우트 목록에서 `/[symbol]/.../opengraph-image`·`twitter-image`가 동적(ƒ)이 아닌 캐시/ISR 표기로 전환(또는 revalidate 표기). 에러 없음.

- [ ] **Step 3: Checkpoint**

Run: `yarn lint`
Expected: 통과.

---

## Task 5: 클린 종목 탭 ISR (options / fundamental / fear-greed)

**Files (각각 Modify):**
- `src/app/[symbol]/options/page.tsx`
- `src/app/[symbol]/fundamental/page.tsx`
- `src/app/[symbol]/fear-greed/page.tsx`

**배경:** 세 페이지는 동적 트리거(`searchParams`/`headers`/`cookies`)가 없어 `revalidate`만 추가하면 ISR된다. 렌더 중 데이터 fetch(예: `fetchOptionsSnapshot`)는 재검증 시점에 실행되어 baked되고, 클라가 재hydrate한다. `getAssetInfo` null만이 404를 만들며 Task 3로 안전.

- [ ] **Step 1: 세 page.tsx 각각에 revalidate 추가**

각 파일 상단(첫 `export async function generateMetadata` **위**, import 직후)에 추가:

```ts
// 종목당 SEO 콘텐츠는 고정이고 동적 데이터는 클라가 재hydrate한다. 엣지 캐시로
// compute 호출을 줄인다. (일시 인프라 장애의 404 캐싱은 getAssetInfo strict로 차단)
export const revalidate = 3600; // 1h
```

- [ ] **Step 2: 빌드로 ISR 전환 확인**

Run: `yarn build`
Expected: 빌드 성공. `/[symbol]/options`·`/fundamental`·`/fear-greed`가 동적(ƒ)에서 ISR(revalidate 1h)로 전환 표기.

- [ ] **Step 3: Checkpoint**

Run: `yarn lint`
Expected: 통과.

---

## Task 6: 차트 페이지 ISR (서버 tf 제거 + Suspense)

**Files:**
- Modify: `src/app/[symbol]/page.tsx`

**배경:** `searchParams(tf)` 서버 읽기가 라우트를 동적으로 강제. tf는 클라(`SymbolPageClient` → `useTimeframeChange` → `useSearchParams`)가 이미 소유하므로 서버 읽기를 제거하고 prefetch/peek은 `DEFAULT_TIMEFRAME`로 seed한다. **CSR-bailout 주의**: 정적 렌더에서 `useSearchParams`를 쓰는 client 서브트리는 `<Suspense>`로 감싸야 하며, 그 서브트리는 client에서 렌더된다(페이지 레벨 sr-only SEO 콘텐츠·JSON-LD는 서버 정적 유지). canonical은 이미 tf 제외라 색인 무영향.

- [ ] **Step 1: Props에서 searchParams 제거 + Suspense import + revalidate**

`src/app/[symbol]/page.tsx` 상단:
- `import { notFound } from 'next/navigation';` 아래에 `import { Suspense } from 'react';` 추가.
- `Props` 인터페이스에서 `searchParams: Promise<{ tf?: string }>;` 줄 삭제.
- 파일 상단(첫 export 위)에 추가:
```ts
export const revalidate = 3600; // 1h — ISR
```

- [ ] **Step 2: 본문에서 tf 읽기 제거 + DEFAULT_TIMEFRAME 사용**

`SymbolPage` 함수 시그니처와 도입부 변경:

```ts
export default async function SymbolPage({ params }: Props) {
    const { symbol } = await params;
    const ticker = symbol.toUpperCase();
    if (!VALID_TICKER_RE.test(ticker)) notFound();
    const [assetInfo, skillCounts] = await Promise.all([
        getAssetInfoCached(ticker),
        countSkillFiles(),
    ]);
    if (!assetInfo) return notFound();
```

(즉 `const { tf } = await searchParams;`와 `const initialTimeframe = isValidTimeframe(tf) ? tf : DEFAULT_TIMEFRAME;` 두 줄 삭제. `isValidTimeframe` import가 더 이상 안 쓰이면 import도 제거.)

- [ ] **Step 3: prefetch/peek을 DEFAULT_TIMEFRAME로 단일화**

`const [, cachedAnalysis] = await Promise.all([ ... ]);` 블록을 아래로 교체:

```ts
    const [, cachedAnalysis] = await Promise.all([
        // 차트 페이지는 ISR로 캐시되므로 prefetch는 기본 timeframe만 seed한다.
        // ?tf= 딥링크는 클라(useTimeframeChange→useSearchParams)가 마운트 시 읽어
        // 해당 timeframe bars를 fetch한다.
        queryClient.prefetchQuery({
            queryKey: QUERY_KEYS.bars(
                symbol,
                DEFAULT_TIMEFRAME,
                assetInfo.fmpSymbol
            ),
            queryFn: barsQueryFn,
        }),
        peekAnalysisCache(
            ticker,
            DEFAULT_TIMEFRAME,
            assetInfo.fmpSymbol,
            GEMINI_2_5_FLASH_LITE_MODEL
        ).catch((error: unknown) => {
            console.error('[SymbolPage] peekAnalysisCache failed:', error);
            return null;
        }),
    ]);
```

- [ ] **Step 4: SymbolPageClient를 Suspense로 감싸기**

`<HydrationBoundary state={dehydrate(queryClient)}>` 안의 `<SymbolPageClient ... />`를 `<Suspense>`로 감싼다:

```tsx
                <HydrationBoundary state={dehydrate(queryClient)}>
                    <Suspense fallback={null}>
                        <SymbolPageClient
                            symbol={symbol}
                            companyName={assetInfo.name}
                            displayName={displayName}
                            initialAnalysis={initialAnalysis}
                            initialAnalysisFailed={true}
                            indicatorCount={skillCounts.indicators}
                        />
                    </Suspense>
                </HydrationBoundary>
```

> fallback=null인 이유: route-level `[symbol]/loading.tsx`가 내비게이션 스켈레톤을 이미 담당하고, SymbolPageClient는 차트(canvas) 기반이라 어차피 client 렌더가 필요하다. 레이아웃 시프트가 보이면 loading.tsx의 스켈레톤을 추출해 fallback으로 재사용한다.

- [ ] **Step 5: 빌드로 ISR 전환 + 타입 확인**

Run: `yarn build`
Expected: 빌드 성공(`missing-suspense-with-csr-bailout` 에러 없음). `/[symbol]`이 동적(ƒ)에서 ISR(revalidate)로 전환 표기. 타입 에러 없음(`searchParams`/`isValidTimeframe` 미사용 정리됨).

- [ ] **Step 6: Checkpoint**

Run: `yarn lint`
Expected: 통과.

---

## Task 7: overall 페이지 ISR (서버 tf 제거 + OverallContent client-read + Suspense)

**Files:**
- Modify: `src/app/[symbol]/overall/page.tsx`
- Modify: `src/widgets/overall/OverallContent.tsx`

**배경:** overall은 차트와 달리 `OverallContent`가 `timeframe`을 **서버 prop**으로 받는다. ISR화하려면 서버 searchParams 읽기를 제거하고, `OverallContent`가 `useSearchParams`로 tf를 직접 읽도록 바꾼다(read-only — overall엔 tf 셀렉터 UI가 없고 차트에서 넘어온 tf를 소비만 함). 서버 peek seed는 `DEFAULT_TIMEFRAME`로. widgets→widgets import는 허용.

- [ ] **Step 1: OverallContent가 useSearchParams로 tf를 읽도록 변경**

`src/widgets/overall/OverallContent.tsx`:
- import 추가:
```ts
import { useSearchParams } from 'next/navigation';
import { DEFAULT_TIMEFRAME, isValidTimeframe } from '@/shared/config/market';
```
- `OverallContentProps`에서 `timeframe: Timeframe;` 줄 삭제.
- 구조분해에서 `timeframe`을 제거하고, 함수 본문 첫 줄에서 URL로부터 read:

```ts
export function OverallContent({
    symbol,
    companyName,
    initialAnalysis,
}: OverallContentProps) {
    // ISR 정적 렌더 — tf는 서버가 아니라 client가 URL에서 읽는다(차트와 동일 소스).
    const tfParam = useSearchParams().get('tf');
    const timeframe = isValidTimeframe(tfParam) ? tfParam : DEFAULT_TIMEFRAME;
    const modelId = useDefaultModelId();
    const { state, trigger } = useOverallAnalysis(
        symbol,
        companyName,
        timeframe,
        modelId,
        initialAnalysis
    );
```

(이후 `buildChatState(state, timeframe)` 등 `timeframe` 사용부는 그대로 동작.)

> `Timeframe` 타입 import는 다른 곳에서 계속 쓰이면 유지, `timeframe` prop 제거로 미사용이 되면 제거.

- [ ] **Step 2: overall/page.tsx — 서버 tf 제거 + DEFAULT_TIMEFRAME peek + Suspense + revalidate**

`src/app/[symbol]/overall/page.tsx`:
- 상단 import에 `import { Suspense } from 'react';` 추가. 파일 상단에 `export const revalidate = 3600;` 추가.
- `Props`에서 `searchParams: Promise<{ tf?: string }>;` 삭제.
- 함수 시그니처를 `export default async function OverallPage({ params }: Props)`로 변경.
- 본문의 `const { tf } = await searchParams;`와 `const timeframe: Timeframe = isValidTimeframe(tf) ? tf : DEFAULT_TIMEFRAME;` 두 줄 삭제.
- `peekOverallAnalysisCache(upper, assetInfo.name, timeframe, GEMINI_2_5_FLASH_LITE_MODEL)`의 `timeframe`을 `DEFAULT_TIMEFRAME`로 교체.
- 미사용이 된 `isValidTimeframe`/`Timeframe` import 정리.
- 렌더의 `<OverallContent timeframe={timeframe} ... />`에서 `timeframe` prop 제거하고 `<Suspense fallback={null}>`로 감싼다:

```tsx
    return (
        <>
            {/* ...JsonLd 등 서버 정적 콘텐츠... */}
            <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
                <Suspense fallback={null}>
                    <OverallContent
                        symbol={upper}
                        companyName={assetInfo.name}
                        initialAnalysis={cachedOverall ?? undefined}
                    />
                </Suspense>
            </main>
        </>
    );
```

> `OverallContent`에 넘기던 기존 props(`symbol`/`companyName`/`initialAnalysis`)는 유지하고 `timeframe`만 제거한다. 기존 prop 전달 형태(예: `initialAnalysis` 전달 방식)는 현재 코드를 따른다.

- [ ] **Step 3: 빌드 + 타입 확인**

Run: `yarn build`
Expected: 빌드 성공(CSR-bailout 에러 없음). `/[symbol]/overall`이 ISR로 전환 표기. 타입 에러 없음.

- [ ] **Step 4: Checkpoint**

Run: `yarn lint && yarn test src/widgets/overall`
Expected: 통과. (OverallContent 관련 기존 테스트가 `timeframe` prop을 넘기고 있으면 그 테스트를 prop 제거 + `useSearchParams` mock 형태로 갱신한다.)

---

## Task 8: 통합 빌드 검증 + 라우트 캐싱 표 확인

**Files:** 없음 (검증만)

- [ ] **Step 1: 전체 테스트**

Run: `yarn test`
Expected: 전부 PASS.

- [ ] **Step 2: 전체 빌드 + 라우트 타입 확인**

Run: `yarn build`
Expected:
- `/[symbol]`, `/[symbol]/options`, `/[symbol]/fundamental`, `/[symbol]/fear-greed`, `/[symbol]/overall` → ISR(revalidate) 표기.
- `/[symbol]/news` → 여전히 동적(ƒ) (D2① 의도된 유지).
- OG/twitter 이미지 라우트 → 캐시/revalidate 표기.
- `missing-suspense-with-csr-bailout` 등 빌드 에러 없음.

- [ ] **Step 3: (권장) 로컬 동작 검증**

`verify` 스킬 또는 수동으로:
- `/{TICKER}` 및 `/{TICKER}?tf=1W` 접속 → 차트 정상, tf 딥링크가 1W로 표시되는지(클라 read).
- `/{TICKER}/overall` 접속 → 종합 분석 정상 렌더.
- 존재하지 않는 티커(`/{ZZINVALID}`) → 404. (FMP 정상 응답 시)

---

## Self-Review (작성자 체크)

**Spec coverage:**
- §4.1 봇 관리 → Task 1 ✓
- §4.2 OG 캐싱 → Task 4 ✓
- §4.3 페이지 ISR (options/fundamental/fear-greed) → Task 5 ✓; (chart) → Task 6 ✓; (overall) → Task 7 ✓; (news 유지) → Task 8 Step 2 검증 ✓
- §4.4 D3 404 안전 → Task 2(fmpTickerApi) + Task 3(getAssetInfo) ✓
- §5 영향 파일 → Task 매핑 일치, news 무변경 ✓

**Placeholder scan:** 모든 코드 스텝에 실제 코드 포함. "TBD"/"적절히 처리" 없음. ✓

**Type consistency:** `searchBySymbol(query, options?: { strict?: boolean })` 시그니처가 Task 2 정의 ↔ Task 3 호출(`{ strict: true }`) ↔ getAssetInfo.test mock에서 일치. `revalidate` 값(OG 2592000 / 페이지 3600) 일관. `DEFAULT_TIMEFRAME`/`isValidTimeframe`는 `@/shared/config/market`에서 일관 사용. ✓

**알려진 비결정/주의:**
- Task 6·7의 `<Suspense fallback={null}>`는 레이아웃 시프트가 보이면 `loading.tsx` 스켈레톤 추출로 교체(주석에 명시). 이는 UX 폴리시 항목이며 ISR 동작 자체와 무관.
- OverallContent 기존 테스트가 `timeframe` prop을 넘기면 Task 7 Step 4에서 갱신.

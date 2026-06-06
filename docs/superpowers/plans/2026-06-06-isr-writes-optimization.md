# ISR Writes 최적화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ISR 페이지가 재생성마다 동일 출력을 내도록 만들어 ISR Writes(4.88M=$25/사이클)와 Cloudflare 캐시 미스를 함께 줄인다.

**Architecture:** 3개의 독립적 fix — (1) 차트·fear-greed의 SSR seed bars를 "마지막 완료 일봉"으로 quantize, (2) news 무효화를 DB 실제 변경분으로 게이팅, (3) `/market` SSR seed의 `computedAt`을 시간 단위로 quantize. 클라이언트 라이브 동작과 SEO fact layer는 보존한다. siglens-core 분석 로직은 건드리지 않는다(SSR 직렬화·repository·캐시 무효화만).

**Tech Stack:** Next.js 16 App Router(ISR), React Query(dehydrate/hydration), Drizzle ORM + Postgres(Neon HTTP), Vitest, `@y0ngha/siglens-core`(Bar 타입·세션 판정).

---

## File Structure

| 파일 | 책임 | 변경 |
|---|---|---|
| `src/entities/bars/lib/quantizeBars.ts` | "마지막 완료 일봉" 산출 순수 함수 | **신규** |
| `src/entities/bars/__tests__/lib/quantizeBars.test.ts` | 위 단위 테스트 | **신규** |
| `src/app/[symbol]/page.tsx` | factBars + bars seed를 quantize | 수정 |
| `src/app/[symbol]/fear-greed/page.tsx` | bars seed를 quantize | 수정 |
| `src/entities/news-article/api.ts` | `upsertNewsItem` 반환을 changed boolean으로 | 수정 |
| `src/entities/news-article/__tests__/api.test.ts` | 게이팅 판정 테스트 | 수정 |
| `src/entities/news-article/actions/ensureNewsCardsAnalyzedAction.ts` | changedCount>0일 때만 revalidateTag | 수정 |
| `src/app/market/page.tsx` | sectorData seed의 computedAt quantize | 수정 |

`quantizeBars`는 `entities/bars/lib`에 둔다(bars 도메인 순수 함수, FSD entities). core 직접 import 허용.

---

## Testing Requirements (모든 task 공통)

- **커버리지 90% 이상** (변경·신규 코드의 line/branch 기준). 확인: `yarn test-coverage -- <대상 경로>`.
- **Happy path + Worst case 모두 작성.** 각 단위의 worst case는 최소 다음을 포함한다:
  - **빈/경계 입력**: 빈 배열, 길이 1, null/undefined, 0/음수 값.
  - **실패·예외 경로**: fetch/DB 실패, 부분 실패(`Promise.allSettled`의 일부 rejected), majority 실패.
  - **상태 경계**: 장중↔장마감 전환, 변경 0건↔1건, conflict 발생↔미발생.
- **단위로 검증 불가한 런타임 ISR 동작**(재생성마다 동일 출력 → write 미발생)은 Task 7의 `prod build`로 1차 확인하고, 배포 후 `x-nextjs-cache` HIT + ISR write 로그 미발생으로 실측한다.
- **E2E**: news 게이팅의 "방문해도 무효화되지 않음"은 Task 5 단위 테스트로 충분하다. ISR write 수치 자체는 단위 테스트로 잡을 수 없으므로, 별도 E2E는 추가하지 않고 배포 후 Vercel ISR Writes 지표로 검증한다(E2E 환경은 ISR 과금 경로를 재현하지 않음).

각 Task의 테스트 step에 명시된 케이스는 최소치다 — 위 정책을 만족하도록 worst case를 보강한다.

---

## Task Dependencies (병렬 실행 그래프)

```
Phase 1:  Task 0 (node_modules)                      ← 단독 선행(전제)
Phase 2:  Task 1 ‖ Task 4 ‖ Task 6                    ← 서로 다른 파일, 완전 독립 → 병렬
Phase 3:  Task 2 ‖ Task 3 ‖ Task 5                    ← (2·3은 Task 1 후, 5는 Task 4 후), 서로 다른 파일 → 병렬
Phase 4:  Task 7 (통합 검증)                          ← 전부 완료 후
```

- 병렬 task는 **서로 다른 파일만** 수정하므로 작업 자체는 충돌하지 않는다. 단 **단일 워크트리에서 커밋은 직렬화**한다(phase 내 task들을 구현 후 순서대로 커밋, 또는 각 task가 자기 파일만 `git add`). 한 phase가 끝나면 다음 phase로.
- 파일 소유: Task 1=`quantizeBars.ts`(신규), Task 4=`news-article/api.ts`, Task 6=`market/page.tsx`, Task 2=`[symbol]/page.tsx`, Task 3=`fear-greed/page.tsx`, Task 5=`ensureNewsCardsAnalyzedAction.ts`. 겹치는 파일 없음.

---

## Task 0: 워크트리 node_modules 셋업

워크트리 `/Users/y0ngha/Project/siglens-isrwrite`에 node_modules가 없다. symlink 금지(Turbopack 거부 + dual-React) — 하드링크로 복사한다.

- [ ] **Step 1: node_modules 하드링크 복사**

```bash
cp -al /Users/y0ngha/Project/siglens/node_modules /Users/y0ngha/Project/siglens-isrwrite/node_modules
rm -rf /Users/y0ngha/Project/siglens-isrwrite/node_modules/node_modules
```

- [ ] **Step 2: 테스트 러너 동작 확인**

Run (워크트리에서): `cd /Users/y0ngha/Project/siglens-isrwrite && npx vitest run src/entities/bars/__tests__/lib/barsStaticCache.test.ts`
Expected: PASS (기존 테스트가 통과 = 환경 정상)

---

## Task 1: quantizeBarsToLastClosed 순수 함수

**Files:**
- Create: `src/entities/bars/lib/quantizeBars.ts`
- Test: `src/entities/bars/__tests__/lib/quantizeBars.test.ts`

진행 중(forming) 당일 봉을 SSR seed에서 제거한다. 정규장 중에는 마지막 일봉이 forming이므로 제외 → SSR 출력이 장 마감 시 하루 1회만 변경된다. 장 마감 후·주말·휴일에는 마지막 봉이 이미 완료이므로 그대로 둔다.

- [ ] **Step 1: Write the failing test**

```typescript
// src/entities/bars/__tests__/lib/quantizeBars.test.ts
import { describe, expect, it, vi } from 'vitest';
import type { Bar } from '@y0ngha/siglens-core';

vi.mock('@y0ngha/siglens-core', async () => ({
    ...(await vi.importActual('@y0ngha/siglens-core')),
    isEtRegularSessionOpen: vi.fn(),
}));

import { isEtRegularSessionOpen } from '@y0ngha/siglens-core';
import { quantizeBarsToLastClosed } from '@/entities/bars/lib/quantizeBars';

const mockOpen = vi.mocked(isEtRegularSessionOpen);

function bar(close: number): Bar {
    return { time: close, open: close, high: close, low: close, close, volume: 1 };
}

describe('quantizeBarsToLastClosed', () => {
    const now = new Date('2026-06-05T18:00:00Z');

    it('drops the last (forming) bar during regular session', () => {
        mockOpen.mockReturnValue(true);
        const bars = [bar(1), bar(2), bar(3)];
        expect(quantizeBarsToLastClosed(bars, now)).toEqual([bar(1), bar(2)]);
    });

    it('keeps all bars when the session is closed (last bar already complete)', () => {
        mockOpen.mockReturnValue(false);
        const bars = [bar(1), bar(2), bar(3)];
        expect(quantizeBarsToLastClosed(bars, now)).toEqual([bar(1), bar(2), bar(3)]);
    });

    it('returns input unchanged for empty bars', () => {
        mockOpen.mockReturnValue(true);
        expect(quantizeBarsToLastClosed([], now)).toEqual([]);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/entities/bars/__tests__/lib/quantizeBars.test.ts`
Expected: FAIL — "Cannot find module '@/entities/bars/lib/quantizeBars'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/entities/bars/lib/quantizeBars.ts
import type { Bar } from '@y0ngha/siglens-core';
import { isEtRegularSessionOpen } from '@y0ngha/siglens-core';

/**
 * SSR 직렬화 전용: 진행 중(forming) 당일 봉을 제외해 "마지막 완료 일봉"까지만 남긴다.
 *
 * 차트·fear-greed 페이지는 일봉(DEFAULT_TIMEFRAME='1Day') bars를 TechnicalFactsSummary와
 * dehydrate seed로 SSR HTML에 박는다. bars Redis TTL이 장중 60초라, 가공 없이 박으면 ISR
 * 재생성마다 forming 봉의 가격이 달라 매번 ISR write가 발생한다(= $25/사이클의 주범).
 *
 * 정규장 중에는 마지막 일봉이 아직 확정되지 않았으므로(forming) 제외한다 → SSR 출력이
 * 장 마감 시 하루 1회만 변경된다. 장 마감 후·주말·휴일에는 마지막 봉이 이미 완료이므로 보존한다.
 * 클라이언트(useBars/getBarsAction)는 이 함수를 거치지 않으므로 사용자는 라이브 가격을 그대로 본다.
 */
export function quantizeBarsToLastClosed(
    bars: readonly Bar[],
    now: Date
): readonly Bar[] {
    if (bars.length === 0) return bars;
    return isEtRegularSessionOpen(now) ? bars.slice(0, -1) : bars;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/entities/bars/__tests__/lib/quantizeBars.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/entities/bars/lib/quantizeBars.ts src/entities/bars/__tests__/lib/quantizeBars.test.ts
git commit -m "feat(bars): add quantizeBarsToLastClosed for SSR seed stability"
```

---

## Task 2: 차트 page.tsx에 quantize 적용

**Files:**
- Modify: `src/app/[symbol]/page.tsx`

현재 `factBars`(getBarsStatic 결과)는 ① `TechnicalFactsSummary`(가시 SSR), ② `prefetchQuery`(dehydrate seed) 두 경로로 SSR HTML에 박힌다. 둘 다 quantize한 bars를 쓰게 한다. 클라 useBars(getBarsAction)는 그대로라 hydration 후 라이브로 덮어쓴다.

현재 코드 (`src/app/[symbol]/page.tsx:116-123`):
```typescript
const factBars = await getBarsStatic(
    ticker,
    DEFAULT_TIMEFRAME,
    assetInfo.fmpSymbol
).catch((e: unknown) => {
    console.error('[SymbolPage] getBarsStatic failed:', e);
    return null;
});
```

현재 prefetch (`:220-227`):
```typescript
queryClient.prefetchQuery({
    queryKey: QUERY_KEYS.bars(
        symbol,
        DEFAULT_TIMEFRAME,
        assetInfo.fmpSymbol
    ),
    queryFn: barsQueryFn,
}),
```

- [ ] **Step 1: import 추가**

`src/app/[symbol]/page.tsx` 상단 import 블록에 추가:
```typescript
import { quantizeBarsToLastClosed } from '@/entities/bars/lib/quantizeBars';
```

- [ ] **Step 2: factBars를 quantize한 값으로 파생**

`:116-123`의 `factBars` 블록 바로 다음에 추가:
```typescript
// SSR seed는 forming 당일 봉을 제외해 ISR write churn을 막는다(클라는 라이브 유지).
const ssrNow = new Date();
const quantizedFactBars =
    factBars === null
        ? null
        : {
              ...factBars,
              bars: quantizeBarsToLastClosed(factBars.bars, ssrNow),
          };
```

- [ ] **Step 3: TechnicalFactsSummary에 quantized bars 전달**

`:302-307`을 수정:
```typescript
{quantizedFactBars && quantizedFactBars.bars.length > 0 ? (
    <TechnicalFactsSummary
        symbol={ticker}
        bars={quantizedFactBars.bars}
        indicators={quantizedFactBars.indicators}
    />
) : (
```

- [ ] **Step 4: dehydrate seed를 quantized 값으로 교체**

`:220-227`의 `prefetchQuery` 블록을 `setQueryData`로 교체한다(quantized seed를 직접 주입; prefetch는 다시 getBarsStatic을 호출해 라이브 봉을 캐시에 넣으므로 부적합):
```typescript
quantizedFactBars
    ? queryClient.setQueryData(
          QUERY_KEYS.bars(symbol, DEFAULT_TIMEFRAME, assetInfo.fmpSymbol),
          quantizedFactBars
      )
    : undefined,
```
주: 이 항목이 `Promise.all([...])` 배열 안의 prefetch였다면, 동기 `setQueryData`는 await 대상이 아니므로 배열에서 빼고 위 `factBars` 파생 직후에 호출한다. 기존 `barsQueryFn` 정의가 이 prefetch에만 쓰였다면 함께 제거한다.

- [ ] **Step 5: 빌드/타입 확인**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep "app/\[symbol\]/page" || echo "no type errors in page.tsx"`
Expected: "no type errors in page.tsx"

- [ ] **Step 6: Commit**

```bash
git add "src/app/[symbol]/page.tsx"
git commit -m "perf(isr): quantize chart SSR seed bars to last closed daily bar"
```

---

## Task 3: fear-greed page.tsx에 quantize 적용

**Files:**
- Modify: `src/app/[symbol]/fear-greed/page.tsx`

현재 (`:178-186`)는 `prefetchQuery`로 라이브 bars를 dehydrate seed에 넣는다. quantize한 seed로 교체한다.

```typescript
await queryClient.prefetchQuery({
    queryKey: QUERY_KEYS.bars(
        symbol,
        DEFAULT_TIMEFRAME,
        assetInfo.fmpSymbol
    ),
    queryFn: () =>
        getBarsStatic(symbol, DEFAULT_TIMEFRAME, assetInfo.fmpSymbol),
});
```

- [ ] **Step 1: import 추가**

```typescript
import { quantizeBarsToLastClosed } from '@/entities/bars/lib/quantizeBars';
```

- [ ] **Step 2: prefetchQuery를 quantized setQueryData로 교체**

`:178-186` 블록을 교체:
```typescript
const fgBars = await getBarsStatic(
    symbol,
    DEFAULT_TIMEFRAME,
    assetInfo.fmpSymbol
).catch(() => null);
if (fgBars !== null) {
    queryClient.setQueryData(
        QUERY_KEYS.bars(symbol, DEFAULT_TIMEFRAME, assetInfo.fmpSymbol),
        {
            ...fgBars,
            bars: quantizeBarsToLastClosed(fgBars.bars, new Date()),
        }
    );
}
```

- [ ] **Step 3: 타입 확인**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep "fear-greed/page" || echo "no type errors"`
Expected: "no type errors"

- [ ] **Step 4: Commit**

```bash
git add "src/app/[symbol]/fear-greed/page.tsx"
git commit -m "perf(isr): quantize fear-greed SSR seed bars to last closed daily bar"
```

---

## Task 4: upsertNewsItem 변경분 반환

**Files:**
- Modify: `src/entities/news-article/api.ts`
- Test: `src/entities/news-article/__tests__/api.test.ts`

`upsertNewsItem`이 행이 실제로 신규 삽입되거나 내용이 바뀐 경우에만 `true`를 반환하게 한다. `INSERT … ON CONFLICT DO UPDATE … RETURNING`에 `setWhere`(값이 실제로 다를 때만 update)를 붙이고, returning 행 수로 변경 여부를 판정한다. 같은 기사 재fetch(값 동일)는 update가 발동하지 않아 returning이 비어 `false`.

- [ ] **Step 1: 기존 테스트를 새 시그니처로 갱신 + 케이스 추가**

`src/entities/news-article/__tests__/api.test.ts`의 upsert mock과 단언을 수정한다. `onConflictDoUpdate`는 이제 `.returning()`을 체이닝하므로 mock을 확장한다:
```typescript
// makeUpsertDb를 returning까지 체이닝하도록 확장
function makeUpsertDb(returningRows: unknown[]): {
    db: SiglensDatabase;
    returning: Mock;
} {
    const returning = vi.fn().mockResolvedValue(returningRows);
    const onConflictDoUpdate = vi.fn(() => ({ returning }));
    const values = vi.fn(() => ({ onConflictDoUpdate }));
    const insert = vi.fn(() => ({ values }));
    return { db: { insert } as unknown as SiglensDatabase, returning };
}
```
새 단언 케이스:
```typescript
it('returns true when a row is inserted or updated (returning non-empty)', async () => {
    const { db } = makeUpsertDb([{ id: 'abc123' }]);
    const repo = new DrizzleNewsRepository(db);
    await expect(repo.upsertNewsItem(baseItem)).resolves.toBe(true);
});

it('returns false when nothing changed (returning empty)', async () => {
    const { db } = makeUpsertDb([]);
    const repo = new DrizzleNewsRepository(db);
    await expect(repo.upsertNewsItem(baseItem)).resolves.toBe(false);
});
```
(파일 상단의 기존 `makeUpsertDb` 정의를 위 버전으로 교체하고, 이를 호출하던 기존 테스트가 있으면 인자 `[{ id: ... }]`를 넘기도록 맞춘다.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/entities/news-article/__tests__/api.test.ts`
Expected: FAIL — `upsertNewsItem`이 `undefined`(void) 반환이라 `toBe(true/false)` 불일치

- [ ] **Step 3: upsertNewsItem 구현 수정**

`src/entities/news-article/api.ts:28-67`의 `upsertNewsItem`을 교체:
```typescript
async upsertNewsItem(item: NewsItem): Promise<boolean> {
    // Wrapped in withRetry: the Neon HTTP driver intermittently throws
    // `fetch failed` on connection recycling; retrying transparently
    // keeps single-item dropouts from leaving news cards permanently
    // un-upserted in the 250-item batch.
    const changed = await withRetry(
        () =>
            this.db
                .insert(news)
                .values({
                    id: item.id,
                    symbol: item.symbol,
                    source: item.source,
                    url: item.url,
                    publishedAt: new Date(item.publishedAt),
                    titleEn: item.titleEn,
                    bodyEn: item.bodyEn ?? null,
                })
                /**
                 * bodyKo intentionally NOT in the conflict update — write-once via
                 * attachAnalysis() (LLM translation). Same for titleKo/summaryKo/
                 * sentiment/category/priceImpact/analyzedAt: analysis-step columns.
                 *
                 * setWhere: only UPDATE when an incoming column actually differs, so a
                 * re-fetch of an unchanged article produces an empty RETURNING and we
                 * skip the news ISR cache invalidation (avoids the revalidateTag storm).
                 */
                .onConflictDoUpdate({
                    target: news.id,
                    set: {
                        symbol: sql`excluded.symbol`,
                        source: sql`excluded.source`,
                        publishedAt: sql`excluded.published_at`,
                        titleEn: sql`excluded.title_en`,
                        bodyEn: sql`excluded.body_en`,
                    },
                    setWhere: sql`
                        ${news.symbol} IS DISTINCT FROM excluded.symbol OR
                        ${news.source} IS DISTINCT FROM excluded.source OR
                        ${news.publishedAt} IS DISTINCT FROM excluded.published_at OR
                        ${news.titleEn} IS DISTINCT FROM excluded.title_en OR
                        ${news.bodyEn} IS DISTINCT FROM excluded.body_en
                    `,
                })
                .returning({ id: news.id }),
        NEON_TRANSIENT_RETRY
    );
    return changed.length > 0;
}
```
주: `INSERT … ON CONFLICT DO UPDATE`는 신규 insert면 항상 RETURNING 1행, conflict면 `setWhere`가 참일 때만 1행을 돌려준다(값 동일 시 0행). `sql` 헬퍼는 기존 import(`import { sql } from 'drizzle-orm'`)를 사용한다 — 파일에 이미 import돼 있는지 확인하고 없으면 추가한다.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/entities/news-article/__tests__/api.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/entities/news-article/api.ts src/entities/news-article/__tests__/api.test.ts
git commit -m "feat(news): upsertNewsItem returns whether the row actually changed"
```

---

## Task 5: ensureNewsCardsAnalyzedAction 게이팅

**Files:**
- Modify: `src/entities/news-article/actions/ensureNewsCardsAnalyzedAction.ts`

`upsertSettled`에서 실제 변경된 건수를 집계해, `changedCount > 0`일 때만 `revalidateTag`를 호출한다.

현재 (`:114-140`)는 `Promise.allSettled(fresh.map(repo.upsertNewsItem))` 후 `fresh.length === 0`이 아니면 무조건 `revalidateTag`. 이제 fulfilled 결과의 `value === true` 개수로 게이트한다.

- [ ] **Step 1: 변경 건수 집계 + 게이팅으로 교체**

`:114`의 `upsertSettled` 정의는 그대로 두고, `:134-140` 구간을 교체:
```typescript
    await markFetched(symbol);

    // 실제로 신규 삽입/내용 변경된 기사가 1건 이상일 때만 news ISR 캐시를 무효화한다.
    // upsertNewsItem은 값이 바뀐 행만 RETURNING하므로(setWhere), 같은 기사 재fetch는
    // changedCount=0 → revalidateTag 스킵. 방문마다 무효화하던 빈도 폭풍을 차단한다.
    const changedCount = upsertSettled.filter(
        r => r.status === 'fulfilled' && r.value === true
    ).length;
    if (changedCount === 0) return;

    // → 다음 요청부터 news 리스트/JSON-LD가 fresh. bars/peek/profile 캐시는 보존.
    // "max" profile: 캐시 항목을 즉시 만료시켜 다음 요청에서 재생성하게 한다.
    revalidateTag(`news:${symbol.toUpperCase()}`, 'max');
```
주: 기존 `if (fresh.length === 0) return;`은 위 `changedCount === 0` 가드가 포섭하므로 제거한다(빈 fresh면 changedCount도 0). 단 `markFetched(symbol)`는 fresh 유무와 무관하게 호출되어야 하므로 가드보다 위에 유지한다.

- [ ] **Step 2: 기존 테스트 확인/보강**

해당 액션의 테스트 파일이 있으면(`src/entities/news-article/__tests__/ensureNewsCardsAnalyzedAction.test.ts` 등) `revalidateTag` mock으로 다음을 검증한다(없으면 신규 생성):
```typescript
it('does NOT revalidate when no upsert changed anything', async () => {
    // repo.upsertNewsItem이 모두 false를 반환하도록 mock
    // → expect(revalidateTagMock).not.toHaveBeenCalled()
});
it('revalidates when at least one upsert changed', async () => {
    // 하나라도 true → expect(revalidateTagMock).toHaveBeenCalledWith('news:AAPL', 'max')
});
```
기존 mock 패턴(`vi.mock('next/cache', ...)`)을 따른다.

- [ ] **Step 3: 테스트 실행**

Run: `npx vitest run src/entities/news-article`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/entities/news-article/actions/ensureNewsCardsAnalyzedAction.ts src/entities/news-article/__tests__/
git commit -m "perf(news): gate revalidateTag on actual upsert changes"
```

---

## Task 6: market computedAt quantize

**Files:**
- Modify: `src/app/market/page.tsx`

`sectorData`(SectorSignalsResult, `computedAt: string` required)가 `setQueryData`와 `SectorSignalPanel initialData`로 SSR HTML에 직렬화된다. Redis TTL 5~15분이라 `computedAt`이 자주 바뀌어 ISR write를 유발한다. SSR seed에 한해 `computedAt`을 시간 단위(`dateHour`, 이미 존재하는 변수)로 quantize한다. 클라 refetch가 실제 값을 공급하므로 사용자 화면은 불변.

현재 (`:119-133`)에서 `dateHour` 변수가 이미 정의돼 있다(briefing cache key용). 이를 재사용한다.

- [ ] **Step 1: quantized seed 파생**

`getSectorSignalsStatic` 호출 직후, `setQueryData` 전에 추가:
```typescript
// SSR seed의 computedAt만 시간 단위로 quantize한다 — 5~15분 churn이 ISR write를
// 유발하므로. 클라 refetch가 실제 computedAt을 공급해 화면 표시는 불변.
const sectorDataSeed = { ...sectorData, computedAt: dateHour };
```

- [ ] **Step 2: seed 사용처를 quantized 값으로 교체**

`:131`의 `setQueryData`:
```typescript
queryClient.setQueryData(
    QUERY_KEYS.sectorSignals(DEFAULT_DASHBOARD_TIMEFRAME),
    sectorDataSeed
);
```
`:159`의 `SectorSignalPanel initialData`:
```typescript
<SectorSignalPanel
    initialSector={SIGNAL_SECTORS[0].symbol}
    initialTimeframe={DEFAULT_DASHBOARD_TIMEFRAME}
    initialData={sectorDataSeed}
/>
```
주: `SectorFactsSummary data={sectorData}`(:151)는 `buildSectorFacts`가 `computedAt`을 쓰지 않으므로 그대로 둬도 되지만, 일관성을 위해 `sectorDataSeed`로 통일한다.

- [ ] **Step 3: 타입/테스트 확인**

Run: `npx vitest run src/app/market/__tests__/page.test.ts && npx tsc --noEmit -p tsconfig.json 2>&1 | grep "market/page" || echo "ok"`
Expected: 기존 market 테스트 PASS + "ok"

- [ ] **Step 4: Commit**

```bash
git add "src/app/market/page.tsx"
git commit -m "perf(isr): quantize /market computedAt in SSR seed to cut write churn"
```

---

## Task 7: 통합 검증

- [ ] **Step 1: 전체 변경 파일 테스트**

Run: `npx vitest run src/entities/bars src/entities/news-article src/app/market src/app/\[symbol\]`
Expected: 전부 PASS

- [ ] **Step 2: lint + format**

Run: `yarn lint && npx prettier --check "src/**/*.{ts,tsx}"`
Expected: 통과

- [ ] **Step 3: prod build (ISR 정적화 깨지지 않음 확인)**

Run: `yarn build 2>&1 | tee /tmp/isr-build.log; echo "EXIT=${PIPESTATUS[0]}"`
Expected: EXIT=0, `[symbol]`·`/market`이 여전히 `●ISR`(SSG)로 표시
(배포 후 실측: 동일 거래일 내 차트/`/market` 재요청이 `x-nextjs-cache` HIT 유지 + ISR write 로그 미발생. 최종 확인은 다음 빌링 사이클 ISR Writes 수치.)

---

## 검증 체크리스트 (spec 대응)

- spec §3.1 가격 quantize → Task 1·2·3
- spec §3.2 news 게이팅 → Task 4·5
- spec §3.3 computedAt strip → Task 6
- spec §5 테스트 전략 → 각 Task의 단위 테스트 + Task 7

# Market Events Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** technical 분석 프롬프트에 `## Market Events` 섹션을 추가해, 모델이 보고 있는 봉 구간에 발생한 고영향 뉴스 이벤트(본문 없이 category/sentiment/impact만)를 알려 준다.

**Architecture:** 이력 주입(`priorAnalyses`)과 동일한 구조. core는 저장소를 모르고 소비자가 이벤트를 넘긴다. core가 봉 범위로 좁혀 fingerprint를 캐시 키에 접고 섹션을 렌더한다. 윈도우는 새로 정의하지 않고 `PROMPT_CONFIG_BY_TIMEFRAME.recentBarsCount`(모델이 실제로 보는 봉 수)를 그대로 쓴다.

**Tech Stack:** TypeScript, siglens-core(도메인 순수 함수), siglens(Next.js/FSD, Drizzle/Neon), vitest

**스펙:** `docs/superpowers/specs/2026-09-06-market-events-context-design.md`

---

## 파일 구조

### siglens-core

| 파일 | 책임 |
|---|---|
| `src/domain/types.ts` (수정) | `MarketEvent` 타입 추가. 기존 `NewsSentiment`/`NewsCategory`/`NewsImpact` 재사용 |
| `src/domain/analysis/marketEvents.ts` (신규) | `MARKET_EVENT_LIMIT`, `selectMarketEvents` — 봉 범위 절단 + 상한 |
| `src/domain/analysis/marketEventsSection.ts` (신규) | `formatMarketEventsSection` — 렌더 |
| `src/infrastructure/cache/config.ts` (수정) | `narrowMarketEventsForCacheKey`, `eventsKeySuffix`, `buildAnalysisCacheKey` 인자, `PROMPT_TEMPLATE_VERSION` bump |
| `src/domain/analysis/prompt.ts` (수정) | `buildAnalysisPrompt`에 `marketEvents` 파라미터, `dynamicSections` 편입 |
| `src/application/market/types.ts` (수정) | `SubmitAnalysisOptions.marketEvents` |
| `src/application/market/runAnalysis.ts` (수정) | 좁히기 → 캐시 키 → 프롬프트 배선 |
| `src/index.ts` (수정) | `MarketEvent` 타입 export |

`marketEvents.ts`와 `marketEventsSection.ts`를 나누는 이유는 `priorAnalysis.ts` /
`priorAnalysisSection.ts`가 이미 그 경계를 쓰기 때문이다 — 선택 로직(봉 인덱싱)과 렌더
로직(문자열)은 서로 다른 이유로 바뀐다.

### siglens

| 파일 | 책임 |
|---|---|
| `src/entities/news-article/marketEventsRepository.ts` (신규) | `findMarketEventsForPrompt` — server-only, barrel 제외 |
| `src/app/api/analysis/stream/route.ts` (수정) | technical 경로 배선 |
| `src/entities/analysis/api.ts` (수정) | prewarm technical 경로 배선 |

---

## Phase 1 — siglens-core

작업 위치: 새 워크트리 `~/Project/siglens-core-events`, 브랜치 `feat/market-events-context`.
`~/Project/siglens-core`에서 `git worktree add`로 만들고 `node_modules`를 `cp -al`로
하드링크한다(대상 디렉토리가 없어야 중첩되지 않는다 — `cp -al src/. dest` 형태 사용).

### Task 1: `MarketEvent` 타입

**Files:**
- Modify: `src/domain/types.ts` (`NewsImpact` 정의 근처, 2904행 부근)
- Modify: `src/index.ts` (타입 재노출)

- [ ] **Step 1: 타입 추가**

`src/domain/types.ts`에서 `NewsImpact` 선언 바로 아래에 추가한다.

```typescript
/**
 * One market-moving news event, projected for prompt injection.
 *
 * Deliberately a FLAT, language-neutral projection rather than a full
 * {@link NewsItem}: core must not know the consumer's storage shape, and the
 * rendered section goes into prompts of every output locale, so no prose field
 * may appear here. The model is told *that* an event happened and how it was
 * classified — never the headline text. Reading the article is the news and
 * overall axes' job; this axis only needs the fact to explain a bar move.
 */
export interface MarketEvent {
    /** When the article was published. */
    readonly publishedAt: Date;
    /** Event classification (earnings, regulation, …). */
    readonly category: NewsCategory;
    /** Directional read the news analysis assigned. */
    readonly sentiment: NewsSentiment;
    /** Expected price impact the news analysis assigned. */
    readonly impact: NewsImpact;
}
```

- [ ] **Step 2: export 추가**

`src/index.ts`의 `export type { ... } from './domain/types';` 목록에 `MarketEvent`를
알파벳 순서에 맞게 넣는다(`MarketBriefingResponse` 다음, `MarketIndexData` 앞).

- [ ] **Step 3: 타입체크**

Run: `yarn typecheck`
Expected: exit 0

- [ ] **Step 4: 커밋**

```bash
git add src/domain/types.ts src/index.ts
git commit -m "feat: MarketEvent 타입 추가"
```

---

### Task 2: `selectMarketEvents` — 봉 범위 절단 + 상한

**Files:**
- Create: `src/domain/analysis/marketEvents.ts`
- Test: `src/__tests__/domain/analysis/marketEvents.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/__tests__/domain/analysis/marketEvents.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
    MARKET_EVENT_LIMIT,
    selectMarketEvents,
} from '@/domain/analysis/marketEvents';
import type { Bar, MarketEvent } from '@/domain/types';

const START = 1_700_000_000;
const IV = 900; // 15분

/** 봉은 오래된 것부터. */
function makeBars(count: number): Bar[] {
    return Array.from({ length: count }, (_, i) => ({
        time: START + i * IV,
        open: 100,
        high: 101,
        low: 99,
        close: 100,
        volume: 1000,
    }));
}

function event(barIndex: number, overrides: Partial<MarketEvent> = {}): MarketEvent {
    return {
        publishedAt: new Date((START + barIndex * IV) * 1000),
        category: 'earnings',
        sentiment: 'bullish',
        impact: 'high',
        ...overrides,
    };
}

describe('selectMarketEvents', () => {
    it('봉 범위 밖 이벤트는 버린다', () => {
        const bars = makeBars(10); // START ~ START+9*IV
        const tooOld = event(-5);
        const tooNew: MarketEvent = {
            ...event(0),
            publishedAt: new Date((START + 20 * IV) * 1000),
        };
        const inside = event(4);

        const selected = selectMarketEvents([tooOld, tooNew, inside], bars);

        expect(selected).toHaveLength(1);
        expect(selected[0].publishedAt).toEqual(inside.publishedAt);
    });

    it('negligible / low 영향도는 버린다', () => {
        const bars = makeBars(10);
        const kept = [event(2, { impact: 'high' }), event(4, { impact: 'medium' })];
        const dropped = [event(6, { impact: 'low' }), event(8, { impact: 'negligible' })];

        const selected = selectMarketEvents([...kept, ...dropped], bars);

        expect(selected.map(e => e.impact).toSorted()).toEqual(['high', 'medium']);
    });

    it('상한 초과 시 impact 우선, 그다음 최신순으로 자른다', () => {
        const bars = makeBars(30);
        // medium 을 먼저(오래된 쪽), high 를 나중(최신 쪽)에 둔다.
        const events = [
            ...Array.from({ length: 5 }, (_, i) => event(i, { impact: 'medium' })),
            ...Array.from({ length: 5 }, (_, i) => event(10 + i, { impact: 'high' })),
        ];

        const selected = selectMarketEvents(events, bars);

        expect(selected).toHaveLength(MARKET_EVENT_LIMIT);
        // high 가 전부 살아남아야 한다 — impact 가 1순위이므로.
        expect(selected.every(e => e.impact === 'high')).toBe(true);
    });

    it('봉이 비었으면 빈 배열', () => {
        expect(selectMarketEvents([event(0)], [])).toEqual([]);
    });

    it('반환 순서는 최신순', () => {
        const bars = makeBars(10);
        const selected = selectMarketEvents([event(2), event(6), event(4)], bars);

        const times = selected.map(e => e.publishedAt.getTime());
        expect(times).toEqual([...times].toSorted((a, b) => b - a));
    });
});
```

- [ ] **Step 2: 실패 확인**

Run: `yarn vitest run src/__tests__/domain/analysis/marketEvents.test.ts`
Expected: FAIL — `Cannot find module '@/domain/analysis/marketEvents'`

- [ ] **Step 3: 구현**

`src/domain/analysis/marketEvents.ts`:

```typescript
import type { Bar, MarketEvent, NewsImpact } from '@/domain/types';

/**
 * @internal
 * Maximum events rendered into one prompt.
 *
 * Earnings season clusters events on a single day; without a cap the section
 * could outgrow the bar data it is meant to annotate. Five is enough to cover
 * a busy session while staying a rounding error against a 12k–25k token prompt.
 */
export const MARKET_EVENT_LIMIT = 5;

/**
 * @internal
 * Impact levels worth telling the model about, ranked most significant first.
 *
 * `low` and `negligible` are dropped: on production data they are 13.5% and
 * 60.8% of all articles, so keeping them would bury the handful of events that
 * actually moved price. Articles with no impact rating (not yet analysed) are
 * dropped too — presenting an unrated article as an event would invent a fact.
 */
const RANKED_IMPACTS: readonly NewsImpact[] = ['high', 'medium'];

function impactRank(impact: NewsImpact): number {
    const index = RANKED_IMPACTS.indexOf(impact);
    return index === -1 ? Number.POSITIVE_INFINITY : index;
}

/**
 * @internal
 * Narrows events to the ones worth rendering for this bar window.
 *
 * The window is the bars themselves — first bar's time through last bar's time
 * — rather than a wall-clock duration. That is deliberate: the section
 * annotates the bars the model is already looking at, so the two must share one
 * axis, and bar-anchored bounds skip overnight and weekend gaps for free.
 *
 * Sorting is impact-first, then newest-first. When the cap bites, a `high`
 * event outranks a fresher `medium` one — the point of the section is what
 * moved price, not what happened most recently.
 *
 * @param events - Candidate events, any order.
 * @param bars - OHLCV history for this symbol + timeframe, oldest-first.
 * @returns Selected events, newest-first, at most {@link MARKET_EVENT_LIMIT}.
 */
export function selectMarketEvents(
    events: readonly MarketEvent[],
    bars: readonly Bar[]
): MarketEvent[] {
    if (bars.length === 0) return [];

    const MS_PER_SECOND = 1000;
    const fromMs = bars[0].time * MS_PER_SECOND;
    const toMs = bars[bars.length - 1].time * MS_PER_SECOND;

    return events
        .filter(entry => {
            if (!RANKED_IMPACTS.includes(entry.impact)) return false;
            const at = entry.publishedAt.getTime();
            return at >= fromMs && at <= toMs;
        })
        .toSorted((a, b) => {
            const byImpact = impactRank(a.impact) - impactRank(b.impact);
            if (byImpact !== 0) return byImpact;
            return b.publishedAt.getTime() - a.publishedAt.getTime();
        })
        .slice(0, MARKET_EVENT_LIMIT)
        .toSorted((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
}
```

- [ ] **Step 4: 통과 확인**

Run: `yarn vitest run src/__tests__/domain/analysis/marketEvents.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: 되돌림 검증**

impact 필터를 지워 본다: `if (!RANKED_IMPACTS.includes(entry.impact)) return false;` 줄을 삭제.

Run: `yarn vitest run src/__tests__/domain/analysis/marketEvents.test.ts`
Expected: "negligible / low 영향도는 버린다" 만 FAIL

원복한 뒤 다음 단계로.

- [ ] **Step 6: 커밋**

```bash
git add src/domain/analysis/marketEvents.ts src/__tests__/domain/analysis/marketEvents.test.ts
git commit -m "feat: selectMarketEvents 추가 (봉 범위 절단 + 영향도 필터)"
```

---

### Task 3: `formatMarketEventsSection` — 렌더

**Files:**
- Create: `src/domain/analysis/marketEventsSection.ts`
- Test: `src/__tests__/domain/analysis/marketEventsSection.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/__tests__/domain/analysis/marketEventsSection.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { formatMarketEventsSection } from '@/domain/analysis/marketEventsSection';
import { formatBarDateTime } from '@/domain/analysis/promptFormat';
import type { Bar, MarketEvent } from '@/domain/types';

const START = 1_700_000_000;
const IV = 900;

function makeBars(count: number): Bar[] {
    return Array.from({ length: count }, (_, i) => ({
        time: START + i * IV,
        open: 100,
        high: 101,
        low: 99,
        close: 100,
        volume: 1000,
    }));
}

function event(barIndex: number, overrides: Partial<MarketEvent> = {}): MarketEvent {
    return {
        publishedAt: new Date((START + barIndex * IV) * 1000),
        category: 'earnings',
        sentiment: 'bullish',
        impact: 'high',
        ...overrides,
    };
}

describe('formatMarketEventsSection', () => {
    it('선택된 이벤트가 없으면 "" 를 돌려준다', () => {
        expect(formatMarketEventsSection([], makeBars(10), 'NVDA', '15Min')).toBe('');
    });

    it('봉이 없으면 "" 를 돌려준다', () => {
        expect(formatMarketEventsSection([event(2)], [], 'NVDA', '15Min')).toBe('');
    });

    it('헤더에 심볼과 타임프레임 라벨이 들어간다', () => {
        const section = formatMarketEventsSection([event(4)], makeBars(10), 'NVDA', '15Min');
        expect(section).toContain('## Market Events (NVDA · 15-Minute');
    });

    it('봉 상대 위치와 분류를 렌더한다', () => {
        const bars = makeBars(10); // 마지막 인덱스 9
        const section = formatMarketEventsSection(
            [event(5, { category: 'regulation', sentiment: 'bearish', impact: 'medium' })],
            bars,
            'NVDA',
            '15Min'
        );
        // 9 - 5 = 4 bars ago
        expect(section).toContain('- 4 bars ago');
        expect(section).toContain('regulation, bearish, medium impact');
    });

    it('시각은 `formatBarDateTime` 과 같은 문자열이라 봉 행과 매칭된다', () => {
        const bars = makeBars(10);
        // 봉 사이 시각에 발행돼도 그 봉의 시각으로 앵커된다.
        const between = new Date((START + 6 * IV + 300) * 1000);
        const section = formatMarketEventsSection(
            [{ ...event(0), publishedAt: between }],
            bars,
            'NVDA',
            '15Min'
        );
        const expected = formatBarDateTime((START + 6 * IV) * 1000);
        expect(section).toContain(`(${expected})`);
    });

    it('기사 문구가 새어 나가지 않는다 — 분류 어휘만 쓴다', () => {
        const section = formatMarketEventsSection([event(3)], makeBars(10), 'NVDA', '15Min');
        // 헤더 + 항목 한 줄뿐이어야 한다.
        expect(section.split('\n').filter(l => l.startsWith('- '))).toHaveLength(1);
    });
});
```

- [ ] **Step 2: 실패 확인**

Run: `yarn vitest run src/__tests__/domain/analysis/marketEventsSection.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

`src/domain/analysis/marketEventsSection.ts`:

```typescript
import { findAnchorBarIndex } from '@/domain/analysis/priorAnalysis';
import {
    formatBarDateTime,
    TIMEFRAME_LABEL,
} from '@/domain/analysis/promptFormat';
import type { Bar, MarketEvent, Timeframe } from '@/domain/types';

/**
 * @internal
 * One rendered event line, anchored to the bar it landed on.
 *
 * Returns `null` when the event predates every bar — `findAnchorBarIndex`
 * cannot place it, and a line without a bar position would be unreadable next
 * to `## Recent Bar Data`.
 */
function formatEvent(entry: MarketEvent, bars: readonly Bar[]): string | null {
    const anchorIndex = findAnchorBarIndex(bars, entry.publishedAt.getTime());
    if (anchorIndex === null) return null;

    const barsAgo = bars.length - 1 - anchorIndex;
    const MS_PER_SECOND = 1000;
    // Same helper `formatBarRow` and `## Prior Analyses` use, so this stamp
    // appears verbatim in the bar rows above.
    const at = formatBarDateTime(bars[anchorIndex].time * MS_PER_SECOND);

    return `- ${barsAgo} bars ago (${at}): ${entry.category}, ${entry.sentiment}, ${entry.impact} impact`;
}

/**
 * @internal
 *
 * Renders selected market events into a `## Market Events` prompt section.
 *
 * Only the classification is rendered — never the headline or body. The model
 * needs to know *that* a high-impact earnings event landed on a given bar to
 * explain a gap; reading the article is the news and overall axes' job, and
 * pulling prose in here would duplicate them.
 *
 * Returns `''` when nothing renders, following the same "empty section is
 * skipped by the caller" contract `buildAnalysisPrompt` uses for
 * `positionHint` and `## Prior Analyses`.
 *
 * @param selected - Events to render, as returned by `selectMarketEvents`.
 * @param bars - OHLCV history for the same symbol + timeframe, oldest-first.
 * @param symbol - Ticker symbol, for the section header.
 * @param timeframe - Chart timeframe, for the section header label.
 */
export function formatMarketEventsSection(
    selected: readonly MarketEvent[],
    bars: readonly Bar[],
    symbol: string,
    timeframe: Timeframe
): string {
    if (selected.length === 0 || bars.length === 0) return '';

    const lines = selected
        .map(entry => formatEvent(entry, bars))
        .filter((line): line is string => line !== null);
    if (lines.length === 0) return '';

    const header = `## Market Events (${symbol} · ${TIMEFRAME_LABEL[timeframe]} · what landed on the bars above)`;
    return [header, ...lines].join('\n');
}
```

- [ ] **Step 4: 통과 확인**

Run: `yarn vitest run src/__tests__/domain/analysis/marketEventsSection.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: 되돌림 검증**

`formatBarDateTime(...)` 를 `new Date(...).toISOString().slice(0, 10)` 로 바꿔 본다.

Run: `yarn vitest run src/__tests__/domain/analysis/marketEventsSection.test.ts`
Expected: "시각은 `formatBarDateTime` 과 같은 문자열이라 봉 행과 매칭된다" FAIL

원복한다.

- [ ] **Step 6: 커밋**

```bash
git add src/domain/analysis/marketEventsSection.ts src/__tests__/domain/analysis/marketEventsSection.test.ts
git commit -m "feat: formatMarketEventsSection 추가"
```

---

### Task 4: 캐시 키 배선

**Files:**
- Modify: `src/infrastructure/cache/config.ts`
- Test: `src/__tests__/infrastructure/cache/config.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/__tests__/infrastructure/cache/config.test.ts` 끝에 추가한다.

```typescript
describe('marketEvents가 캐시 키에 반영될 때', () => {
    const START = 1_700_000_000;
    const IV = 900;
    const bars = Array.from({ length: 10 }, (_, i) => ({
        time: START + i * IV,
        open: 100,
        high: 101,
        low: 99,
        close: 100,
        volume: 1000,
    }));
    const event = (barIndex: number) => ({
        publishedAt: new Date((START + barIndex * IV) * 1000),
        category: 'earnings' as const,
        sentiment: 'bullish' as const,
        impact: 'high' as const,
    });

    it('이벤트가 없으면 fingerprint는 undefined이고 키는 이 기능 도입 전과 같다', () => {
        const { candidates, fingerprint } = narrowMarketEventsForCacheKey([], bars);

        expect(candidates).toEqual([]);
        expect(fingerprint).toBeUndefined();
        expect(
            buildAnalysisCacheKey('NVDA', '15Min', undefined, undefined, undefined, undefined, undefined, undefined, fingerprint)
        ).toBe(buildAnalysisCacheKey('NVDA', '15Min'));
    });

    it('이벤트가 있으면 `:evt=` 세그먼트가 붙는다', () => {
        const { fingerprint } = narrowMarketEventsForCacheKey([event(3)], bars);

        expect(fingerprint).toBeDefined();
        expect(
            buildAnalysisCacheKey('NVDA', '15Min', undefined, undefined, undefined, undefined, undefined, undefined, fingerprint)
        ).toContain(`:evt=${fingerprint}`);
    });

    it('같은 이벤트 집합은 순서가 달라도 같은 fingerprint를 낸다', () => {
        const a = narrowMarketEventsForCacheKey([event(3), event(6)], bars).fingerprint;
        const b = narrowMarketEventsForCacheKey([event(6), event(3)], bars).fingerprint;

        expect(a).toBe(b);
    });

    it('이벤트 집합이 다르면 fingerprint가 갈린다', () => {
        const a = narrowMarketEventsForCacheKey([event(3)], bars).fingerprint;
        const b = narrowMarketEventsForCacheKey([event(4)], bars).fingerprint;

        expect(a).not.toBe(b);
    });
});
```

파일 상단 import에 `narrowMarketEventsForCacheKey`를 추가한다(알파벳순 유지).

- [ ] **Step 2: 실패 확인**

Run: `yarn vitest run src/__tests__/infrastructure/cache/config.test.ts`
Expected: FAIL — `narrowMarketEventsForCacheKey is not a function`

- [ ] **Step 3: 구현**

`src/infrastructure/cache/config.ts`.

먼저 `historyKeySuffix` 바로 아래에 suffix 함수를 추가한다:

```typescript
/**
 * @internal
 * Cache-key segment for the market-events fingerprint.
 *
 * Absent when no event renders, so a symbol with no qualifying news produces
 * the exact same key this builder produced before the parameter existed.
 */
function eventsKeySuffix(fingerprint?: string): string {
    return fingerprint !== undefined ? `:evt=${fingerprint}` : '';
}
```

`narrowPriorAnalysesForCacheKey` 아래에 좁히기 함수를 추가한다:

```typescript
/** @internal Result of {@link narrowMarketEventsForCacheKey}. */
interface NarrowedMarketEvents {
    candidates: MarketEvent[];
    fingerprint: string | undefined;
}

/**
 * @internal
 *
 * Selects the market events that will render, and fingerprints them for the
 * cache key.
 *
 * Unlike {@link narrowPriorAnalysesForCacheKey} there is no TTL gate here.
 * Prior analyses need one because a user's own freshly-finished analysis would
 * otherwise invalidate every other user's cache entry mid-window. Events do not
 * have that problem: they are facts about the past, so two requests looking at
 * the same bar window see the same set. The one thing that can shift it is a
 * late-arriving article, which costs a single cache miss and buys a more
 * accurate answer.
 *
 * The fingerprint is over publication times only — the same selection in a
 * different input order must not split the cache.
 */
export function narrowMarketEventsForCacheKey(
    events: readonly MarketEvent[],
    bars: readonly Bar[]
): NarrowedMarketEvents {
    const candidates = selectMarketEvents(events, bars);
    if (candidates.length === 0) {
        return { candidates, fingerprint: undefined };
    }

    const fingerprint = hashAnalysisInput(
        candidates
            .map(entry => entry.publishedAt.getTime())
            .toSorted((a, b) => a - b)
            .join(',')
    );
    return { candidates, fingerprint };
}
```

`buildAnalysisCacheKey`에 인자를 추가한다:

```typescript
export function buildAnalysisCacheKey(
    symbol: string,
    timeframe: Timeframe,
    modelId = DEFAULT_ANALYSIS_MODEL_ID,
    skillFingerprint?: string,
    reasoning?: boolean,
    positionBucket?: PositionBucket,
    locale?: AnalysisLocale,
    historyFingerprint?: string,
    eventsFingerprint?: string
): string {
    const base = `analysis:${symbol}:${timeframe}:${modelId}:${PROMPT_TEMPLATE_VERSION}`;
    const withFingerprint =
        skillFingerprint !== undefined ? `${base}:${skillFingerprint}` : base;
    return `${withFingerprint}${reasoningKeySuffix(reasoning)}${positionKeySuffix(positionBucket)}${localeKeySuffix(locale)}${historyKeySuffix(historyFingerprint)}${eventsKeySuffix(eventsFingerprint)}`;
}
```

import에 `selectMarketEvents`(`@/domain/analysis/marketEvents`)와 타입 `MarketEvent`를 추가한다.

- [ ] **Step 4: 통과 확인**

Run: `yarn vitest run src/__tests__/infrastructure/cache/config.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/infrastructure/cache/config.ts src/__tests__/infrastructure/cache/config.test.ts
git commit -m "feat: narrowMarketEventsForCacheKey + 캐시 키 evt 세그먼트"
```

---

### Task 5: 프롬프트 편입

**Files:**
- Modify: `src/domain/analysis/prompt.ts`
- Test: `src/__tests__/domain/analysis/prompt.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`prompt.test.ts`에서 기존 `buildAnalysisPrompt` 호출 헬퍼를 찾아 그 패턴을 따른다.
(파일마다 픽스처 이름이 다르므로 **먼저 기존 테스트를 읽고** 같은 헬퍼를 재사용할 것.)

```typescript
describe('marketEvents 주입', () => {
    it('이벤트를 넘기지 않으면 프롬프트가 이 파라미터 도입 전과 바이트 단위로 같다', () => {
        const without = buildAnalysisPrompt(/* 기존 테스트와 동일 인자 */);
        const withEmpty = buildAnalysisPrompt(/* 동일 인자 */, []);

        expect(withEmpty.dynamic).toBe(without.dynamic);
        expect(withEmpty.stable).toBe(without.stable);
    });

    it('이벤트를 넘기면 dynamic에 `## Market Events` 가 들어간다', () => {
        const result = buildAnalysisPrompt(/* 기존 인자 */, [
            {
                publishedAt: /* 봉 범위 안 시각 */,
                category: 'earnings',
                sentiment: 'bullish',
                impact: 'high',
            },
        ]);

        expect(result.dynamic).toContain('## Market Events');
        expect(result.stable).not.toContain('## Market Events');
    });
});
```

`stable`에 들어가지 않는지 확인하는 단언이 중요하다 — `stable`은 content-addressed
blob으로 저장되므로 요청마다 달라지는 값이 들어가면 blob이 폭증한다.

- [ ] **Step 2: 실패 확인**

Run: `yarn vitest run src/__tests__/domain/analysis/prompt.test.ts`
Expected: FAIL

- [ ] **Step 3: 구현**

`buildAnalysisPrompt` 시그니처 끝에 파라미터를 추가한다(`priorAnalyses` 다음):

```typescript
    priorAnalyses?: readonly PriorAnalysis[],
    marketEvents?: readonly MarketEvent[]
```

본문에서 `priorAnalysisSection` 계산 근처에 추가한다:

```typescript
    const marketEventsSection = formatMarketEventsSection(
        marketEvents ?? [],
        bars,
        symbol,
        timeframe
    );
```

`dynamicSections` 배열에서 `priorAnalysisSection` **바로 앞**에 넣는다:

```typescript
        // 이벤트를 이력보다 앞에 둔다: 이벤트는 봉에 대한 사실이라 위쪽 봉
        // 데이터의 연장이고, 이력은 그 위에서 내린 과거 판단이라 한 겹 위다.
        ...(marketEventsSection !== '' ? [marketEventsSection] : []),
        ...(priorAnalysisSection !== '' ? [priorAnalysisSection] : []),
```

import를 추가한다.

- [ ] **Step 4: 통과 확인**

Run: `yarn vitest run src/__tests__/domain/analysis/prompt.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/domain/analysis/prompt.ts src/__tests__/domain/analysis/prompt.test.ts
git commit -m "feat: buildAnalysisPrompt에 marketEvents 파라미터 추가"
```

---

### Task 6: `runAnalysis` 배선 + 버전 bump

**Files:**
- Modify: `src/application/market/types.ts`
- Modify: `src/application/market/runAnalysis.ts`
- Modify: `src/infrastructure/cache/config.ts` (버전)
- Test: `src/__tests__/application/market/runAnalysis.test.ts`
- Test: `src/__tests__/infrastructure/cache/config.test.ts` (버전 핀)

- [ ] **Step 1: 옵션 타입 추가**

`SubmitAnalysisOptions`에 `priorAnalyses` 다음으로 추가한다:

```typescript
    /**
     * Market-moving news events for this symbol, supplied by the consumer from
     * its own store — core has no news storage of its own.
     *
     * Core narrows this list before it reaches the LLM: only `high`/`medium`
     * impact events that landed inside the rendered bar window survive, capped
     * at `MARKET_EVENT_LIMIT` (see `selectMarketEvents`). The same selection
     * is fingerprinted into the cache key, so two requests seeing the same bars
     * and the same events share an entry.
     *
     * Omitting this field (or supplying `[]`) produces a prompt AND a cache key
     * that are BYTE-IDENTICAL to what this call produced before the field
     * existed — no `## Market Events` section, no `:evt=` key segment.
     */
    marketEvents?: readonly MarketEvent[];
```

- [ ] **Step 2: 실패하는 테스트 작성**

`runAnalysis.test.ts`에 추가한다(기존 `priorAnalyses` 테스트가 있으면 그 패턴을 따를 것):

```typescript
it('marketEvents를 넘기면 프롬프트에 `## Market Events` 가 실린다', async () => {
    await runAnalysis(mockSymbol, mockCompanyName, mockTimeframe, false, undefined, {
        marketDataProvider: fakeProvider,
        marketEvents: [
            {
                publishedAt: /* fakeProvider 가 주는 봉 범위 안 시각 */,
                category: 'earnings' as const,
                sentiment: 'bullish' as const,
                impact: 'high' as const,
            },
        ],
    });

    const [{ prompt }] = mockCallAnalysisAi.mock.calls.at(-1)!;
    expect(prompt).toContain('## Market Events');
});
```

`mockCallAnalysisAi` 호출 인자 형태는 기존 테스트("callAnalysisAi receives prompt,
system, seed, and model")를 그대로 참고할 것.

- [ ] **Step 3: 실패 확인**

Run: `yarn vitest run src/__tests__/application/market/runAnalysis.test.ts`
Expected: FAIL

- [ ] **Step 4: 구현**

`runAnalysisImpl`에서 `narrowPriorAnalysesForCacheKey` 호출 바로 뒤에 추가한다:

```typescript
    const { candidates: marketEventCandidates, fingerprint: eventsFingerprint } =
        narrowMarketEventsForCacheKey(options.marketEvents ?? [], bars);
```

**중요**: 이 호출은 `bars`를 쓰므로 `fetchBarsWithIndicators` **이후**여야 한다.
`narrowPriorAnalysesForCacheKey`는 봉 없이도 도는 반면 이쪽은 봉이 필요하다. 그런데
캐시 키는 봉을 가져오기 **전에** 만들어져야 한다 — 이 순서 충돌은 아래 Step 5에서
해결한다.

- [ ] **Step 5: 순서 충돌 해결**

`runAnalysis.ts`의 현재 흐름은 `cacheKey` 계산 → 캐시 조회 → miss면 봉 fetch다.
이벤트 좁히기는 봉이 필요하므로 그대로는 캐시 키에 넣을 수 없다.

**해결**: 캐시 키용 fingerprint는 봉 없이 계산한다. `selectMarketEvents`를 쓰지 않고,
소비자가 넘긴 이벤트 중 `high`/`medium`만 골라 `publishedAt`으로 해시한다. 봉 기준
절단은 프롬프트 렌더 단계에서만 적용한다.

`narrowMarketEventsForCacheKey`를 다음과 같이 고친다(Task 4의 구현을 대체):

```typescript
export function narrowMarketEventsForCacheKey(
    events: readonly MarketEvent[]
): NarrowedMarketEvents {
    const candidates = events
        .filter(entry => RANKED_IMPACTS.includes(entry.impact))
        .toSorted((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

    if (candidates.length === 0) {
        return { candidates, fingerprint: undefined };
    }

    const fingerprint = hashAnalysisInput(
        candidates
            .map(entry => entry.publishedAt.getTime())
            .toSorted((a, b) => a - b)
            .join(',')
    );
    return { candidates, fingerprint };
}
```

`RANKED_IMPACTS`를 `marketEvents.ts`에서 export하고 여기서 import한다.

Task 4의 테스트에서 `bars` 인자를 제거하고, "봉 범위 밖 이벤트 제외"는
`selectMarketEvents` 테스트(Task 2)가 이미 담당하므로 캐시 테스트에서는 뺀다.

이 분리는 이력의 2단 좁히기와 같은 구조다 — 캐시 키는 봉 없이(stage 1), 프롬프트는
봉 기준으로(stage 2).

- [ ] **Step 6: 프롬프트 호출에 전달**

```typescript
    const { stable, dynamic } = buildAnalysisPrompt(
        /* 기존 인자 그대로 */,
        priorAnalysisCandidates,
        options.marketEvents ?? []
    );
```

봉 기준 절단은 `formatMarketEventsSection` 안에서 `selectMarketEvents`가 처리한다.
따라서 `formatMarketEventsSection`이 `selectMarketEvents`를 호출하도록 Task 3의
구현을 조정한다:

```typescript
export function formatMarketEventsSection(
    events: readonly MarketEvent[],
    bars: readonly Bar[],
    symbol: string,
    timeframe: Timeframe
): string {
    const selected = selectMarketEvents(events, bars);
    if (selected.length === 0) return '';
    // ... 이하 동일
}
```

Task 3의 테스트에서 "선택된 이벤트가 없으면"은 "필터를 통과하는 이벤트가 없으면"으로
의미가 바뀌므로, `impact: 'low'` 이벤트를 넘겨 `''`가 나오는지 확인하도록 고친다.

- [ ] **Step 7: 버전 bump**

`PROMPT_TEMPLATE_VERSION`을 `p10` → `p11`로 올리고, 기존 `@remarks` 체인에 이어 붙인다:

```typescript
/**
 * @remarks
 * **`p11` = market-events context section.** `buildAnalysisPrompt` gains a
 * trailing `marketEvents` parameter; when the caller supplies qualifying
 * events, a `## Market Events` block renders between the bar data and the
 * prior-analysis section. Bytes change only for requests carrying events
 * (`formatMarketEventsSection` returns `''` otherwise), the same scope as
 * `p9`/`p10`, but the constant has no per-request axis so the bump still
 * cold-starts the fleet.
 */
```

`config.test.ts`의 버전 핀 테스트를 `'p11'`로 갱신하고 사유 주석을 이어 쓴다.

- [ ] **Step 8: 전체 게이트**

Run: `yarn typecheck && yarn lint && yarn test`
Expected: 전부 통과, lint 경고 **0건**

- [ ] **Step 9: 커밋**

```bash
git add -u
git commit -m "feat: runAnalysis에 marketEvents 배선 + PROMPT_TEMPLATE_VERSION p11"
```

---

### Task 7: core PR → 머지 → 릴리스

- [ ] **Step 1: 전체 게이트 재확인**

Run: `yarn typecheck && yarn lint && yarn test`

- [ ] **Step 2: PR 생성**

git-agent에 위임한다. 본문에 포함할 것:
- 무엇을/왜 (차트 움직임의 원인을 technical 축이 몰랐다)
- 윈도우를 `recentBarsCount`에 맞춘 이유
- 이력과 달리 TTL 게이트가 없는 이유
- 이벤트 없으면 바이트 동일

- [ ] **Step 3: 리뷰 루프**

CHANGES_REQUESTED면 지적을 **검증 후** 반영한다. 거짓이면 근거와 함께 반려한다.
재리뷰는 Draft 토글로만 트리거된다(push는 트리거가 아니다).

- [ ] **Step 4: 머지 후 릴리스**

APPROVED + CLEAN 확인 → 일반 merge(squash 아님) → `v0.59.0` 태그를 **`git push`로**
푸시(API로 만든 ref는 push 이벤트를 안 내서 배포가 조용히 안 돈다) → publish 워크플로
성공 확인 → **레지스트리에서 실물 확인**(워크플로 성공만으로는 부족하다).

---

## Phase 2 — siglens

Phase 1 릴리스가 끝난 뒤 시작한다. 브랜치는 `docs/market-events-spec`(스펙 커밋이
이미 있다)에 이어서 쓰거나, 새 브랜치를 파고 스펙 커밋을 cherry-pick한다.

### Task 8: 조회 함수

**Files:**
- Create: `src/entities/news-article/marketEventsRepository.ts`
- Test: `src/entities/news-article/__tests__/marketEventsRepository.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

기존 `analysisHistoryRepository.test.ts`의 `makeDb()` 스텁 패턴을 그대로 따른다
(drizzle 체인을 vi.fn()으로 흉내내는 방식). 검증할 것:

- WHERE 절이 `symbol` / `published_at` 범위 / `price_impact IN ('high','medium')`
  네 조건인가
- `price_impact IS NULL` 행이 제외되는가 (`inArray`가 NULL을 걸러 준다는 사실에
  의존하지 말고 명시적으로 단언할 것)
- 반환값이 `MarketEvent[]`로 매핑되는가 (`published_at` → `Date`)
- 유효하지 않은 `category`/`sentiment` 문자열은 그 행을 버리는가

마지막 항목이 중요하다. `analysisHistoryRepository`의 `isTrend`/`isRiskLevel` 선례를
따라 union 멤버십을 검사한다 — 캐스트만 하면 몇 달 전 스키마가 쓴 값이 프롬프트에
사실처럼 실린다.

- [ ] **Step 2: 실패 확인 → 구현 → 통과 확인**

```typescript
import 'server-only';

import { and, desc, eq, gte, inArray, lte } from 'drizzle-orm';
import type {
    MarketEvent,
    NewsCategory,
    NewsImpact,
    NewsSentiment,
} from '@y0ngha/siglens-core';
import { news } from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';

/**
 * 프롬프트에 실을 수 있는 영향도. core의 `selectMarketEvents`와 같은 기준이며,
 * 여기서 한 번 더 거르는 이유는 DB에서 안 읽어 오는 편이 싸기 때문이다.
 */
const QUALIFYING_IMPACTS: NewsImpact[] = ['high', 'medium'];

const CATEGORIES: ReadonlySet<string> = new Set<NewsCategory>([
    'earnings',
    'm_and_a',
    'guidance',
    'regulation',
    'macro',
    'product',
    'other',
]);
const SENTIMENTS: ReadonlySet<string> = new Set<NewsSentiment>([
    'bullish',
    'neutral',
    'bearish',
]);
const IMPACTS: ReadonlySet<string> = new Set<NewsImpact>([
    'high',
    'medium',
    'low',
    'negligible',
]);

const isCategory = (v: unknown): v is NewsCategory =>
    typeof v === 'string' && CATEGORIES.has(v);
const isSentiment = (v: unknown): v is NewsSentiment =>
    typeof v === 'string' && SENTIMENTS.has(v);
const isImpact = (v: unknown): v is NewsImpact =>
    typeof v === 'string' && IMPACTS.has(v);

/**
 * 봉 구간에 발행된 고영향 뉴스를 core의 `MarketEvent`로 투영해 읽는다.
 *
 * **본문·제목을 읽지 않는다.** 프롬프트에 실리는 것은 분류뿐이고, 기사 텍스트는
 * news/overall 축의 몫이다. 컬럼을 명시적으로 나열하는 것도 그래서다 —
 * `SELECT *`면 본문이 딸려 오고, 그 크기가 요청마다 낭비된다.
 *
 * 인덱스: `news_symbol_published_at_idx` (이미 존재).
 */
export async function findMarketEventsForPrompt(
    db: SiglensDatabase,
    input: { symbol: string; from: Date; to: Date }
): Promise<MarketEvent[]> {
    const rows = await db
        .select({
            publishedAt: news.publishedAt,
            category: news.category,
            sentiment: news.sentiment,
            impact: news.priceImpact,
        })
        .from(news)
        .where(
            and(
                eq(news.symbol, input.symbol),
                gte(news.publishedAt, input.from),
                lte(news.publishedAt, input.to),
                inArray(news.priceImpact, QUALIFYING_IMPACTS)
            )
        )
        .orderBy(desc(news.publishedAt));

    return rows.flatMap(row =>
        isCategory(row.category) &&
        isSentiment(row.sentiment) &&
        isImpact(row.impact)
            ? [
                  {
                      publishedAt: row.publishedAt,
                      category: row.category,
                      sentiment: row.sentiment,
                      impact: row.impact,
                  },
              ]
            : []
    );
}
```

`import 'server-only'`이므로 **barrel(`index.ts`)에 넣지 않는다**. 소비자는 경로로
직접 import한다(`analysisHistoryRepository` 선례).

- [ ] **Step 3: 커밋**

---

### Task 9: technical 경로 배선

**Files:**
- Modify: `src/app/api/analysis/stream/route.ts`
- Modify: `src/entities/analysis/api.ts`
- Test: 각 경로의 기존 테스트 파일

- [ ] **Step 1: 봉 범위 계산 위치 확인**

`findMarketEventsForPrompt`는 `from`/`to`가 필요한데, 그 값은 봉에서 나온다. 그런데
siglens는 봉을 직접 안 가져온다 — core가 가져온다.

**해결**: `recentBarsCount`와 타임프레임으로 벽시계 근사값을 만든다. core는 봉 기준으로
다시 자르므로(`selectMarketEvents`) 넉넉히 잡아도 안전하다.

```typescript
const MARKET_EVENT_LOOKBACK_DAYS: Record<string, number> = {
    '5Min': 2,
    '15Min': 3,
    '30Min': 4,
    '1Hour': 5,
    '4Hour': 14,
    '1Day': 60,
};
```

넉넉한 이유: 봉 `recentBarsCount`가 거래 시간 기준이라 야간·주말을 건너뛰므로, 벽시계
범위는 그보다 커야 같은 구간을 덮는다. 과하게 읽어도 core가 버린다.

- [ ] **Step 2: stream route 배선**

이력 조회(`findRecentForPrompt`) 바로 옆에서 함께 조회한다. `Promise.all`로 묶어
왕복을 겹친다.

- [ ] **Step 3: prewarm 배선**

`entities/analysis/api.ts`의 `prewarmTechnical`에 같은 방식으로 추가한다.
**스트림 경로와 같은 lookback을 써야** core가 만드는 캐시 키가 갈리지 않는다.

- [ ] **Step 4: 테스트 갱신 + 전체 게이트**

Run: `yarn typecheck && yarn lint && yarn test`

- [ ] **Step 5: 커밋**

---

### Task 10: A/B 검증

- [ ] **Step 1: 백테스트 스크립트에 뉴스 축 추가**

이전 백테스트(`_bt15.ts` 패턴)를 되살려 `WITH_EVENTS` 환경변수를 추가한다. 뉴스는
`publishedAt <= 봉 시각` 조건으로 조회해 미래 정보를 주지 않는다.

- [ ] **Step 2: 이벤트가 있는 구간 선정**

NVDA 2026-09-02(+2.15%, 변동폭 4.33%) 전후로 `price_impact IN ('high','medium')`
뉴스가 실제로 있는지 먼저 조회해 확인한다. 없으면 이벤트가 있는 다른 심볼/날짜로
바꾼다.

- [ ] **Step 3: ON/OFF 각 1회 실행 후 비교**

측정:
- 이벤트일 판단이 갈리는가 (`trend`, `entryRecommendation`)
- 산문에서 이벤트를 언급하는가 (정규식 카운트)
- `stopLoss` 분산이 커지지 않는가 (뉴스 감정에 끌려가는 부작용)

- [ ] **Step 4: 결과를 PROGRESS.md에 기록**

---

## Self-Review 결과

- **스펙 커버리지**: 스펙의 모든 섹션이 Task에 대응한다. 다만 스펙이 "봉 범위로
  fingerprint를 계산한다"고 썼는데 Task 6 Step 5에서 **캐시 키는 봉 없이** 계산하도록
  바뀌었다 — 캐시 키가 봉 fetch보다 먼저 만들어져야 하기 때문이다. 이력의 2단 좁히기와
  같은 제약이며, 스펙을 이 방향으로 수정해야 한다.
- **타입 일관성**: `MarketEvent`, `selectMarketEvents`, `formatMarketEventsSection`,
  `narrowMarketEventsForCacheKey`, `findMarketEventsForPrompt` 이름이 전 Task에서
  일치한다.
- **placeholder**: 없다. Task 8의 `CATEGORIES`는 core `NewsCategory` 유니온의 실제
  멤버 7개(`earnings`, `m_and_a`, `guidance`, `regulation`, `macro`, `product`,
  `other`)로 채웠다.
- **스펙 동기화 완료**: 위 캐시 키 불일치를 스펙의 "2단 좁히기" 절로 반영했다.

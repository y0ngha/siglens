# Long-tail Sitemap 서브 라우트 추가 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Long-tail 티커의 서브 라우트(news, fundamental, overall, fear-greed)를 sitemap에 추가하여 Google에 개별 페이지 신호를 보강한다.

**Architecture:** `buildLongTailEntries` 순수 함수를 신규 생성하여 티커 배열 → 5개 라우트 `SitemapEntry[]`를 반환한다. 기존 longtail route handler가 이 함수를 호출하도록 교체하고, sitemap index의 페이지네이션 계산도 5배 URL 증가분을 반영한다.

**Tech Stack:** Next.js Route Handler, Vitest

**Spec:** `docs/superpowers/specs/2026-05-26-longtail-sitemap-subroutes-design.md`

---

### Task 1: `LONGTAIL_ENTRIES_PER_TICKER` 상수 추가

**Files:**
- Modify: `src/entities/sitemap-entry/model.ts`

- [ ] **Step 1: model.ts에 상수 추가**

```typescript
// model.ts 맨 아래에 추가

/**
 * long-tail 티커당 sitemap 엔트리 수.
 * chart + news + fundamental + overall + fear-greed = 5.
 * sitemap index 페이지네이션과 longtail route handler 양쪽에서 참조한다.
 */
export const LONGTAIL_ENTRIES_PER_TICKER = 5;
```

- [ ] **Step 2: barrel에 re-export 추가**

`src/entities/sitemap-entry/index.ts`에 추가:

```typescript
export { SITEMAP_MAX_URLS_PER_FILE, LONGTAIL_ENTRIES_PER_TICKER } from './model';
```

(기존 `export { SITEMAP_MAX_URLS_PER_FILE } from './model';` 라인을 교체)

- [ ] **Step 3: 커밋**

```bash
git add src/entities/sitemap-entry/model.ts src/entities/sitemap-entry/index.ts
git commit -m "feat(sitemap): add LONGTAIL_ENTRIES_PER_TICKER constant"
```

---

### Task 2: `buildLongTailEntries` 함수 + 테스트

**Files:**
- Create: `src/entities/sitemap-entry/lib/buildLongTailEntries.ts`
- Create: `src/entities/sitemap-entry/__tests__/buildLongTailEntries.test.ts`
- Modify: `src/entities/sitemap-entry/index.ts`

- [ ] **Step 1: 테스트 파일 작성**

`src/entities/sitemap-entry/__tests__/buildLongTailEntries.test.ts`:

```typescript
vi.mock('@/shared/lib/seo', () => ({
    SITE_URL: 'https://siglens.io',
}));

import { buildLongTailEntries } from '../lib/buildLongTailEntries';

const BUILD_DATE = new Date('2026-01-15T00:00:00.000Z');

describe('buildLongTailEntries', () => {
    it('티커 1개 → 5개 엔트리(chart, news, fundamental, overall, fear-greed)를 반환한다', () => {
        const entries = buildLongTailEntries(['AAPL'], BUILD_DATE);
        expect(entries).toHaveLength(5);

        const urls = entries.map(e => e.url);
        expect(urls).toEqual([
            'https://siglens.io/AAPL',
            'https://siglens.io/AAPL/news',
            'https://siglens.io/AAPL/fundamental',
            'https://siglens.io/AAPL/overall',
            'https://siglens.io/AAPL/fear-greed',
        ]);
    });

    it('여러 티커에 대해 올바른 총 엔트리 수를 반환한다', () => {
        const entries = buildLongTailEntries(['AAPL', 'MSFT', 'GOOG'], BUILD_DATE);
        expect(entries).toHaveLength(15);
    });

    it('빈 배열 → 빈 배열을 반환한다', () => {
        const entries = buildLongTailEntries([], BUILD_DATE);
        expect(entries).toHaveLength(0);
    });

    it('chart는 priority 0.5 / weekly, 서브 라우트는 설계대로 priority와 changefreq를 설정한다', () => {
        const entries = buildLongTailEntries(['AAPL'], BUILD_DATE);

        const chart = entries.find(e => e.url.endsWith('/AAPL'))!;
        expect(chart.priority).toBe(0.5);
        expect(chart.changeFrequency).toBe('weekly');

        const news = entries.find(e => e.url.endsWith('/news'))!;
        expect(news.priority).toBe(0.45);
        expect(news.changeFrequency).toBe('weekly');

        const fundamental = entries.find(e => e.url.endsWith('/fundamental'))!;
        expect(fundamental.priority).toBe(0.4);
        expect(fundamental.changeFrequency).toBe('monthly');

        const overall = entries.find(e => e.url.endsWith('/overall'))!;
        expect(overall.priority).toBe(0.45);
        expect(overall.changeFrequency).toBe('weekly');

        const fearGreed = entries.find(e => e.url.endsWith('/fear-greed'))!;
        expect(fearGreed.priority).toBe(0.4);
        expect(fearGreed.changeFrequency).toBe('weekly');
    });

    it('모든 엔트리의 lastModified는 전달받은 buildDate와 같다', () => {
        const entries = buildLongTailEntries(['AAPL'], BUILD_DATE);
        for (const entry of entries) {
            expect(entry.lastModified).toBe(BUILD_DATE);
        }
    });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
yarn test src/entities/sitemap-entry/__tests__/buildLongTailEntries.test.ts
```

Expected: FAIL — `buildLongTailEntries` 모듈이 존재하지 않음.

- [ ] **Step 3: `buildLongTailEntries.ts` 구현**

`src/entities/sitemap-entry/lib/buildLongTailEntries.ts`:

```typescript
import { SITE_URL } from '@/shared/lib/seo';
import type { SitemapEntry } from '../model';

/**
 * long-tail 티커에 대한 sitemap 엔트리를 생성한다.
 * popular과 달리 옵션 라우트 제외, 낮은 priority, 고정 lastmod(SITE_BUILD_DATE).
 *
 * 순수 함수라 테스트에서 시간/외부 의존 mock 없이 결정적 검증 가능.
 */
export function buildLongTailEntries(
    tickers: readonly string[],
    buildDate: Date
): SitemapEntry[] {
    return tickers.flatMap((ticker): SitemapEntry[] => [
        {
            url: `${SITE_URL}/${ticker}`,
            lastModified: buildDate,
            changeFrequency: 'weekly',
            priority: 0.5,
        },
        {
            url: `${SITE_URL}/${ticker}/news`,
            lastModified: buildDate,
            changeFrequency: 'weekly',
            priority: 0.45,
        },
        {
            url: `${SITE_URL}/${ticker}/fundamental`,
            lastModified: buildDate,
            changeFrequency: 'monthly',
            priority: 0.4,
        },
        {
            url: `${SITE_URL}/${ticker}/overall`,
            lastModified: buildDate,
            changeFrequency: 'weekly',
            priority: 0.45,
        },
        {
            url: `${SITE_URL}/${ticker}/fear-greed`,
            lastModified: buildDate,
            changeFrequency: 'weekly',
            priority: 0.4,
        },
    ]);
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
yarn test src/entities/sitemap-entry/__tests__/buildLongTailEntries.test.ts
```

Expected: PASS — 전체 5개 테스트 통과.

- [ ] **Step 5: barrel에 re-export 추가**

`src/entities/sitemap-entry/index.ts`에 추가:

```typescript
export { buildLongTailEntries } from './lib/buildLongTailEntries';
```

- [ ] **Step 6: 커밋**

```bash
git add src/entities/sitemap-entry/lib/buildLongTailEntries.ts \
        src/entities/sitemap-entry/__tests__/buildLongTailEntries.test.ts \
        src/entities/sitemap-entry/index.ts
git commit -m "feat(sitemap): add buildLongTailEntries with 5-route expansion"
```

---

### Task 3: longtail route handler 수정

**Files:**
- Modify: `src/app/api/sitemap/longtail/[page]/route.ts`

- [ ] **Step 1: route handler에서 인라인 엔트리 생성을 `buildLongTailEntries`로 교체하고 페이지네이션을 티커 단위로 변경**

`src/app/api/sitemap/longtail/[page]/route.ts` 전체를 아래로 교체:

```typescript
import { NextResponse } from 'next/server';
import {
    buildLongTailEntries,
    loadLongTailTickers,
    LONGTAIL_ENTRIES_PER_TICKER,
    SITEMAP_MAX_URLS_PER_FILE,
    toUrlSetXml,
} from '@/entities/sitemap-entry';
import { SITE_BUILD_DATE } from '@/shared/lib/seo';

export const dynamic = 'force-dynamic';

/**
 * 한 sitemap 파일에 담을 수 있는 티커 수.
 * 티커당 LONGTAIL_ENTRIES_PER_TICKER개 URL을 생성하므로,
 * SITEMAP_MAX_URLS_PER_FILE을 넘지 않도록 역산한다.
 */
const TICKERS_PER_PAGE = Math.floor(
    SITEMAP_MAX_URLS_PER_FILE / LONGTAIL_ENTRIES_PER_TICKER
);

interface RouteContext {
    params: Promise<{ page: string }>;
}

export async function GET(
    _req: Request,
    { params }: RouteContext
): Promise<Response> {
    const { page } = await params;
    const pageNum = Number.parseInt(page, 10);
    if (!Number.isFinite(pageNum) || pageNum < 1) {
        return new NextResponse('Invalid page number', { status: 404 });
    }

    const all = await loadLongTailTickers();
    const start = (pageNum - 1) * TICKERS_PER_PAGE;
    const chunk = all.slice(start, start + TICKERS_PER_PAGE);

    if (chunk.length === 0) {
        return new NextResponse('Page out of range', { status: 404 });
    }

    const entries = buildLongTailEntries(chunk, SITE_BUILD_DATE);
    const xml = toUrlSetXml(entries);
    return new NextResponse(xml, {
        headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control':
                'public, max-age=3600, stale-while-revalidate=3600',
        },
    });
}
```

- [ ] **Step 2: 빌드 확인**

```bash
yarn build 2>&1 | head -30
```

Expected: 빌드 성공 (sitemap route handler 컴파일 에러 없음).

- [ ] **Step 3: 커밋**

```bash
git add src/app/api/sitemap/longtail/\[page\]/route.ts
git commit -m "feat(sitemap): expand longtail route to 5 entries per ticker"
```

---

### Task 4: sitemap index 페이지네이션 수정

**Files:**
- Modify: `src/app/api/sitemap/route.ts`

- [ ] **Step 1: sitemap index에서 페이지 수 계산을 업데이트**

`src/app/api/sitemap/route.ts`에서 import 변경:

기존:
```typescript
import {
    loadLongTailTickers,
    type SitemapIndexEntry,
    SITEMAP_MAX_URLS_PER_FILE,
    toSitemapIndexXml,
} from '@/entities/sitemap-entry';
```

변경:
```typescript
import {
    loadLongTailTickers,
    LONGTAIL_ENTRIES_PER_TICKER,
    type SitemapIndexEntry,
    SITEMAP_MAX_URLS_PER_FILE,
    toSitemapIndexXml,
} from '@/entities/sitemap-entry';
```

그리고 `longTailPages` 계산 변경:

기존:
```typescript
    const longTailPages = Math.ceil(
        longTailTickers.length / SITEMAP_MAX_URLS_PER_FILE
    );
```

변경:
```typescript
    const tickersPerPage = Math.floor(
        SITEMAP_MAX_URLS_PER_FILE / LONGTAIL_ENTRIES_PER_TICKER
    );
    const longTailPages = Math.ceil(longTailTickers.length / tickersPerPage);
```

JSDoc 주석의 `long-tail × 1 route`를 `long-tail × 5 routes`로 업데이트:

기존:
```
 *   - /sitemap-longtail-{n}.xml : long-tail × 1 route, page당 50,000 URL chunk
```

변경:
```
 *   - /sitemap-longtail-{n}.xml : long-tail × 5 routes (chart/news/fundamental/overall/fear-greed), page당 10,000 tickers
```

- [ ] **Step 2: 빌드 확인**

```bash
yarn build 2>&1 | head -30
```

Expected: 빌드 성공.

- [ ] **Step 3: 커밋**

```bash
git add src/app/api/sitemap/route.ts
git commit -m "feat(sitemap): update index pagination for 5x longtail entries"
```

---

### Task 5: lint + 기존 테스트 전체 통과 확인

- [ ] **Step 1: lint 확인**

```bash
yarn lint 2>&1 | tail -10
```

Expected: 에러 없음.

- [ ] **Step 2: 전체 테스트 확인**

```bash
yarn test 2>&1 | tail -20
```

Expected: 전체 PASS. 기존 sitemap 테스트(`buildStaticEntries.test.ts`, `buildPopularEntries.test.ts`)와 신규 테스트 모두 통과.

- [ ] **Step 3: (선택) 최종 커밋** — lint fix가 필요한 경우에만.

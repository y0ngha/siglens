# SEO Index Quality Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce low-quality longtail index footprint, centralize chart-page indexability decisions, and strengthen chart SSR content quality.

**Architecture:** Add a focused `entities/symbol-indexability` module that decides whether a chart URL is indexable from existing low-cost inputs. Use that decision in chart metadata and sitemap policy, remove longtail sitemap advertising, return `410 Gone` for retired longtail sitemap routes, and make chart SSR visible content more data-specific.

**Tech Stack:** Next.js App Router, TypeScript, Vitest, React Testing Library, existing FSD layers and sitemap route handlers.

---

## File Structure

- Create `src/entities/symbol-indexability/model.ts`
  - Owns indexability input/decision/reason types.
- Create `src/entities/symbol-indexability/config/approved-longtail-tickers.ts`
  - Empty initial approved longtail allowlist.
- Create `src/entities/symbol-indexability/lib/evaluateSymbolIndexability.ts`
  - Pure policy function. Imports popular/crypto curated lists and symbol shape guard.
- Create `src/entities/symbol-indexability/index.ts`
  - Barrel export.
- Create `src/entities/symbol-indexability/__tests__/evaluateSymbolIndexability.test.ts`
  - Unit tests for every reason branch.
- Modify `src/app/api/sitemap/route.ts`
  - Remove longtail count dependency and longtail sitemap entries.
- Modify `src/app/api/sitemap/__tests__/route.test.ts`
  - Assert only static/popular/crypto entries and no count call.
- Modify `src/app/api/sitemap/longtail/[page]/route.ts`
  - Return `410 Gone` for every valid or invalid page request; no DB load.
- Modify `src/app/api/sitemap/__tests__/longtail.test.ts`
  - Replace old pagination tests with retired-route tests.
- Modify `src/app/api/sitemap/crypto/route.ts`
  - Emit curated crypto popular entries only; no DB crypto longtail merge.
- Modify `src/app/api/sitemap/__tests__/crypto.test.ts`
  - Assert crypto sitemap serializes only curated popular entries.
- Modify `src/app/[symbol]/page.tsx`
  - Apply central indexability gate in `generateMetadata`.
  - Remove chart FAQ JSON-LD.
  - Remove hidden keyword-heavy `sr-only` paragraphs, keeping minimal fallback h1/support copy.
- Modify `src/app/[symbol]/__tests__/page.test.ts`
  - Cover popular/crypto index, unapproved longtail noindex, FAQ removal, hidden-keyword removal.
- Modify `src/app/[symbol]/__tests__/symbol-metadata.test.ts`
  - Add regression coverage for central gate on chart route.
- Modify `src/views/symbol/utils/technicalFacts.ts`
  - Add deterministic narrative builder.
- Modify `src/views/symbol/TechnicalFactsSummary.tsx`
  - Render narrative paragraphs as visible content.
- Modify `src/views/symbol/__tests__/utils/technicalFacts.test.ts`
  - Unit test narrative builder branches.
- Modify `src/views/symbol/__tests__/TechnicalFactsSummary.test.tsx`
  - Assert visible narrative text renders.

## Task 1: Add Central Indexability Policy

**Files:**
- Create: `src/entities/symbol-indexability/model.ts`
- Create: `src/entities/symbol-indexability/config/approved-longtail-tickers.ts`
- Create: `src/entities/symbol-indexability/lib/evaluateSymbolIndexability.ts`
- Create: `src/entities/symbol-indexability/index.ts`
- Create: `src/entities/symbol-indexability/__tests__/evaluateSymbolIndexability.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/entities/symbol-indexability/__tests__/evaluateSymbolIndexability.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { evaluateSymbolIndexability } from '../lib/evaluateSymbolIndexability';
import type { AssetInfo } from '@/shared/lib/types';

function asset(symbol: string, overrides: Partial<AssetInfo> = {}): AssetInfo {
    return {
        symbol,
        name: `${symbol} Inc.`,
        ...overrides,
    } as AssetInfo;
}

describe('evaluateSymbolIndexability', () => {
    it('blocks invalid symbol shape', () => {
        expect(
            evaluateSymbolIndexability({
                symbol: '!!!',
                route: 'chart',
                assetInfo: null,
                degraded: false,
            })
        ).toEqual({ indexable: false, reason: 'invalid-symbol' });
    });

    it('blocks missing assetInfo', () => {
        expect(
            evaluateSymbolIndexability({
                symbol: 'ZZZQ',
                route: 'chart',
                assetInfo: null,
                degraded: false,
            })
        ).toEqual({ indexable: false, reason: 'asset-missing' });
    });

    it('blocks degraded fallback even for popular tickers', () => {
        expect(
            evaluateSymbolIndexability({
                symbol: 'AAPL',
                route: 'chart',
                assetInfo: asset('AAPL'),
                degraded: true,
            })
        ).toEqual({ indexable: false, reason: 'degraded' });
    });

    it('allows popular equity tickers', () => {
        expect(
            evaluateSymbolIndexability({
                symbol: 'aapl',
                route: 'chart',
                assetInfo: asset('AAPL'),
                degraded: false,
            })
        ).toEqual({ indexable: true, reason: 'popular' });
    });

    it('allows curated crypto tickers', () => {
        expect(
            evaluateSymbolIndexability({
                symbol: 'btcusd',
                route: 'chart',
                assetInfo: asset('BTCUSD', { marketProfile: 'crypto' }),
                degraded: false,
            })
        ).toEqual({ indexable: true, reason: 'curated-crypto' });
    });

    it('blocks unapproved longtail tickers by default', () => {
        expect(
            evaluateSymbolIndexability({
                symbol: '0NEUSD',
                route: 'chart',
                assetInfo: asset('0NEUSD', { marketProfile: 'crypto' }),
                degraded: false,
            })
        ).toEqual({
            indexable: false,
            reason: 'longtail-default-blocked',
        });
    });

    it('blocks obscure equity-shaped longtail tickers by default', () => {
        expect(
            evaluateSymbolIndexability({
                symbol: 'ZZZOF',
                route: 'chart',
                assetInfo: asset('ZZZOF'),
                degraded: false,
            })
        ).toEqual({
            indexable: false,
            reason: 'longtail-default-blocked',
        });
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
yarn vitest run src/entities/symbol-indexability/__tests__/evaluateSymbolIndexability.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Add model types**

Create `src/entities/symbol-indexability/model.ts`:

```ts
import type { AssetInfo } from '@/shared/lib/types';

export type SymbolIndexabilityRoute = 'chart';

export interface SymbolIndexabilityInput {
    symbol: string;
    route: SymbolIndexabilityRoute;
    assetInfo: AssetInfo | null;
    degraded: boolean;
}

export type SymbolIndexabilityReason =
    | 'popular'
    | 'curated-crypto'
    | 'approved-longtail'
    | 'invalid-symbol'
    | 'asset-missing'
    | 'degraded'
    | 'longtail-default-blocked';

export interface SymbolIndexabilityDecision {
    indexable: boolean;
    reason: SymbolIndexabilityReason;
}
```

- [ ] **Step 4: Add the initial approved longtail allowlist**

Create `src/entities/symbol-indexability/config/approved-longtail-tickers.ts`:

```ts
// Initially empty by design. Longtail re-opening must be explicit and reviewed.
export const APPROVED_LONGTAIL_TICKERS = [] as const;
```

- [ ] **Step 5: Add the pure policy implementation**

Create `src/entities/symbol-indexability/lib/evaluateSymbolIndexability.ts`:

```ts
import { POPULAR_CRYPTOS } from '@/shared/config/popular-cryptos';
import { POPULAR_TICKERS } from '@/shared/config/popular-tickers';
import { isAdmissibleSymbolShape } from '@/shared/config/market';
import { APPROVED_LONGTAIL_TICKERS } from '../config/approved-longtail-tickers';
import type {
    SymbolIndexabilityDecision,
    SymbolIndexabilityInput,
} from '../model';

const POPULAR_TICKER_SET = new Set<string>(POPULAR_TICKERS);
const POPULAR_CRYPTO_SET = new Set<string>(POPULAR_CRYPTOS);
const APPROVED_LONGTAIL_SET = new Set<string>(APPROVED_LONGTAIL_TICKERS);

export function evaluateSymbolIndexability({
    symbol,
    assetInfo,
    degraded,
}: SymbolIndexabilityInput): SymbolIndexabilityDecision {
    const upper = symbol.toUpperCase();

    if (!isAdmissibleSymbolShape(upper)) {
        return { indexable: false, reason: 'invalid-symbol' };
    }

    if (!assetInfo) {
        return { indexable: false, reason: 'asset-missing' };
    }

    if (degraded) {
        return { indexable: false, reason: 'degraded' };
    }

    if (POPULAR_TICKER_SET.has(upper)) {
        return { indexable: true, reason: 'popular' };
    }

    if (POPULAR_CRYPTO_SET.has(upper)) {
        return { indexable: true, reason: 'curated-crypto' };
    }

    if (APPROVED_LONGTAIL_SET.has(upper)) {
        return { indexable: true, reason: 'approved-longtail' };
    }

    return { indexable: false, reason: 'longtail-default-blocked' };
}
```

- [ ] **Step 6: Add barrel exports**

Create `src/entities/symbol-indexability/index.ts`:

```ts
export type {
    SymbolIndexabilityDecision,
    SymbolIndexabilityInput,
    SymbolIndexabilityReason,
    SymbolIndexabilityRoute,
} from './model';
export { evaluateSymbolIndexability } from './lib/evaluateSymbolIndexability';
```

- [ ] **Step 7: Run tests**

Run:

```bash
yarn vitest run src/entities/symbol-indexability/__tests__/evaluateSymbolIndexability.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

Do not commit directly from the main agent. In execution, route this checkpoint to `git-agent` or commit from the approved execution environment with:

```bash
git add src/entities/symbol-indexability
git commit -m "feat(seo): add symbol indexability gate"
```

## Task 2: Remove Longtail from Sitemap Index and Retire Longtail Sitemap Routes

**Files:**
- Modify: `src/app/api/sitemap/route.ts`
- Modify: `src/app/api/sitemap/__tests__/route.test.ts`
- Modify: `src/app/api/sitemap/longtail/[page]/route.ts`
- Modify: `src/app/api/sitemap/__tests__/longtail.test.ts`
- Modify: `src/app/api/sitemap/crypto/route.ts`
- Modify: `src/app/api/sitemap/__tests__/crypto.test.ts`

- [ ] **Step 1: Update sitemap index tests first**

In `src/app/api/sitemap/__tests__/route.test.ts`, replace the current mocks and longtail generation assertions with:

```ts
vi.mock('@/entities/sitemap-entry', () => ({
    toSitemapIndexXml: vi
        .fn()
        .mockReturnValue('<?xml version="1.0"?><sitemapindex/>'),
}));
vi.mock('@/shared/lib/seo', () => ({
    SITE_URL: 'https://siglens.io',
}));

import { GET } from '@/app/api/sitemap/route';
import { toSitemapIndexXml } from '@/entities/sitemap-entry';
import type { MockedFunction } from 'vitest';

const mockToSitemapIndexXml = toSitemapIndexXml as MockedFunction<
    typeof toSitemapIndexXml
>;

describe('GET /api/sitemap (index)', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('returns XML with correct content-type and cache headers', async () => {
        const res = await GET();

        expect(res.headers.get('Content-Type')).toBe(
            'application/xml; charset=utf-8'
        );
        expect(res.headers.get('Cache-Control')).toContain('max-age=3600');
    });

    it('passes only static, popular, and crypto sitemap entries', async () => {
        await GET();

        const entries = mockToSitemapIndexXml.mock.calls[0][0];
        expect(entries).toHaveLength(3);
        expect(entries[0].url).toBe('https://siglens.io/sitemap-static.xml');
        expect(entries[1].url).toBe('https://siglens.io/sitemap-popular.xml');
        expect(entries[2].url).toBe('https://siglens.io/sitemap-crypto.xml');
        expect(entries.map(entry => entry.url).join('\n')).not.toContain(
            'sitemap-longtail'
        );
    });
});
```

- [ ] **Step 2: Run sitemap index test to verify it fails**

Run:

```bash
yarn vitest run src/app/api/sitemap/__tests__/route.test.ts
```

Expected: FAIL because production still imports/counts longtail pages and emits longtail entries when the old mock is removed.

- [ ] **Step 3: Simplify sitemap index route**

In `src/app/api/sitemap/route.ts`, remove `LONGTAIL_TICKERS_PER_PAGE`, `countLongTailTickers`, retry constants, and all longtail page calculation. The route body should be:

```ts
import { type SitemapIndexEntry, toSitemapIndexXml } from '@/entities/sitemap-entry';
import { SITE_URL } from '@/shared/lib/seo';
import { NextResponse } from 'next/server';
import { SITEMAP_CACHE_CONTROL } from '@/app/api/sitemap/_shared/constants';

// force-dynamic + CDN 1h cache로 처리. sitemap index itself has no DB dependency,
// but dynamic keeps behavior aligned with the existing XML rewrite route.
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
    const now = new Date();

    const entries: SitemapIndexEntry[] = [
        {
            url: `${SITE_URL}/sitemap-static.xml`,
            lastModified: now,
        },
        {
            url: `${SITE_URL}/sitemap-popular.xml`,
            lastModified: now,
        },
        {
            url: `${SITE_URL}/sitemap-crypto.xml`,
            lastModified: now,
        },
    ];

    const xml = toSitemapIndexXml(entries);
    return new NextResponse(xml, {
        headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': SITEMAP_CACHE_CONTROL,
        },
    });
}
```

- [ ] **Step 4: Update longtail route tests first**

Replace `src/app/api/sitemap/__tests__/longtail.test.ts` with:

```ts
import { GET } from '@/app/api/sitemap/longtail/[page]/route';

function callGET(page: string): Promise<Response> {
    return GET(new Request(`http://localhost/api/sitemap/longtail/${page}`), {
        params: Promise.resolve({ page }),
    });
}

describe('GET /api/sitemap/longtail/[page]', () => {
    it('returns 410 Gone for a formerly valid longtail sitemap page', async () => {
        const res = await callGET('1');

        expect(res.status).toBe(410);
        await expect(res.text()).resolves.toBe('Longtail sitemap retired');
    });

    it('returns 410 Gone even for old or malformed page requests', async () => {
        await expect(callGET('2')).resolves.toHaveProperty('status', 410);
        await expect(callGET('abc')).resolves.toHaveProperty('status', 410);
        await expect(callGET('10001')).resolves.toHaveProperty('status', 410);
    });
});
```

- [ ] **Step 5: Run longtail route test to verify it fails**

Run:

```bash
yarn vitest run src/app/api/sitemap/__tests__/longtail.test.ts
```

Expected: FAIL because the route still returns 200/404/503 based on page loading.

- [ ] **Step 6: Retire the longtail route**

Replace `src/app/api/sitemap/longtail/[page]/route.ts` with:

```ts
import { NextResponse } from 'next/server';
import { SITEMAP_CACHE_CONTROL } from '@/app/api/sitemap/_shared/constants';

const LONGTAIL_SITEMAP_RETIRED_BODY = 'Longtail sitemap retired';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
    return new NextResponse(LONGTAIL_SITEMAP_RETIRED_BODY, {
        status: 410,
        headers: {
            'Cache-Control': SITEMAP_CACHE_CONTROL,
        },
    });
}
```

- [ ] **Step 7: Run sitemap tests**

Run:

```bash
yarn vitest run src/app/api/sitemap/__tests__/route.test.ts src/app/api/sitemap/__tests__/longtail.test.ts src/app/api/sitemap/__tests__/crypto.test.ts
```

Expected: PASS.

- [ ] **Step 8: Remove crypto longtail merge from crypto sitemap**

Replace `src/app/api/sitemap/crypto/route.ts` so it builds and serializes only
`buildCryptoPopularEntries(now)`. Do not query `DrizzleCryptoLongTailSource` or
call `buildLongTailEntries` in this route; those URLs are noindex by default.

- [ ] **Step 9: Update crypto sitemap tests**

Update `src/app/api/sitemap/__tests__/crypto.test.ts` to assert:

```text
GET returns 200 with XML content-type and sitemap cache headers
GET calls buildCryptoPopularEntries once
GET passes exactly those curated entries to toUrlSetXml
```

- [ ] **Step 10: Run sitemap tests again**

Run:

```bash
yarn vitest run src/app/api/sitemap/__tests__/route.test.ts src/app/api/sitemap/__tests__/longtail.test.ts src/app/api/sitemap/__tests__/crypto.test.ts
```

Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add src/app/api/sitemap/route.ts src/app/api/sitemap/longtail/[page]/route.ts src/app/api/sitemap/crypto/route.ts src/app/api/sitemap/__tests__/route.test.ts src/app/api/sitemap/__tests__/longtail.test.ts src/app/api/sitemap/__tests__/crypto.test.ts
git commit -m "fix(seo): retire longtail sitemap"
```

## Task 3: Apply Indexability Gate to Chart Metadata and Remove Chart Boilerplate SEO

**Files:**
- Modify: `src/app/[symbol]/page.tsx`
- Modify: `src/app/[symbol]/__tests__/page.test.ts`
- Modify: `src/app/[symbol]/__tests__/symbol-metadata.test.ts`

- [ ] **Step 1: Add page-level metadata tests**

In `src/app/[symbol]/__tests__/page.test.ts`, add a mock for the new module near other mocks:

```ts
vi.mock('@/entities/symbol-indexability', () => ({
    evaluateSymbolIndexability: vi.fn(() => ({
        indexable: true,
        reason: 'popular',
    })),
}));
```

Add imports:

```ts
import { evaluateSymbolIndexability } from '@/entities/symbol-indexability';
```

Add typed mock:

```ts
const mockEvaluateSymbolIndexability =
    evaluateSymbolIndexability as MockedFunction<
        typeof evaluateSymbolIndexability
    >;
```

Add tests inside `describe('generateMetadata')`:

```ts
it('returns noindex when central indexability gate blocks an unapproved longtail', async () => {
    mockGetAssetInfoResilient.mockResolvedValue({
        assetInfo: {
            symbol: '0NEUSD',
            name: 'Stone USD',
            marketProfile: 'crypto',
        },
        degraded: false,
    } as never);
    mockEvaluateSymbolIndexability.mockReturnValueOnce({
        indexable: false,
        reason: 'longtail-default-blocked',
    });

    const metadata = await generateMetadata({
        params: Promise.resolve({ symbol: '0NEUSD' }),
    });

    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(mockEvaluateSymbolIndexability).toHaveBeenCalledWith({
        symbol: '0NEUSD',
        route: 'chart',
        assetInfo: {
            symbol: '0NEUSD',
            name: 'Stone USD',
            marketProfile: 'crypto',
        },
        degraded: false,
    });
});

it('keeps indexable metadata when central gate allows a curated crypto', async () => {
    mockGetAssetInfoResilient.mockResolvedValue({
        assetInfo: {
            symbol: 'BTCUSD',
            name: 'Bitcoin USD',
            marketProfile: 'crypto',
        },
        degraded: false,
    } as never);
    mockEvaluateSymbolIndexability.mockReturnValueOnce({
        indexable: true,
        reason: 'curated-crypto',
    });

    const metadata = await generateMetadata({
        params: Promise.resolve({ symbol: 'BTCUSD' }),
    });

    expect(metadata.robots).toBeUndefined();
});
```

- [ ] **Step 2: Add boilerplate removal regression tests**

In `src/app/[symbol]/__tests__/page.test.ts`, mock `JsonLd` to expose JSON-LD in the tree:

```ts
vi.mock('@/shared/ui/JsonLd', () => ({
    JsonLd: ({ data }: { data: unknown }) => (
        <script type="application/ld+json">{JSON.stringify(data)}</script>
    ),
}));
```

Add tests under a new `describe('SymbolPage SEO boilerplate')`:

```ts
it('does not render chart FAQ JSON-LD', async () => {
    mockPeekAnalysisCache.mockResolvedValue(null);

    const tree = await SymbolPage({
        params: Promise.resolve({ symbol: 'aapl' }),
    });
    const serialized = JSON.stringify(tree);

    expect(serialized).not.toContain('"FAQPage"');
});

it('does not render hidden keyword stuffing copy in the sr-only overview', async () => {
    mockPeekAnalysisCache.mockResolvedValue(null);

    const tree = await SymbolPage({
        params: Promise.resolve({ symbol: 'aapl' }),
    });
    const serialized = JSON.stringify(tree);

    expect(serialized).not.toContain('도지나 해머');
    expect(serialized).not.toContain('볼린저밴드');
    expect(serialized).not.toContain('보조지표 13종');
});
```

- [ ] **Step 3: Run page tests to verify failures**

Run:

```bash
yarn vitest run src/app/[symbol]/__tests__/page.test.ts
```

Expected: FAIL because `page.tsx` does not import/use the gate and still renders FAQ/keyword boilerplate.

- [ ] **Step 4: Apply gate and remove FAQ JSON-LD**

In `src/app/[symbol]/page.tsx`, add:

```ts
import { evaluateSymbolIndexability } from '@/entities/symbol-indexability';
```

In `generateMetadata`, after `assetInfo` null/degraded checks and before `buildDisplayName`, add:

```ts
const decision = evaluateSymbolIndexability({
    symbol: ticker,
    route: 'chart',
    assetInfo,
    degraded,
});
if (!decision.indexable) {
    return NOINDEX_SYMBOL_METADATA;
}
```

Remove the `faqJsonLd` constant and remove this render line:

```tsx
<JsonLd data={faqJsonLd} />
```

- [ ] **Step 5: Replace hidden keyword-heavy `sr-only` copy**

In `src/app/[symbol]/page.tsx`, replace the current `sr-only` section body with:

```tsx
<section className="sr-only">
    <p>{displayName} 차트 분석 개요</p>
    <p>
        {displayName}의 가격 흐름과 기술적 지표 요약을 확인할 수 있는
        차트 페이지입니다.
    </p>
</section>
```

Keep the Suspense fallback `sr-only` h1 unchanged.

- [ ] **Step 6: Update symbol metadata regression test**

In `src/app/[symbol]/__tests__/symbol-metadata.test.ts`, add the same module mock:

```ts
vi.mock('@/entities/symbol-indexability', () => ({
    evaluateSymbolIndexability: vi.fn(() => ({
        indexable: true,
        reason: 'popular',
    })),
}));
```

Add import and mock:

```ts
import { evaluateSymbolIndexability } from '@/entities/symbol-indexability';

const mockEvaluateSymbolIndexability =
    evaluateSymbolIndexability as MockedFunction<
        typeof evaluateSymbolIndexability
    >;
```

Add a chart-only test under `[symbol] 루트 페이지 (/AAPL)`:

```ts
it('central indexability gate blocks unapproved longtail with noindex + canonical null', async () => {
    mockGetAssetInfoResilient.mockResolvedValue({
        assetInfo: { symbol: '0NEUSD', name: 'Stone USD' },
        degraded: false,
    });
    mockEvaluateSymbolIndexability.mockReturnValueOnce({
        indexable: false,
        reason: 'longtail-default-blocked',
    });

    const metadata = await generateSymbolMetadata(
        makeParamsWithSearch('0NEUSD')
    );

    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(metadata.alternates?.canonical).toBeNull();
});
```

- [ ] **Step 7: Run chart page tests**

Run:

```bash
yarn vitest run src/app/[symbol]/__tests__/page.test.ts src/app/[symbol]/__tests__/symbol-metadata.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/app/[symbol]/page.tsx src/app/[symbol]/__tests__/page.test.ts src/app/[symbol]/__tests__/symbol-metadata.test.ts
git commit -m "fix(seo): gate chart indexability"
```

## Task 4: Add Visible Data-Based Technical Narrative

**Files:**
- Modify: `src/views/symbol/utils/technicalFacts.ts`
- Modify: `src/views/symbol/__tests__/utils/technicalFacts.test.ts`
- Modify: `src/views/symbol/TechnicalFactsSummary.tsx`
- Modify: `src/views/symbol/__tests__/TechnicalFactsSummary.test.tsx`

- [ ] **Step 1: Add narrative builder tests**

In `src/views/symbol/__tests__/utils/technicalFacts.test.ts`, update import:

```ts
import {
    buildTechnicalFacts,
    buildTechnicalFactsNarrative,
} from '../../utils/technicalFacts';
```

Add tests:

```ts
describe('buildTechnicalFactsNarrative', () => {
    it('builds visible symbol-specific narrative from full facts', () => {
        const facts = {
            lastClose: 110,
            changePercent: 10,
            rsi: 62.5,
            macdHistogram: 0.5,
            high52w: 120,
            low52w: 90,
            pctFrom52wHigh: -8.3333333333,
            pctAbove52wLow: 22.2222222222,
        };

        expect(
            buildTechnicalFactsNarrative('AAPL', facts, 'us-equity')
        ).toEqual([
            'AAPL은 최근 종가 $110.00 기준으로 직전 거래일 대비 10.00% 상승했습니다.',
            'RSI 62.5로 중립 구간이며, MACD 히스토그램은 양수라 단기 모멘텀은 상승 쪽입니다.',
            '52주 고점 대비 -8.3%, 52주 저점 대비 +22.2% 위치에 있습니다.',
        ]);
    });

    it('omits RSI and MACD sentence when both values are missing', () => {
        const facts = {
            lastClose: 110,
            changePercent: -2,
            rsi: null,
            macdHistogram: null,
            high52w: 120,
            low52w: 90,
            pctFrom52wHigh: -8.3333333333,
            pctAbove52wLow: 22.2222222222,
        };

        expect(
            buildTechnicalFactsNarrative('AAPL', facts, 'us-equity')
        ).toEqual([
            'AAPL은 최근 종가 $110.00 기준으로 직전 거래일 대비 2.00% 하락했습니다.',
            '52주 고점 대비 -8.3%, 52주 저점 대비 +22.2% 위치에 있습니다.',
        ]);
    });

    it('uses crypto price precision for sub-cent assets', () => {
        const facts = {
            lastClose: 0.058158,
            changePercent: 1.5,
            rsi: null,
            macdHistogram: 0.1,
            high52w: 0.1,
            low52w: 0.01,
            pctFrom52wHigh: -41.842,
            pctAbove52wLow: 481.58,
        };

        const [first] = buildTechnicalFactsNarrative(
            'PEPEUSD',
            facts,
            'crypto'
        );

        expect(first).toContain('PEPEUSD은 최근 종가 $0.05816 기준');
        expect(first).not.toContain('$0.06 기준');
    });
});
```

- [ ] **Step 2: Run narrative tests to verify failures**

Run:

```bash
yarn vitest run src/views/symbol/__tests__/utils/technicalFacts.test.ts
```

Expected: FAIL because `buildTechnicalFactsNarrative` does not exist.

- [ ] **Step 3: Implement narrative builder**

In `src/views/symbol/utils/technicalFacts.ts`, add imports:

```ts
import { formatPrice } from '@/shared/lib/priceFormat';
import {
    getDescriptor,
    type MarketProfileId,
} from '@/shared/config/marketProfile';
```

Add helpers and export:

```ts
function directionWord(changePercent: number): string {
    if (changePercent > 0) return '상승';
    if (changePercent < 0) return '하락';
    return '보합';
}

function rsiZone(rsi: number): string {
    if (rsi >= 70) return '과매수';
    if (rsi <= 30) return '과매도';
    return '중립';
}

export function buildTechnicalFactsNarrative(
    symbol: string,
    facts: TechnicalFacts,
    marketProfile: MarketProfileId
): string[] {
    const price = formatPrice(
        facts.lastClose,
        getDescriptor(marketProfile).priceFormat
    );
    const absChange = Math.abs(facts.changePercent).toFixed(2);
    const direction = directionWord(facts.changePercent);
    const lines = [
        `${symbol}은 최근 종가 ${price} 기준으로 직전 거래일 대비 ${absChange}% ${direction}했습니다.`,
    ];

    const momentumParts: string[] = [];
    if (facts.rsi !== null) {
        momentumParts.push(`RSI ${facts.rsi.toFixed(1)}로 ${rsiZone(facts.rsi)} 구간`);
    }
    if (facts.macdHistogram !== null) {
        momentumParts.push(
            `MACD 히스토그램은 ${facts.macdHistogram >= 0 ? '양수' : '음수'}라 단기 모멘텀은 ${
                facts.macdHistogram >= 0 ? '상승' : '하락'
            } 쪽`
        );
    }
    if (momentumParts.length > 0) {
        lines.push(`${momentumParts.join('이며, ')}입니다.`);
    }

    lines.push(
        `52주 고점 대비 ${facts.pctFrom52wHigh.toFixed(1)}%, 52주 저점 대비 +${facts.pctAbove52wLow.toFixed(1)}% 위치에 있습니다.`
    );

    return lines;
}
```

- [ ] **Step 4: Add component rendering test**

In `src/views/symbol/__tests__/TechnicalFactsSummary.test.tsx`, add:

```ts
it('종목별 데이터 기반 서술 문장을 가시 콘텐츠로 렌더한다', () => {
    render(
        <TechnicalFactsSummary
            symbol="AAPL"
            bars={[bar(100, 120, 90), bar(110, 115, 100)]}
            indicators={{
                ...emptyIndicators,
                rsi: [null, 62.5],
                macd: [{ macd: 1, signal: 0.5, histogram: 0.3 }],
            }}
        />
    );

    expect(
        screen.getByText(
            'AAPL은 최근 종가 $110.00 기준으로 직전 거래일 대비 10.00% 상승했습니다.'
        )
    ).toBeInTheDocument();
    expect(
        screen.getByText(/RSI 62.5로 중립 구간/)
    ).toBeInTheDocument();
});
```

- [ ] **Step 5: Render narrative in component**

In `src/views/symbol/TechnicalFactsSummary.tsx`, update the import:

```ts
import {
    buildTechnicalFacts,
    buildTechnicalFactsNarrative,
} from './utils/technicalFacts';
```

After `const change = formatPriceChange(facts.changePercent);`, add:

```ts
const narrative = buildTechnicalFactsNarrative(
    symbol,
    facts,
    marketProfile
);
```

Render visible paragraphs after the `<dl>`:

```tsx
<div className="text-secondary-300 space-y-1 text-sm leading-6">
    {narrative.map(line => (
        <p key={line}>{line}</p>
    ))}
</div>
```

Keep the existing "위 지표는..." note after the narrative.

- [ ] **Step 6: Run technical facts tests**

Run:

```bash
yarn vitest run src/views/symbol/__tests__/utils/technicalFacts.test.ts src/views/symbol/__tests__/TechnicalFactsSummary.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/views/symbol/utils/technicalFacts.ts src/views/symbol/TechnicalFactsSummary.tsx src/views/symbol/__tests__/utils/technicalFacts.test.ts src/views/symbol/__tests__/TechnicalFactsSummary.test.tsx
git commit -m "feat(seo): add chart technical narrative"
```

## Task 5: Full Verification and Live SEO Checks

**Files:**
- No production files unless tests reveal a defect.

- [ ] **Step 1: Run focused unit and route tests**

Run:

```bash
yarn vitest run \
  src/entities/symbol-indexability/__tests__/evaluateSymbolIndexability.test.ts \
  src/app/api/sitemap/__tests__/route.test.ts \
  src/app/api/sitemap/__tests__/longtail.test.ts \
  src/app/api/sitemap/__tests__/crypto.test.ts \
  src/app/[symbol]/__tests__/page.test.ts \
  src/app/[symbol]/__tests__/symbol-metadata.test.ts \
  src/views/symbol/__tests__/utils/technicalFacts.test.ts \
  src/views/symbol/__tests__/TechnicalFactsSummary.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run lint/type checks used by the project**

Run:

```bash
yarn lint
```

Expected: PASS.

If `yarn lint` is too broad or reveals unrelated existing issues, record the unrelated failures and still run the focused test suite from Step 1.

- [ ] **Step 3: Build**

Run:

```bash
yarn build
```

Expected: PASS.

- [ ] **Step 4: Start local production server for smoke checks**

Run:

```bash
yarn start
```

Expected: server starts. Use the configured production port from the app output.

- [ ] **Step 5: Verify local sitemap and metadata behavior**

Run against the local production server:

```bash
curl -s http://localhost:3000/sitemap.xml | grep -E 'sitemap-(static|popular|crypto|longtail)'
curl -i http://localhost:3000/sitemap-longtail-1.xml
curl -s -A 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' http://localhost:3000/AAPL | rg 'robots|AAPL은 최근 종가|FAQPage|도지나 해머|볼린저밴드'
curl -s -A 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' http://localhost:3000/0NEUSD | rg 'robots|noindex'
```

Expected:

```text
sitemap-static.xml, sitemap-popular.xml, sitemap-crypto.xml appear
sitemap-longtail does not appear in /sitemap.xml
/sitemap-longtail-1.xml returns HTTP 410
/AAPL contains indexable metadata and visible technical narrative
/AAPL does not contain FAQPage
/AAPL does not contain "도지나 해머" hidden boilerplate
/0NEUSD contains noindex
```

- [ ] **Step 6: Stop local server**

Stop the `yarn start` process cleanly with `Ctrl-C`.

- [ ] **Step 7: Commit verification fixes if needed**

If Step 1-5 required fixes:

```bash
git add <changed-files>
git commit -m "test(seo): verify index quality gate"
```

If no fixes were needed, do not create an empty commit.

## Post-Deploy Operations

After deployment:

- Submit `https://siglens.io/sitemap.xml` in Search Console.
- Request indexing for:
  - `https://siglens.io/`
  - `https://siglens.io/AAPL`
  - `https://siglens.io/NVDA`
  - `https://siglens.io/TSLA`
  - `https://siglens.io/MSFT`
  - `https://siglens.io/BTCUSD`
  - `https://siglens.io/ETHUSD`
- Verify live:

```bash
curl -i https://siglens.io/sitemap-longtail-1.xml
curl -s https://siglens.io/sitemap.xml | rg 'sitemap-(static|popular|crypto|longtail)'
curl -s -A 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' https://siglens.io/AAPL | rg 'robots|AAPL은 최근 종가|FAQPage'
curl -s -A 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' https://siglens.io/0NEUSD | rg 'robots|noindex'
```

Expected:

```text
/sitemap-longtail-1.xml -> 410
/sitemap.xml -> no longtail entries
/AAPL -> indexable and has visible narrative
/0NEUSD -> noindex
```

## Plan Self-Review

- Spec coverage:
  - Central quality gate: Task 1
  - Sitemap longtail removal and 410: Task 2
  - Chart metadata noindex for unapproved longtail: Task 3
  - Hidden keyword and FAQ removal: Task 3
  - TechnicalFactsSummary narrative: Task 4
  - Verification and Search Console operations: Task 5 and Post-Deploy Operations
- Placeholder scan:
  - No placeholder markers or copy-forward instructions are present.
- Type consistency:
  - `SymbolIndexabilityInput`, `SymbolIndexabilityDecision`, and `buildTechnicalFactsNarrative` signatures match the design spec.
  - All planned imports use existing source paths verified during planning.

# Sitemap Runtime Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove runtime Yahoo/Redis work from the popular sitemap and replace full-table long-tail loads with deterministic, 2,000-ticker DB pages cached for 24 hours.

**Architecture:** A generated static options-ticker file feeds popular sitemap generation. A sitemap-owned Drizzle source exposes count/page methods over normalized symbols, and two `unstable_cache` wrappers provide independent 24-hour count and page caches. Route handlers translate DB failures to `503`, preserve existing CDN caching, and enforce the sitemap URL ceiling.

**Tech Stack:** Next.js 16 App Router route handlers, TypeScript, Drizzle ORM, Neon PostgreSQL, `unstable_cache`, Vitest, yahoo-finance2.

**Design:** `docs/superpowers/specs/2026-06-08-sitemap-performance-design.md`

**Repository rule:** Do not run `git commit` directly. After implementation and review, hand the suggested commit message to `git-agent` according to `CLAUDE.md`.

---

## File Map

### Create

- `src/entities/sitemap-entry/config/popular-options-tickers.ts`
  - Generated readonly list of popular symbols with listed options.
- `src/entities/sitemap-entry/api.ts`
  - `DrizzleLongTailTickerSource`, the sitemap-specific DB implementation.
- `src/entities/sitemap-entry/lib/countLongTailTickers.ts`
  - 24-hour cached count query.
- `src/entities/sitemap-entry/lib/loadLongTailTickerPage.ts`
  - 24-hour cached page query.
- `src/entities/sitemap-entry/__tests__/api.test.ts`
  - DB source query-chain and pagination tests.
- `src/entities/sitemap-entry/__tests__/countLongTailTickers.test.ts`
  - Count cache key, TTL, and error propagation tests.
- `src/entities/sitemap-entry/__tests__/loadLongTailTickerPage.test.ts`
  - Page cache key, page size, and error propagation tests.

### Modify

- `update-popular-tickers.ts`
  - Probe Yahoo options after the complete proposed popular list is built; render the generated options file; do not write either target before all probes succeed.
- `src/shared/db/__tests__/update-popular-tickers.test.ts`
  - Test options collection/rendering and failure behavior.
- `src/entities/sitemap-entry/model.ts`
  - Add `LongTailTickerSource`; set the page size to 2,000 independently of URL count.
- `src/entities/sitemap-entry/index.ts`
  - Remove the full-list loader export and expose only client-safe model/build exports.
- `src/entities/sitemap-entry/lib/buildPopularEntries.ts`
  - Replace runtime `hasOptionsMarket` probes with the generated static set; make generation synchronous.
- `src/entities/sitemap-entry/__tests__/buildPopularEntries.test.ts`
  - Assert exact static options-route membership and no async probe dependency.
- `src/app/api/sitemap/route.ts`
  - Use cached count; return `503` on DB/config failure.
- `src/app/api/sitemap/longtail/[page]/route.ts`
  - Load one cached DB page; enforce 50,000-entry limit; return `503` on DB/config failure.
- `src/app/api/sitemap/popular/route.ts`
  - Call synchronous popular entry generation.
- `src/app/api/sitemap/__tests__/route.test.ts`
  - Count-based pagination and `503` tests.
- `src/app/api/sitemap/__tests__/longtail.test.ts`
  - Page-loader, `404`, `503`, and URL-limit tests.
- `src/app/api/sitemap/__tests__/popular.test.ts`
  - Update mock shape for synchronous generation.

### Delete

- `src/entities/sitemap-entry/lib/loadLongTailTickers.ts`
  - Replaced by count/page DB operations.
- `src/entities/sitemap-entry/__tests__/loadLongTailTickers.test.ts`
  - Replaced by source and cache tests.

---

### Task 1: Define Long-Tail Contracts and Fixed Ticker Pagination

**Files:**
- Modify: `src/entities/sitemap-entry/model.ts`
- Modify: `src/entities/sitemap-entry/index.ts`

- [ ] **Step 1: Change the model contract and page-size constant**

Add the source interface to `model.ts` and replace the derived page size:

```ts
export interface LongTailTickerSource {
    count(): Promise<number>;
    loadPage(
        page: number,
        pageSize: number
    ): Promise<readonly string[]>;
}

export const SITEMAP_MAX_URLS_PER_FILE = 50_000;
export const LONGTAIL_ENTRIES_PER_TICKER = 5;
export const LONGTAIL_TICKERS_PER_PAGE = 2_000;
```

Update the comments to state:

- `LONGTAIL_TICKERS_PER_PAGE` is a stable ticker boundary.
- It must not be derived from `LONGTAIL_ENTRIES_PER_TICKER`.
- `SITEMAP_MAX_URLS_PER_FILE` is enforced after entry generation.

- [ ] **Step 2: Update the entity public model exports**

Export the new type from `index.ts`:

```ts
export type {
    LongTailTickerSource,
    SitemapChangeFrequency,
    SitemapEntry,
    SitemapIndexEntry,
} from './model';
```

Do not export upcoming server-only DB/cache modules from the barrel.

- [ ] **Step 3: Run the focused type and existing sitemap tests**

Run:

```bash
yarn typecheck
yarn test src/entities/sitemap-entry/__tests__/buildLongTailEntries.test.ts
```

Expected:

- Typecheck passes.
- Existing long-tail entry tests pass.

- [ ] **Step 4: Record commit checkpoint**

Suggested git-agent message:

```text
refactor(sitemap): fix longtail pagination at 2000 tickers
```

---

### Task 2: Add the Sitemap-Specific Drizzle Source

**Files:**
- Create: `src/entities/sitemap-entry/api.ts`
- Create: `src/entities/sitemap-entry/__tests__/api.test.ts`

- [ ] **Step 1: Write failing source tests**

Use Drizzle's bundled `pg-proxy` driver to execute the real query builder
against a callback and inspect the generated SQL:

```ts
import { drizzle } from 'drizzle-orm/pg-proxy';
import { POPULAR_TICKERS } from '@/shared/config/popular-tickers';
import type { SiglensDatabase } from '@/shared/db/types';
import { DrizzleLongTailTickerSource } from '../api';

function makeProxyDb(rows: unknown[][]): {
    db: SiglensDatabase;
    callback: ReturnType<typeof vi.fn>;
} {
    const callback = vi.fn().mockResolvedValue({ rows });
    return {
        db: drizzle(callback) as unknown as SiglensDatabase,
        callback,
    };
}
```

Add these cases:

```ts
describe('DrizzleLongTailTickerSource', () => {
    it('counts distinct uppercase symbols excluding popular tickers', async () => {
        const { db, callback } = makeProxyDb([[24_001]]);
        const source = new DrizzleLongTailTickerSource(db);

        await expect(source.count()).resolves.toBe(24_001);
        const [query, params] = callback.mock.calls[0];
        expect(query).toContain(
            'count(distinct upper("korean_tickers"."symbol"))'
        );
        expect(query).toContain(
            'upper("korean_tickers"."symbol") not in'
        );
        expect(params).toContain(POPULAR_TICKERS[0]);
    });

    it('returns normalized symbols from the selected page', async () => {
        const { db } = makeProxyDb([['AAA'], ['BBB']]);
        const source = new DrizzleLongTailTickerSource(db);

        await expect(source.loadPage(1, 2_000)).resolves.toEqual([
            'AAA',
            'BBB',
        ]);
    });

    it('uses distinct uppercase order with limit and page offset', async () => {
        const { db, callback } = makeProxyDb([]);
        const source = new DrizzleLongTailTickerSource(db);

        await source.loadPage(3, 2_000);

        const [query, params] = callback.mock.calls[0];
        expect(query).toContain(
            'select distinct upper("korean_tickers"."symbol")'
        );
        expect(query).toContain(
            'order by upper("korean_tickers"."symbol") asc'
        );
        expect(params.slice(-2)).toEqual([2_000, 4_000]);
    });
});
```

- [ ] **Step 2: Run the source tests and verify failure**

Run:

```bash
yarn test src/entities/sitemap-entry/__tests__/api.test.ts
```

Expected: FAIL because `src/entities/sitemap-entry/api.ts` does not exist.

- [ ] **Step 3: Implement the Drizzle source**

Create `api.ts`:

```ts
import 'server-only';
import {
    asc,
    countDistinct,
    notInArray,
    sql,
} from 'drizzle-orm';
import { POPULAR_TICKERS } from '@/shared/config/popular-tickers';
import { koreanTickers } from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import type { LongTailTickerSource } from './model';

const normalizedSymbol = sql<string>`upper(${koreanTickers.symbol})`;
const isLongTailTicker = notInArray(normalizedSymbol, [...POPULAR_TICKERS]);

export class DrizzleLongTailTickerSource
    implements LongTailTickerSource
{
    constructor(private readonly db: SiglensDatabase) {}

    async count(): Promise<number> {
        const [row] = await this.db
            .select({ total: countDistinct(normalizedSymbol) })
            .from(koreanTickers)
            .where(isLongTailTicker);

        return row?.total ?? 0;
    }

    async loadPage(
        page: number,
        pageSize: number
    ): Promise<readonly string[]> {
        const rows = await this.db
            .selectDistinct({ symbol: normalizedSymbol })
            .from(koreanTickers)
            .where(isLongTailTicker)
            .orderBy(asc(normalizedSymbol))
            .limit(pageSize)
            .offset((page - 1) * pageSize);

        return rows.map(row => row.symbol);
    }
}
```

The query itself owns:

- uppercase normalization,
- case-insensitive deduplication,
- popular exclusion,
- stable symbol ordering.

- [ ] **Step 4: Run tests and typecheck**

Run:

```bash
yarn test src/entities/sitemap-entry/__tests__/api.test.ts
yarn typecheck
```

Expected: PASS.

- [ ] **Step 5: Record commit checkpoint**

Suggested git-agent message:

```text
feat(sitemap): add paged longtail ticker source
```

---

### Task 3: Add Independent 24-Hour Count and Page Caches

**Files:**
- Create: `src/entities/sitemap-entry/lib/countLongTailTickers.ts`
- Create: `src/entities/sitemap-entry/lib/loadLongTailTickerPage.ts`
- Create: `src/entities/sitemap-entry/__tests__/countLongTailTickers.test.ts`
- Create: `src/entities/sitemap-entry/__tests__/loadLongTailTickerPage.test.ts`

- [ ] **Step 1: Write the failing count-cache test**

Mock `unstable_cache`, the DB client, and source:

```ts
const { unstableCacheMock, sourceCountMock } = vi.hoisted(() => ({
    unstableCacheMock: vi.fn(
        (fn: () => Promise<unknown>) => fn
    ),
    sourceCountMock: vi.fn(),
}));

vi.mock('next/cache', () => ({
    unstable_cache: unstableCacheMock,
}));

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {} })),
}));

vi.mock('../api', () => ({
    DrizzleLongTailTickerSource: vi.fn(() => ({
        count: sourceCountMock,
    })),
}));

import { SECONDS_PER_DAY } from '@/shared/config/time';
import { countLongTailTickers } from '../lib/countLongTailTickers';
```

Assert:

```ts
it('uses the v1 count key and 24-hour revalidation', async () => {
    sourceCountMock.mockResolvedValue(12_345);

    await expect(countLongTailTickers()).resolves.toBe(12_345);
    expect(unstableCacheMock).toHaveBeenLastCalledWith(
        expect.any(Function),
        ['sitemap:longtail:count:v1'],
        { revalidate: SECONDS_PER_DAY }
    );
});

it('propagates DB/source failures', async () => {
    sourceCountMock.mockRejectedValue(new Error('db down'));
    await expect(countLongTailTickers()).rejects.toThrow('db down');
});
```

- [ ] **Step 2: Write the failing page-cache test**

Use the same cache mock pattern with a `sourceLoadPageMock`, then assert:

```ts
it('separates cache entries by page and uses a 24-hour TTL', async () => {
    sourceLoadPageMock.mockResolvedValue(['AAA']);

    await loadLongTailTickerPage(3);

    expect(unstableCacheMock).toHaveBeenLastCalledWith(
        expect.any(Function),
        ['sitemap:longtail:page:v1:3'],
        { revalidate: SECONDS_PER_DAY }
    );
    expect(sourceLoadPageMock).toHaveBeenCalledWith(
        3,
        LONGTAIL_TICKERS_PER_PAGE
    );
});

it('propagates DB/source failures', async () => {
    sourceLoadPageMock.mockRejectedValue(new Error('db down'));
    await expect(loadLongTailTickerPage(1)).rejects.toThrow('db down');
});
```

- [ ] **Step 3: Run both cache tests and verify failure**

Run:

```bash
yarn test \
  src/entities/sitemap-entry/__tests__/countLongTailTickers.test.ts \
  src/entities/sitemap-entry/__tests__/loadLongTailTickerPage.test.ts
```

Expected: FAIL because the cache modules do not exist.

- [ ] **Step 4: Implement the count cache**

Create `countLongTailTickers.ts`:

```ts
import 'server-only';
import { unstable_cache } from 'next/cache';
import { getDatabaseClient } from '@/shared/db/client';
import { SECONDS_PER_DAY } from '@/shared/config/time';
import { DrizzleLongTailTickerSource } from '../api';

export function countLongTailTickers(): Promise<number> {
    return unstable_cache(
        () => {
            const client = getDatabaseClient();
            return new DrizzleLongTailTickerSource(client.db).count();
        },
        ['sitemap:longtail:count:v1'],
        { revalidate: SECONDS_PER_DAY }
    )();
}
```

Use `getDatabaseClient`, not `tryGetDatabaseClient`, so a missing DB config is
an error and reaches the route's `503` path.

- [ ] **Step 5: Implement the page cache**

Create `loadLongTailTickerPage.ts`:

```ts
import 'server-only';
import { unstable_cache } from 'next/cache';
import { getDatabaseClient } from '@/shared/db/client';
import { SECONDS_PER_DAY } from '@/shared/config/time';
import { DrizzleLongTailTickerSource } from '../api';
import { LONGTAIL_TICKERS_PER_PAGE } from '../model';

export function loadLongTailTickerPage(
    page: number
): Promise<readonly string[]> {
    return unstable_cache(
        () => {
            const client = getDatabaseClient();
            return new DrizzleLongTailTickerSource(client.db).loadPage(
                page,
                LONGTAIL_TICKERS_PER_PAGE
            );
        },
        [`sitemap:longtail:page:v1:${page}`],
        { revalidate: SECONDS_PER_DAY }
    )();
}
```

- [ ] **Step 6: Keep server-only cache functions out of the barrel**

Do not export either cache function from `index.ts`. App route handlers import
the server-only modules directly.

- [ ] **Step 7: Run focused tests and typecheck**

Run:

```bash
yarn test \
  src/entities/sitemap-entry/__tests__/api.test.ts \
  src/entities/sitemap-entry/__tests__/countLongTailTickers.test.ts \
  src/entities/sitemap-entry/__tests__/loadLongTailTickerPage.test.ts
yarn typecheck
```

Expected: cache/source tests and repository typecheck pass. The existing
full-list loader remains temporarily until Task 5 switches its final consumer.

- [ ] **Step 8: Record commit checkpoint**

Suggested git-agent message:

```text
feat(sitemap): cache longtail count and pages
```

---

### Task 4: Convert the Sitemap Index to Count-Only Loading

**Files:**
- Modify: `src/app/api/sitemap/route.ts`
- Modify: `src/app/api/sitemap/__tests__/route.test.ts`

- [ ] **Step 1: Replace route mocks with the count loader**

Mock the deep server-only module separately from the client-safe barrel:

```ts
vi.mock(
    '@/entities/sitemap-entry/lib/countLongTailTickers',
    () => ({
        countLongTailTickers: vi.fn(),
    })
);

vi.mock('@/entities/sitemap-entry', () => ({
    LONGTAIL_TICKERS_PER_PAGE: 2_000,
    toSitemapIndexXml: vi
        .fn()
        .mockReturnValue('<?xml version="1.0"?><sitemapindex/>'),
}));
```

Add tests:

```ts
it('uses count-only pagination at 2,000 tickers per page', async () => {
    mockCountLongTailTickers.mockResolvedValue(4_001);

    await GET();

    const entries = mockToSitemapIndexXml.mock.calls[0][0];
    expect(entries).toHaveLength(5);
    expect(mockCountLongTailTickers).toHaveBeenCalledTimes(1);
});

it('returns 503 with Retry-After when the count query fails', async () => {
    mockCountLongTailTickers.mockRejectedValue(new Error('db down'));

    const response = await GET();

    expect(response.status).toBe(503);
    expect(response.headers.get('Retry-After')).toBe('300');
    expect(mockToSitemapIndexXml).not.toHaveBeenCalled();
});
```

Keep the existing content-type and CDN cache assertions for successful
responses.

- [ ] **Step 2: Run the index route tests and verify failure**

Run:

```bash
yarn test src/app/api/sitemap/__tests__/route.test.ts
```

Expected: FAIL because the route still imports and loads the full ticker list.

- [ ] **Step 3: Implement count-only index generation**

Update imports:

```ts
import {
    LONGTAIL_TICKERS_PER_PAGE,
    type SitemapIndexEntry,
    toSitemapIndexXml,
} from '@/entities/sitemap-entry';
import { countLongTailTickers } from '@/entities/sitemap-entry/lib/countLongTailTickers';
```

Wrap only the dynamic data load:

```ts
export async function GET(): Promise<Response> {
    const now = new Date();

    let longTailTickerCount: number;
    try {
        longTailTickerCount = await countLongTailTickers();
    } catch (error) {
        console.error('[sitemap] failed to count long-tail tickers:', error);
        return new NextResponse('Sitemap data temporarily unavailable', {
            status: 503,
            headers: { 'Retry-After': '300' },
        });
    }

    const longTailPages = Math.ceil(
        longTailTickerCount / LONGTAIL_TICKERS_PER_PAGE
    );

    // Keep the existing index-entry construction and successful response headers.
}
```

Remove comments claiming DB failure produces an empty index.

- [ ] **Step 4: Run the index route tests**

Run:

```bash
yarn test src/app/api/sitemap/__tests__/route.test.ts
```

Expected: PASS.

- [ ] **Step 5: Record commit checkpoint**

Suggested git-agent message:

```text
refactor(sitemap): build index from cached ticker count
```

---

### Task 5: Convert Long-Tail Routes to Cached DB Pages

**Files:**
- Modify: `src/app/api/sitemap/longtail/[page]/route.ts`
- Modify: `src/app/api/sitemap/__tests__/longtail.test.ts`
- Modify: `src/entities/sitemap-entry/index.ts`
- Delete: `src/entities/sitemap-entry/lib/loadLongTailTickers.ts`
- Delete: `src/entities/sitemap-entry/__tests__/loadLongTailTickers.test.ts`

- [ ] **Step 1: Replace the full-list mock with the page loader**

Mock:

```ts
vi.mock(
    '@/entities/sitemap-entry/lib/loadLongTailTickerPage',
    () => ({
        loadLongTailTickerPage: vi.fn(),
    })
);

vi.mock('@/entities/sitemap-entry', () => ({
    SITEMAP_MAX_URLS_PER_FILE: 50_000,
    buildLongTailEntries: vi.fn(),
    toUrlSetXml: vi.fn().mockReturnValue('<?xml version="1.0"?><urlset/>'),
}));
```

Update valid-page assertions:

```ts
it('loads only the requested ticker page', async () => {
    mockLoadLongTailTickerPage.mockResolvedValue(['DDD', 'EEE']);

    await callGET('2');

    expect(mockLoadLongTailTickerPage).toHaveBeenCalledWith(2);
    expect(mockBuildLongTailEntries).toHaveBeenCalledWith(
        ['DDD', 'EEE'],
        new Date('2025-01-01')
    );
});
```

Add failure and invariant tests:

```ts
it('returns 503 with Retry-After when page loading fails', async () => {
    mockLoadLongTailTickerPage.mockRejectedValue(new Error('db down'));

    const response = await callGET('1');

    expect(response.status).toBe(503);
    expect(response.headers.get('Retry-After')).toBe('300');
    expect(mockBuildLongTailEntries).not.toHaveBeenCalled();
});

it('returns 500 instead of partial XML above the sitemap URL limit', async () => {
    mockLoadLongTailTickerPage.mockResolvedValue(['AAA']);
    mockBuildLongTailEntries.mockReturnValue(
        Array.from({ length: 50_001 }, (_, i) => ({
            url: `https://siglens.io/T${i}`,
            lastModified: new Date('2025-01-01'),
            changeFrequency: 'weekly' as const,
            priority: 0.5,
        }))
    );

    const response = await callGET('1');

    expect(response.status).toBe(500);
    expect(mockToUrlSetXml).not.toHaveBeenCalled();
});
```

Keep tests for invalid page strings and empty page results returning `404`.

- [ ] **Step 2: Run the long-tail route tests and verify failure**

Run:

```bash
yarn test src/app/api/sitemap/__tests__/longtail.test.ts
```

Expected: FAIL because the route still loads all tickers and slices in memory.

- [ ] **Step 3: Implement page-only loading and error translation**

Update imports:

```ts
import {
    buildLongTailEntries,
    SITEMAP_MAX_URLS_PER_FILE,
    toUrlSetXml,
} from '@/entities/sitemap-entry';
import { loadLongTailTickerPage } from '@/entities/sitemap-entry/lib/loadLongTailTickerPage';
```

Replace the full-list load:

```ts
let tickers: readonly string[];
try {
    tickers = await loadLongTailTickerPage(pageNum);
} catch (error) {
    console.error(
        `[sitemap] failed to load long-tail page ${pageNum}:`,
        error
    );
    return new NextResponse('Sitemap data temporarily unavailable', {
        status: 503,
        headers: { 'Retry-After': '300' },
    });
}

if (tickers.length === 0) {
    return new NextResponse('Page out of range', { status: 404 });
}

const entries = buildLongTailEntries(tickers, SITE_BUILD_DATE);
if (entries.length > SITEMAP_MAX_URLS_PER_FILE) {
    console.error(
        `[sitemap] long-tail page ${pageNum} exceeded URL limit: ${entries.length}`
    );
    return new NextResponse('Sitemap URL limit exceeded', { status: 500 });
}
```

Keep successful XML and CDN headers unchanged.

- [ ] **Step 4: Run route tests and typecheck**

Before verification, delete:

```text
src/entities/sitemap-entry/lib/loadLongTailTickers.ts
src/entities/sitemap-entry/__tests__/loadLongTailTickers.test.ts
```

Remove this barrel export:

```ts
export { loadLongTailTickers } from './lib/loadLongTailTickers';
```

Run:

```bash
yarn test src/app/api/sitemap/__tests__/longtail.test.ts
yarn typecheck
```

Expected: PASS, including removal of all `loadLongTailTickers` references.

- [ ] **Step 5: Record commit checkpoint**

Suggested git-agent message:

```text
refactor(sitemap): load cached longtail ticker pages
```

---

### Task 6: Generate and Consume a Static Popular Options List

**Files:**
- Modify: `update-popular-tickers.ts`
- Modify: `src/shared/db/__tests__/update-popular-tickers.test.ts`
- Create: `src/entities/sitemap-entry/config/popular-options-tickers.ts`
- Modify: `src/entities/sitemap-entry/lib/buildPopularEntries.ts`
- Modify: `src/entities/sitemap-entry/__tests__/buildPopularEntries.test.ts`
- Modify: `src/app/api/sitemap/popular/route.ts`
- Modify: `src/app/api/sitemap/__tests__/popular.test.ts`

- [ ] **Step 1: Add failing pure-helper tests for option collection**

Export these contracts from the script:

```ts
export type OptionsMarketProbe = (symbol: string) => Promise<boolean>;

export interface PopularTickerArtifactWriters {
    writePopular(content: string): void;
    writeOptions(content: string): void;
}

export async function collectPopularOptionsTickers(
    tickers: readonly string[],
    probe: OptionsMarketProbe
): Promise<readonly string[]>;

export function renderPopularOptionsTickersFile(
    tickers: readonly string[]
): string;

export async function writePopularTickerArtifacts(
    popularContent: string,
    tickers: readonly string[],
    probe: OptionsMarketProbe,
    writers: PopularTickerArtifactWriters
): Promise<void>;
```

Add tests:

```ts
describe('collectPopularOptionsTickers', () => {
    it('returns uppercase, deduplicated, sorted option tickers', async () => {
        const probe = vi.fn(async (symbol: string) =>
            ['MSFT', 'AAPL'].includes(symbol)
        );

        await expect(
            collectPopularOptionsTickers(
                ['msft', 'AAPL', 'MSFT', 'NOOPT'],
                probe
            )
        ).resolves.toEqual(['AAPL', 'MSFT']);
    });

    it('treats a resolved false as a valid no-options result', async () => {
        const probe = vi.fn().mockResolvedValue(false);
        await expect(
            collectPopularOptionsTickers(['NOOPT'], probe)
        ).resolves.toEqual([]);
    });

    it('rejects the whole refresh when one probe fails', async () => {
        const probe = vi.fn(async (symbol: string) => {
            if (symbol === 'FAIL') throw new Error('Yahoo unavailable');
            return true;
        });

        await expect(
            collectPopularOptionsTickers(['AAPL', 'FAIL'], probe)
        ).rejects.toThrow('Yahoo unavailable');
    });
});

describe('renderPopularOptionsTickersFile', () => {
    it('renders a generated readonly literal array', () => {
        expect(renderPopularOptionsTickersFile(['AAPL', 'MSFT'])).toBe(
            `// Generated by update-popular-tickers.ts. Do not edit manually.
export const POPULAR_OPTIONS_TICKERS = [
    'AAPL',
    'MSFT',
] as const;
`
        );
    });
});

describe('writePopularTickerArtifacts', () => {
    it('does not invoke either writer when any Yahoo probe fails', async () => {
        const writers = {
            writePopular: vi.fn(),
            writeOptions: vi.fn(),
        };
        const probe = vi
            .fn()
            .mockRejectedValue(new Error('Yahoo unavailable'));

        await expect(
            writePopularTickerArtifacts(
                'popular content',
                ['AAPL'],
                probe,
                writers
            )
        ).rejects.toThrow('Yahoo unavailable');

        expect(writers.writePopular).not.toHaveBeenCalled();
        expect(writers.writeOptions).not.toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: Run script-helper tests and verify failure**

Run:

```bash
yarn test src/shared/db/__tests__/update-popular-tickers.test.ts
```

Expected: FAIL because the helper exports do not exist.

- [ ] **Step 3: Implement bounded Yahoo probing helpers**

Add:

```ts
import YahooFinance from 'yahoo-finance2';

const OPTIONS_PROBE_CONCURRENCY = 5;
const POPULAR_OPTIONS_TICKERS_PATH = resolve(
    process.cwd(),
    'src/entities/sitemap-entry/config/popular-options-tickers.ts'
);

export type OptionsMarketProbe = (
    symbol: string
) => Promise<boolean>;

export interface PopularTickerArtifactWriters {
    writePopular(content: string): void;
    writeOptions(content: string): void;
}

export async function collectPopularOptionsTickers(
    tickers: readonly string[],
    probe: OptionsMarketProbe
): Promise<readonly string[]> {
    const normalized = [
        ...new Set(tickers.map(ticker => ticker.toUpperCase())),
    ].toSorted();
    const chunks = Array.from(
        {
            length: Math.ceil(
                normalized.length / OPTIONS_PROBE_CONCURRENCY
            ),
        },
        (_, index) =>
            normalized.slice(
                index * OPTIONS_PROBE_CONCURRENCY,
                (index + 1) * OPTIONS_PROBE_CONCURRENCY
            )
    );

    return chunks.reduce(
        async (resultPromise, chunk) => {
            const result = await resultPromise;
            const availability = await Promise.all(
                chunk.map(symbol => probe(symbol))
            );
            const availableSymbols = chunk.filter(
                (_, index) => availability[index]
            );
            return [...result, ...availableSymbols];
        },
        Promise.resolve([] as string[])
    );
}

export function renderPopularOptionsTickersFile(
    tickers: readonly string[]
): string {
    const lines = tickers.map(ticker => `    '${ticker}',`).join('\n');
    return `// Generated by update-popular-tickers.ts. Do not edit manually.
export const POPULAR_OPTIONS_TICKERS = [
${lines}
] as const;
`;
}

export async function writePopularTickerArtifacts(
    popularContent: string,
    tickers: readonly string[],
    probe: OptionsMarketProbe,
    writers: PopularTickerArtifactWriters
): Promise<void> {
    const optionsTickers = await collectPopularOptionsTickers(
        tickers,
        probe
    );
    const optionsContent =
        renderPopularOptionsTickersFile(optionsTickers);

    writers.writePopular(popularContent);
    writers.writeOptions(optionsContent);
}
```

The production probe must not reuse `hasOptionsMarket`, because that function
converts Yahoo errors to `false`. Add a strict script-only probe:

```ts
function createYahooOptionsProbe(): OptionsMarketProbe {
    const yahooFinance = new YahooFinance({
        suppressNotices: ['yahooSurvey'],
    });

    return async (symbol: string): Promise<boolean> => {
        const response = await yahooFinance.options(symbol);
        if (!Array.isArray(response.expirationDates)) {
            throw new Error(
                `Yahoo options response missing expirationDates for ${symbol}`
            );
        }
        return response.expirationDates.length > 0;
    };
}
```

- [ ] **Step 4: Restructure `main` so probing finishes before writes**

Refactor `main` into this order:

1. Read and deduplicate the existing popular file in memory.
2. Fetch/rank candidates when candidates exist.
3. Build `updatedPopularContent` in memory, even when no new ticker is added.
4. Re-extract the final popular symbols from `updatedPopularContent`.
5. Call `writePopularTickerArtifacts(...)` with strict Yahoo probing and two
   filesystem writer closures.
6. The helper completes every probe before invoking either writer.

Use a common formatter:

```ts
function writeAndFormatFile(path: string, content: string): void {
    writeFileSync(path, content, 'utf-8');
    execSync(`yarn prettier --write "${path}"`, {
        stdio: 'inherit',
    });
}
```

Wire the helper as:

```ts
await writePopularTickerArtifacts(
    updatedPopularContent,
    [...extractExistingTickers(updatedPopularContent)],
    createYahooOptionsProbe(),
    {
        writePopular: content =>
            writeAndFormatFile(POPULAR_TICKERS_PATH, content),
        writeOptions: content =>
            writeAndFormatFile(
                POPULAR_OPTIONS_TICKERS_PATH,
                content
            ),
    }
);
```

There must be no early return before this call. A Yahoo rejection must reach
the existing top-level `main().catch(...)` before either writer runs.

- [ ] **Step 5: Run helper tests**

Run:

```bash
yarn test src/shared/db/__tests__/update-popular-tickers.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run the updater once to create the generated file**

Run:

```bash
yarn update-popular-tickers
```

Expected:

- FMP update phase completes or reports no new candidates.
- Every final popular ticker receives a strict Yahoo options probe.
- `src/entities/sitemap-entry/config/popular-options-tickers.ts` is created.
- Any Yahoo failure exits non-zero and leaves both target files unchanged.

Review both generated diffs before continuing. Do not hand-edit the generated
options list.

- [ ] **Step 7: Replace runtime probes in `buildPopularEntries`**

Remove:

```ts
import { hasOptionsMarket } from '@/entities/options-chain/lib/optionsDataCache';
```

Remove `OPTIONS_PROBE_CONCURRENCY`, `sliceIntoChunks`, and
`probeOptionsMarket`.

Add:

```ts
import { POPULAR_OPTIONS_TICKERS } from '../config/popular-options-tickers';

const POPULAR_OPTIONS_SET = new Set<string>(POPULAR_OPTIONS_TICKERS);
```

Make entry generation synchronous:

```ts
export function buildPopularEntries(now: Date): SitemapEntry[] {
    const todayClose = computeTodayAtMarketClose(now);
    const oneHourAgo = new Date(now.getTime() - MS_PER_HOUR);

    return POPULAR_TICKERS.flatMap((ticker): SitemapEntry[] => [
        {
            url: `${SITE_URL}/${ticker}`,
            lastModified: todayClose,
            changeFrequency: 'daily',
            priority: 0.8,
        },
        {
            url: `${SITE_URL}/${ticker}/news`,
            lastModified: oneHourAgo,
            changeFrequency: 'hourly',
            priority: 0.78,
        },
        {
            url: `${SITE_URL}/${ticker}/fundamental`,
            lastModified: todayClose,
            changeFrequency: 'weekly',
            priority: 0.75,
        },
        ...(POPULAR_OPTIONS_SET.has(ticker)
            ? [
                  {
                      url: `${SITE_URL}/${ticker}/options`,
                      lastModified: todayClose,
                      changeFrequency: 'daily' as const,
                      priority: 0.75,
                  },
              ]
            : []),
        {
            url: `${SITE_URL}/${ticker}/overall`,
            lastModified: todayClose,
            changeFrequency: 'weekly',
            priority: 0.85,
        },
        {
            url: `${SITE_URL}/${ticker}/fear-greed`,
            lastModified: todayClose,
            changeFrequency: 'daily',
            priority: 0.78,
        },
    ]);
}
```

- [ ] **Step 8: Replace popular builder tests**

Remove all `hasOptionsMarket` mocks. Assert exact static membership:

```ts
import { POPULAR_OPTIONS_TICKERS } from '../config/popular-options-tickers';

it('adds options URLs exactly for the generated static options list', () => {
    const entries = buildPopularEntries(NOW);
    const optionsSymbols = entries
        .filter(entry => entry.url.endsWith('/options'))
        .map(entry => entry.url.split('/')[3])
        .toSorted();

    expect(optionsSymbols).toEqual([...POPULAR_OPTIONS_TICKERS]);
});

it('returns synchronously without a Promise', () => {
    expect(buildPopularEntries(NOW)).toBeInstanceOf(Array);
});
```

Keep lastmod, frequency, and priority tests, removing `await`.

- [ ] **Step 9: Make the popular route synchronous**

Change:

```ts
const xml = toUrlSetXml(buildPopularEntries(new Date()));
```

Update the route mock from:

```ts
buildPopularEntries: vi.fn().mockResolvedValue([])
```

to:

```ts
buildPopularEntries: vi.fn().mockReturnValue([])
```

For tests that provide entries, use:

```ts
mockBuildPopularEntries.mockReturnValue(entries);
```

- [ ] **Step 10: Run popular and script tests**

Run:

```bash
yarn test \
  src/shared/db/__tests__/update-popular-tickers.test.ts \
  src/entities/sitemap-entry/__tests__/buildPopularEntries.test.ts \
  src/app/api/sitemap/__tests__/popular.test.ts
yarn typecheck
```

Expected: PASS. No production sitemap module imports
`optionsDataCache`.

- [ ] **Step 11: Record commit checkpoint**

Suggested git-agent message:

```text
refactor(sitemap): generate popular options statically
```

---

### Task 7: Full Verification and Operational Checks

**Files:**
- Modify only files required by failures found in this task.

- [ ] **Step 1: Confirm old full-list and runtime-probe paths are gone**

Run:

```bash
rg -n "loadLongTailTickers|hasOptionsMarket" \
  src/app/api/sitemap \
  src/entities/sitemap-entry
```

Expected:

- No `loadLongTailTickers` matches.
- No `hasOptionsMarket` matches under sitemap code.

- [ ] **Step 2: Run the complete sitemap test group**

Run:

```bash
yarn test \
  src/entities/sitemap-entry/__tests__ \
  src/app/api/sitemap/__tests__ \
  src/shared/db/__tests__/update-popular-tickers.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run static validation**

Run:

```bash
yarn typecheck
yarn lint
yarn format:check
```

Expected: PASS.

- [ ] **Step 4: Run production build**

Run:

```bash
yarn build
```

Expected: build succeeds and sitemap route handlers compile.

- [ ] **Step 5: Run the SEO smoke test when the local E2E stack is available**

Run:

```bash
yarn test:e2e e2e/specs/seo-smoke.spec.ts
```

Expected:

- `/sitemap.xml` and sub-sitemaps return the expected XML content type.
- Long-tail sitemap may return `404` only when the E2E DB contains no ticker
  data, matching existing test policy.

If the E2E stack is unavailable, record that limitation in the final report.

- [ ] **Step 6: Inspect generated file and diff**

Run:

```bash
git diff --check
git status --short
git diff --stat
```

Expected:

- No whitespace errors.
- The generated options file is tracked.
- No unrelated worktree changes are present.

- [ ] **Step 7: Route through the required agents**

Follow `CLAUDE.md` exactly:

1. Invoke `review-agent`.
2. Fix required and recommended findings, then re-review if needed.
3. Invoke `mistake-managing-agent`.
4. Invoke `git-agent` with the final approved diff.

Suggested final commit message:

```text
perf(sitemap): remove runtime fetches and page longtail queries
```

---

## Acceptance Checklist

- [ ] Popular sitemap generation imports only static ticker lists.
- [ ] The weekly script fails the entire options refresh on any Yahoo error.
- [ ] No target file is written before all Yahoo probes succeed.
- [ ] Index generation performs only a cached count query.
- [ ] Long-tail generation performs only one cached 2,000-symbol page query.
- [ ] Count and pages use independent 24-hour cache keys.
- [ ] DB/config failures return `503` with `Retry-After: 300`.
- [ ] Invalid and empty pages return `404`.
- [ ] More than 50,000 generated URLs returns `500`, never partial XML.
- [ ] Successful sitemap responses retain the existing one-hour CDN header.
- [ ] Sitemap unit tests, typecheck, lint, format check, and build pass.

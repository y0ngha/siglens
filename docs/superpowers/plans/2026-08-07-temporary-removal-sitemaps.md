# Temporary Removal Sitemaps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy five protected, DB-reconstructed removal sitemap endpoints so each can be submitted to Google Search Console on the approved two-day schedule without another code deployment.

**Architecture:** A server-only Drizzle adapter reconstructs the historical candidate sets with immutable cutoffs. Pure functions build minimal XML, and one validated route exposes all five kinds. All endpoints ship in one PR because Search Console submission, not endpoint availability, activates each stage.

**Tech Stack:** Next.js 16, TypeScript, Drizzle ORM, Neon PostgreSQL, `unstable_cache`, Vitest.

---

## File map

| File | Responsibility |
| --- | --- |
| `src/entities/sitemap-entry/model.ts` | Removal kinds, source interface, entries, limits, and cutoffs |
| `src/entities/sitemap-entry/api.ts` | Server-only historical candidate queries |
| `src/entities/sitemap-entry/server.ts` | Protected-set assembly and frozen cached loading |
| `src/entities/sitemap-entry/lib/buildRemovalEntries.ts` | Pure dedupe, ordering, and route mapping |
| `src/entities/sitemap-entry/lib/removalXml.ts` | Minimal removal XML serialization |
| `src/app/api/sitemap/removal/[kind]/route.ts` | Validated HTTP response and failure handling |
| `next.config.ts` | Root-level removal sitemap rewrite |
| `docs/qa/2026-08-07-temporary-removal-sitemaps-runbook.md` | GSC submission and cleanup runbook |

## PR strategy

Use one implementation PR for all five endpoints. Do not add them to
`/sitemap.xml` or `robots.txt`. The endpoints remain inert until manually
submitted in GSC, so Day 0, 2, 4, 6, and 8 remain independent without five
overlapping PRs or deployments.

### Task 1: Define removal contracts

**Files:**
- Modify: `src/entities/sitemap-entry/model.ts`
- Modify: `src/entities/sitemap-entry/index.ts`
- Create: `src/entities/sitemap-entry/__tests__/removalModel.test.ts`

- [ ] **Step 1: Write the failing contract test**

```typescript
import {
    isRemovalSitemapKind,
    REMOVAL_SITEMAP_KINDS,
} from '@/entities/sitemap-entry';

describe('removal sitemap contracts', () => {
    it.each(REMOVAL_SITEMAP_KINDS)('accepts %s', kind => {
        expect(isRemovalSitemapKind(kind)).toBe(true);
    });

    it.each(['', 'popular', 'unknown', 'chart.xml'])('rejects %s', value => {
        expect(isRemovalSitemapKind(value)).toBe(false);
    });
});
```

- [ ] **Step 2: Verify the test fails**

Run: `yarn test src/entities/sitemap-entry/__tests__/removalModel.test.ts`

Expected: FAIL because the contracts are absent.

- [ ] **Step 3: Add the contracts to `model.ts`**

```typescript
export const REMOVAL_SITEMAP_KINDS = [
    'chart',
    'news',
    'overall',
    'fundamental',
    'fear-greed',
] as const;

export type RemovalSitemapKind =
    (typeof REMOVAL_SITEMAP_KINDS)[number];

export interface RemovalSitemapEntry {
    url: string;
    lastModified: Date;
}

export interface RemovalSitemapCandidateSource {
    loadStockSymbolsBefore(
        cutoff: Date,
        excludedSymbols: readonly string[]
    ): Promise<readonly string[]>;
    loadHistoricalCryptoSymbols(
        limit: number,
        excludedSymbols: readonly string[]
    ): Promise<readonly string[]>;
}

export const REMOVAL_CHART_CUTOFF_ISO =
    '2026-07-07T16:25:18.000Z';
export const REMOVAL_LEGACY_TAB_CUTOFF_ISO =
    '2026-06-15T08:36:58.000Z';
export const REMOVAL_LAST_MODIFIED_ISO =
    '2026-07-08T00:00:00.000Z';
export const REMOVAL_CRYPTO_LIMIT = 1_000;

export function isRemovalSitemapKind(
    value: string
): value is RemovalSitemapKind {
    return REMOVAL_SITEMAP_KINDS.some(kind => kind === value);
}
```

Export the new client-safe types and values from `index.ts`. Do not export a
DB-backed module from that barrel.

- [ ] **Step 4: Run the test and typecheck**

```bash
yarn test src/entities/sitemap-entry/__tests__/removalModel.test.ts
yarn typecheck:tsc
```

Expected: PASS.

- [ ] **Step 5: Commit through git-agent**

Commit message: `feat(sitemap): define removal sitemap contracts`

### Task 2: Implement historical candidate queries

**Files:**
- Create: `src/entities/sitemap-entry/api.ts`
- Create: `src/entities/sitemap-entry/__tests__/removalApi.test.ts`

- [ ] **Step 1: Write captured-SQL tests**

Reuse the `drizzle-orm/pg-proxy` callback pattern from the historical
`DrizzleLongTailTickerSource` tests. Assert that the stock query contains the
supplied `updated_at < cutoff`, complete `NOT IN` exclusions, and `symbol ASC`.
Assert that crypto uses `circulating_supply DESC NULLS LAST`, `symbol ASC`, the
complete exclusions, and the supplied limit.

```typescript
await expect(
    source.loadStockSymbolsBefore(
        new Date('2026-06-15T08:36:58.000Z'),
        ['AAPL', 'BTCUSD']
    )
).resolves.toEqual(['AAA', 'BBB']);

await expect(
    source.loadHistoricalCryptoSymbols(1_000, ['BTCUSD'])
).resolves.toEqual(['ETHUSD', 'SOLUSD']);
```

- [ ] **Step 2: Verify the tests fail**

Run: `yarn test src/entities/sitemap-entry/__tests__/removalApi.test.ts`

Expected: FAIL because the adapter is absent.

- [ ] **Step 3: Implement `api.ts`**

```typescript
import 'server-only';

import { cryptoAssets, koreanTickers } from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import { and, asc, lt, notInArray, sql } from 'drizzle-orm';
import type { RemovalSitemapCandidateSource } from './model';

const cryptoSupplyOrder =
    sql`${cryptoAssets.circulatingSupply} DESC NULLS LAST`;

export class DrizzleRemovalSitemapCandidateSource
    implements RemovalSitemapCandidateSource
{
    constructor(private readonly db: SiglensDatabase) {}

    async loadStockSymbolsBefore(
        cutoff: Date,
        excludedSymbols: readonly string[]
    ): Promise<readonly string[]> {
        const rows = await this.db
            .select({ symbol: koreanTickers.symbol })
            .from(koreanTickers)
            .where(
                and(
                    lt(koreanTickers.updatedAt, cutoff),
                    notInArray(koreanTickers.symbol, [...excludedSymbols])
                )
            )
            .orderBy(asc(koreanTickers.symbol));
        return rows.map(row => row.symbol);
    }

    async loadHistoricalCryptoSymbols(
        limit: number,
        excludedSymbols: readonly string[]
    ): Promise<readonly string[]> {
        const rows = await this.db
            .select({ symbol: cryptoAssets.symbol })
            .from(cryptoAssets)
            .where(notInArray(cryptoAssets.symbol, [...excludedSymbols]))
            .orderBy(cryptoSupplyOrder, asc(cryptoAssets.symbol))
            .limit(limit);
        return rows.map(row => row.symbol);
    }
}
```

- [ ] **Step 4: Run scoped gates**

```bash
yarn test src/entities/sitemap-entry/__tests__/removalApi.test.ts
yarn lint src/entities/sitemap-entry/api.ts src/entities/sitemap-entry/__tests__/removalApi.test.ts
yarn typecheck:tsc
```

Expected: PASS. Match captured Drizzle parameter types exactly rather than
weakening assertions.

- [ ] **Step 5: Commit through git-agent**

Commit message: `feat(sitemap): query historical removal candidates`

### Task 3: Build protected entries and minimal XML

**Files:**
- Create: `src/entities/sitemap-entry/lib/buildRemovalEntries.ts`
- Create: `src/entities/sitemap-entry/lib/removalXml.ts`
- Modify: `src/entities/sitemap-entry/lib/xml.ts`
- Modify: `src/entities/sitemap-entry/index.ts`
- Create: `src/entities/sitemap-entry/__tests__/buildRemovalEntries.test.ts`
- Create: `src/entities/sitemap-entry/__tests__/removalXml.test.ts`

- [ ] **Step 1: Write failing builder tests**

```typescript
expect(buildRemovalEntries('chart', ['msft', 'AAA', 'MSFT'])).toEqual([
    {
        url: 'https://siglens.io/AAA',
        lastModified: new Date('2026-07-08T00:00:00.000Z'),
    },
    {
        url: 'https://siglens.io/MSFT',
        lastModified: new Date('2026-07-08T00:00:00.000Z'),
    },
]);

expect(buildRemovalEntries('fear-greed', ['AAA'])[0]?.url).toBe(
    'https://siglens.io/AAA/fear-greed'
);
```

Cover every suffix with `it.each`.

- [ ] **Step 2: Write the failing XML test**

```typescript
const xml = toRemovalUrlSetXml([
    {
        url: 'https://siglens.io/A&B',
        lastModified: new Date('2026-07-08T00:00:00.000Z'),
    },
]);

expect(xml).toContain('<loc>https://siglens.io/A&amp;B</loc>');
expect(xml).toContain('<lastmod>2026-07-08</lastmod>');
expect(xml).not.toContain('<priority>');
expect(xml).not.toContain('<changefreq>');
```

- [ ] **Step 3: Verify both tests fail**

```bash
yarn test src/entities/sitemap-entry/__tests__/buildRemovalEntries.test.ts src/entities/sitemap-entry/__tests__/removalXml.test.ts
```

Expected: FAIL because both functions are absent.

- [ ] **Step 4: Implement the pure builder**

```typescript
const suffixByKind: Record<RemovalSitemapKind, string> = {
    chart: '',
    news: '/news',
    overall: '/overall',
    fundamental: '/fundamental',
    'fear-greed': '/fear-greed',
};

export function buildRemovalEntries(
    kind: RemovalSitemapKind,
    symbols: readonly string[]
): RemovalSitemapEntry[] {
    const suffix = suffixByKind[kind];
    const lastModified = new Date(REMOVAL_LAST_MODIFIED_ISO);
    return [...new Set(symbols.map(symbol => symbol.toUpperCase()))]
        .toSorted()
        .map(symbol => ({
            url: `${SITE_URL}/${symbol}${suffix}`,
            lastModified,
        }));
}
```

- [ ] **Step 5: Implement minimal XML without duplicate escaping**

Export the existing `escapeXml` helper from `lib/xml.ts`, then create:

```typescript
const DATE_ONLY_LENGTH = 10;

export function toRemovalUrlSetXml(
    entries: ReadonlyArray<RemovalSitemapEntry>
): string {
    const urls = entries
        .map(
            ({ url, lastModified }) => `
  <url>
    <loc>${escapeXml(url)}</loc>
    <lastmod>${lastModified.toISOString().slice(0, DATE_ONLY_LENGTH)}</lastmod>
  </url>`
        )
        .join('');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}\n</urlset>`;
}
```

Export both public pure functions from `index.ts`.

- [ ] **Step 6: Run scoped gates**

```bash
yarn test src/entities/sitemap-entry/__tests__/buildRemovalEntries.test.ts src/entities/sitemap-entry/__tests__/removalXml.test.ts
yarn lint src/entities/sitemap-entry
yarn typecheck:tsc
```

Expected: PASS.

- [ ] **Step 7: Commit through git-agent**

Commit message: `feat(sitemap): build minimal removal sitemap XML`

### Task 4: Freeze candidates behind the server boundary

**Files:**
- Create: `src/entities/sitemap-entry/server.ts`
- Create: `src/entities/sitemap-entry/__tests__/removalServer.test.ts`

- [ ] **Step 1: Write failing server-loader tests**

Mock `next/cache`, `getDatabaseClient`, and the adapter. Assert:

```typescript
stockLoadMock.mockResolvedValue(['AAA', 'BTCUSD']);
cryptoLoadMock.mockResolvedValue(['BTCUSD', 'ETHUSD']);

const entries = await loadRemovalSitemapEntries('chart');
expect(entries.map(entry => entry.url)).toEqual([
    'https://siglens.io/AAA',
    'https://siglens.io/BTCUSD',
    'https://siglens.io/ETHUSD',
]);

expect(unstableCacheMock).toHaveBeenCalledWith(
    expect.any(Function),
    ['temporary-removal-sitemap:v1:chart:2026-07-07T16:25:18.000Z'],
    { revalidate: false }
);
```

For each legacy kind, assert only the stock loader is called with
`REMOVAL_LEGACY_TAB_CUTOFF_ISO`. Assert the excluded array contains every value
from `POPULAR_TICKERS`, `POPULAR_CRYPTOS`, and
`APPROVED_LONGTAIL_TICKERS`. Assert a source rejection propagates.

- [ ] **Step 2: Verify the test fails**

Run: `yarn test src/entities/sitemap-entry/__tests__/removalServer.test.ts`

Expected: FAIL because `server.ts` is absent.

- [ ] **Step 3: Implement the cached loader**

```typescript
import 'server-only';

const protectedSymbols = [
    ...new Set([
        ...POPULAR_TICKERS,
        ...POPULAR_CRYPTOS,
        ...APPROVED_LONGTAIL_TICKERS,
    ]),
];

async function loadUncached(
    kind: RemovalSitemapKind
): Promise<RemovalSitemapEntry[]> {
    const source = new DrizzleRemovalSitemapCandidateSource(
        getDatabaseClient().db
    );
    const cutoffIso =
        kind === 'chart'
            ? REMOVAL_CHART_CUTOFF_ISO
            : REMOVAL_LEGACY_TAB_CUTOFF_ISO;
    const stockSymbols = await source.loadStockSymbolsBefore(
        new Date(cutoffIso),
        protectedSymbols
    );
    const cryptoSymbols =
        kind === 'chart'
            ? await source.loadHistoricalCryptoSymbols(
                  REMOVAL_CRYPTO_LIMIT,
                  protectedSymbols
              )
            : [];
    return buildRemovalEntries(kind, [...stockSymbols, ...cryptoSymbols]);
}

export function loadRemovalSitemapEntries(
    kind: RemovalSitemapKind
): Promise<RemovalSitemapEntry[]> {
    const cutoffIso =
        kind === 'chart'
            ? REMOVAL_CHART_CUTOFF_ISO
            : REMOVAL_LEGACY_TAB_CUTOFF_ISO;
    return unstable_cache(
        () => loadUncached(kind),
        [`temporary-removal-sitemap:v1:${kind}:${cutoffIso}`],
        { revalidate: false }
    )();
}
```

Import protected lists from their production barrels. If the approved list is
not exported, add that client-safe export to the symbol-indexability barrel.

- [ ] **Step 4: Run scoped gates**

```bash
yarn test src/entities/sitemap-entry/__tests__/removalServer.test.ts
yarn lint src/entities/sitemap-entry
yarn typecheck:tsc
```

Expected: PASS.

- [ ] **Step 5: Commit through git-agent**

Commit message: `feat(sitemap): freeze protected removal candidates`

### Task 5: Expose all five endpoints

**Files:**
- Create: `src/app/api/sitemap/removal/[kind]/route.ts`
- Create: `src/app/api/sitemap/__tests__/removal.test.ts`
- Modify: `src/app/api/sitemap/__tests__/route.test.ts`
- Modify: `next.config.ts`

- [ ] **Step 1: Write failing route tests**

Mock the server loader and serializer. Assert every valid kind returns `200`,
`application/xml`, and the existing sitemap cache policy. Assert invalid kind
returns `404` without loading. Assert DB failure returns `503` plus
`Retry-After: 300`. Assert more than `SITEMAP_MAX_URLS_PER_FILE` entries returns
`500` without serialization.

```typescript
const response = await GET(new Request('https://siglens.io'), {
    params: Promise.resolve({ kind: 'chart' }),
});
expect(response.status).toBe(200);
expect(response.headers.get('Content-Type')).toBe(
    'application/xml; charset=utf-8'
);
```

Add this permanent-index regression assertion to `route.test.ts`:

```typescript
expect(entries.map(entry => entry.url).join('\n')).not.toContain(
    'sitemap-removal'
);
```

- [ ] **Step 2: Verify route tests fail**

```bash
yarn test src/app/api/sitemap/__tests__/removal.test.ts src/app/api/sitemap/__tests__/route.test.ts
```

Expected: FAIL because the route is absent.

- [ ] **Step 3: Implement the route**

```typescript
export const dynamic = 'force-dynamic';

interface RouteContext {
    params: Promise<{ kind: string }>;
}

export async function GET(
    _request: Request,
    { params }: RouteContext
): Promise<NextResponse> {
    const { kind } = await params;
    if (!isRemovalSitemapKind(kind)) {
        return new NextResponse('Removal sitemap not found', { status: 404 });
    }

    try {
        const entries = await loadRemovalSitemapEntries(kind);
        if (entries.length > SITEMAP_MAX_URLS_PER_FILE) {
            console.error('[sitemap-removal] URL cap exceeded', {
                kind,
                entries: entries.length,
                cap: SITEMAP_MAX_URLS_PER_FILE,
            });
            return new NextResponse('Sitemap page generation failed', {
                status: 500,
            });
        }
        console.info('[sitemap-removal] generated', {
            kind,
            entries: entries.length,
        });
        return new NextResponse(toRemovalUrlSetXml(entries), {
            headers: {
                'Content-Type': 'application/xml; charset=utf-8',
                'Cache-Control': SITEMAP_CACHE_CONTROL,
            },
        });
    } catch (error) {
        console.error('[sitemap-removal] generation failed', { kind, error });
        return new NextResponse(SITEMAP_UNAVAILABLE_BODY, {
            status: 503,
            headers: { 'Retry-After': SITEMAP_RETRY_AFTER_SECONDS },
        });
    }
}
```

- [ ] **Step 4: Add the rewrite**

```typescript
{
    source: '/sitemap-removal-:kind.xml',
    destination: '/api/sitemap/removal/:kind',
},
```

Do not modify `src/app/robots.ts` or the permanent sitemap entries.

- [ ] **Step 5: Run scoped gates**

```bash
yarn test src/app/api/sitemap/__tests__/removal.test.ts src/app/api/sitemap/__tests__/route.test.ts
yarn lint src/app/api/sitemap src/entities/sitemap-entry next.config.ts
yarn typecheck:tsc
```

Expected: PASS.

- [ ] **Step 6: Commit through git-agent**

Commit message: `feat(sitemap): expose staged removal endpoints`

### Task 6: Add the runbook and complete review gates

**Files:**
- Create: `docs/qa/2026-08-07-temporary-removal-sitemaps-runbook.md`
- Verify: all implementation files

- [ ] **Step 1: Write the runbook**

Document the five endpoint URLs, expected chart count of about 29,069, expected
legacy count of about 26,861 each, Day 0/2/4/6/8 submission schedule, GSC success
check, Googlebot `noindex` samples, protected-list intersection check, XML parsing,
5xx/latency/DB/ISR pause conditions, and the zero-indexed-for-two-weekly-checks
cleanup rule.

Include:

```bash
for kind in chart news overall fundamental fear-greed; do
  curl -fsS "https://siglens.io/sitemap-removal-${kind}.xml" \
    | xmllint --noout -
done

curl -fsS https://siglens.io/sitemap.xml | grep sitemap-removal
```

The second command must return no matches.

- [ ] **Step 2: Run complete scoped verification**

Run each command directly, without a pipe that can hide its exit code:

```bash
yarn test src/entities/sitemap-entry src/app/api/sitemap
yarn typecheck:tsc
yarn lint src/entities/sitemap-entry src/app/api/sitemap next.config.ts
yarn prettier --check src/entities/sitemap-entry src/app/api/sitemap next.config.ts docs/qa/2026-08-07-temporary-removal-sitemaps-runbook.md
git diff --check master...HEAD
rg -n '\x{2014}|T[B]D|T[O]DO' src/entities/sitemap-entry src/app/api/sitemap docs/qa/2026-08-07-temporary-removal-sitemaps-runbook.md
```

Expected: all gates pass, and the final `rg` has no matches.

- [ ] **Step 3: Re-read recurring mistakes**

Run: `sed -n '1,520p' docs/workflows/MISTAKES.md`

Inspect the full diff for explicit return types, server-only boundaries,
immutable array methods, factual comments, and synchronized tests/docs.

- [ ] **Step 4: Commit the runbook through git-agent**

Commit message: `docs(seo): add removal sitemap runbook`

- [ ] **Step 5: Invoke review-agent**

Review `master...HEAD`, including cutoff accuracy, complete protected-set
exclusion, DB query ordering, cache freezing, XML limits, failure paths, and
tests. Fix every valid required and recommended finding, re-run scoped gates,
and repeat review until approved.

- [ ] **Step 6: Route through mistake-managing-agent and git-agent**

After approval, invoke mistake-managing-agent, then git-agent to push and create
one implementation PR. Verify the remote SHA with:

```bash
git ls-remote origin feat/temporary-removal-sitemaps
```

Do not use `--no-verify`.

- [ ] **Step 7: Complete the PR review loop**

Poll review action completion every 60 seconds using paginated GitHub API calls.
Apply every valid body and inline comment. After `CHANGES_REQUESTED`, toggle
Draft to Ready with `scripts/pr_toggle_ready.sh` and wait for approval. Merge
normally, not with squash, only after approval.

- [ ] **Step 8: Verify production before Day 0**

After deployment, execute the full runbook and record all five counts. Do not
submit any removal sitemap if XML, counts, protected exclusions, `noindex`, or
production-health checks fail.

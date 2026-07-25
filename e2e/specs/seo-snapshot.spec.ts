import { DEEPSEEK_V4_FLASH_MODEL } from '@y0ngha/siglens-core';
import { test, expect } from '../support/fixtures';
import { normalizeReactSsrText } from '../support/ssrText';
import { seedSeoSnapshot } from '../support/seoSnapshotSeeder';

/**
 * SEO pre-warm snapshot rendering (crawler-facing) — Task 10.
 *
 * Proves the contract added by the seo-prewarm-rendering phase: a seeded
 * `seo_analysis_snapshots` row surfaces as visible SSR prose on the `[symbol]`
 * (technical/chart) page — see `TechnicalSnapshotProse` mounted in the
 * Suspense fallback of `src/app/[symbol]/page.tsx` — and the pre-existing
 * longtail-noindex invariant (symbol-seo.spec.ts) still holds alongside it.
 * Uses `page.request` (raw HTTP, like a crawler), not page navigation —
 * mirrors symbol-seo.spec.ts.
 *
 * ISR caching approach (read before touching the seeded-symbol test):
 * --------------------------------------------------------------------
 * `getSeoSnapshotsStatic` wraps the DB read in `unstable_cache`
 * (tags `symbol:{SYMBOL}` + `seo-snapshot:{SYMBOL}`, revalidate=21600s ==
 * this page's `revalidate` literal). The real pre-warm cron busts this via
 * `revalidateTag`, but this spec's seeder writes straight to Postgres (see
 * `seoSnapshotSeeder.ts`) and cannot call `revalidateTag` from outside a
 * Next.js request. So if `/AAPL` (or any symbol another spec already
 * requested) were reused here, a prior spec could have already cold-generated
 * and cached that route/data BEFORE this file's `beforeAll` seeds the row,
 * making the seeded content invisible for the rest of the 21600s TTL —
 * flaky-by-cache-order, not by test logic.
 *
 * Fix: seed a symbol ('SEOQAX') that no other spec in this suite ever
 * requests (verified via grep across e2e/specs at authoring time) and seed it
 * in `beforeAll`, BEFORE this file's first request to that route. That
 * request is then guaranteed to be the first-ever cold-gen for `/SEOQAX`
 * across the whole run (workers:1 in CI; even with local parallel workers no
 * other spec touches this symbol), so `getSeoSnapshotsStatic` computes fresh
 * from Postgres with the seeded row already present — no cache invalidation
 * needed. This holds regardless of spec execution order.
 *
 * SEOQAX matches `TICKER_RE` (uppercase letters only) so it takes the same
 * "unresolvable-but-format-valid" path as `symbol-seo.spec.ts`'s `ZZZZ` probe
 * (degrades to 200 + noindex, never notFound) — it is intentionally NOT
 * seeded into `asset_translations`, since `TechnicalSnapshotProse` only
 * depends on the snapshot row, not on `assetInfo`.
 */

const SEEDED_SYMBOL = 'SEOQAX';
const SEEDED_SUMMARY =
    'E2E 시드 분석 요약: SEOQAX 종목은 최근 뚜렷한 상승 추세를 유지하며 거래량 증가와 함께 견조한 흐름을 보이고 있습니다.';
// UI audit FIX 6: SnapshotSummarySection's per-tab `title` prop is now wired
// up (previously dead code — every renderer fell through to the shared
// default '최근 분석 요약'). The technical/chart tab now renders its own
// tab-specific heading; keep this marker in sync with
// TechnicalSnapshotProse's `title="기술적 분석 요약"` call and
// docs/reference/CRON.md's verification curl.
const SNAPSHOT_HEADING = '기술적 분석 요약';

// Never requested by any other spec in this suite (see the ISR-caching
// comment above) — reused across the "no snapshot" and "longtail noindex"
// assertions below (neither seeds SEOQAX, so both stay symbol-agnostic).
const UNSEEDED_SYMBOL = 'ZZZZ';

test.describe('SEO pre-warm snapshot SSR (crawler-facing)', () => {
    let cleanupSeededSnapshot: (() => Promise<void>) | undefined;

    test.beforeAll(async () => {
        cleanupSeededSnapshot = await seedSeoSnapshot({
            symbol: SEEDED_SYMBOL,
            tab: 'technical',
            content: { summary: SEEDED_SUMMARY, trend: 'bullish' },
            model: DEEPSEEK_V4_FLASH_MODEL,
            generatedAt: new Date(),
        });
    });

    test.afterAll(async () => {
        await cleanupSeededSnapshot?.();
    });

    test('seeded technical snapshot renders as visible SSR prose on a fresh symbol', async ({
        page,
    }) => {
        const response = await page.request.get(`/${SEEDED_SYMBOL}`);
        expect(response.status()).toBe(200);

        const normalizedHtml = normalizeReactSsrText(await response.text());
        expect(normalizedHtml).toContain(SEEDED_SUMMARY);
        expect(normalizedHtml).toContain(SNAPSHOT_HEADING);
    });

    test('a symbol with no seeded snapshot renders without the snapshot marker (null-render contract)', async ({
        page,
    }) => {
        const response = await page.request.get(`/${UNSEEDED_SYMBOL}`);
        expect(response.status()).toBe(200);

        const normalizedHtml = normalizeReactSsrText(await response.text());
        // Proves TechnicalSnapshotProse's narrowTechnicalContent(undefined) ===
        // null path: no snapshot row for this symbol → the section (and its
        // heading) is absent entirely, not an empty shell — the existing
        // TechnicalFactsSummary/placeholder fallback is what renders instead.
        expect(normalizedHtml).not.toContain(SEEDED_SUMMARY);
        expect(normalizedHtml).not.toContain(SNAPSHOT_HEADING);
    });

    test('longtail noindex invariant intact: unapproved symbol still degrades to 200 + noindex, nofollow', async ({
        page,
    }) => {
        // Mirrors symbol-seo.spec.ts's "an unapproved but well-formed ticker
        // degrades to 200 + noindex" probe — re-asserted here so a Phase-2
        // rendering regression (e.g. snapshot mounting accidentally flipping
        // the indexability gate) would be caught by this spec too.
        const response = await page.request.get(`/${UNSEEDED_SYMBOL}`);
        expect(response.status()).toBe(200);

        const html = await response.text();
        expect(html).toMatch(
            /<meta name="robots" content="noindex, nofollow"\/?>/
        );
    });
});

import { test, expect } from '../support/fixtures';

/**
 * `/news` Market News Hub — Playwright E2E specs (Phase 7.1).
 *
 * Architecture notes:
 *
 *   - `/news` is an ISR RSC page. The 5 CategoryCard components are SSR-emitted;
 *     each has `aria-label="${koLabel} 뉴스 더보기"` and `href="/news/${slug}"`.
 *     Under E2E_TEST=1 the staticSymbolCache preview fetch uses FakeMarketNewsClient,
 *     so headline previews render deterministically without any network I/O.
 *
 *   - `/news/[category]` renders h1 = `미국 ${cfg.koLabel} 뉴스` from the page RSC.
 *     The card list is hydrated from SSR initial items (via FakeMarketNewsClient).
 *     MarketNewsDigest is a `'use client'` component that renders a `<section
 *     aria-labelledby="market-news-digest-status-heading">` (loading) or
 *     `aria-labelledby="market-news-digest-heading"` (result). The SSR-emitted
 *     title text "시장 AI 다이제스트" is present in both states.
 *
 *   - `/news/bogus` hits `notFound()` in CategoryNewsPage because `categoryFromSlug`
 *     returns null → Next.js emits a 404 response.
 *
 * Fixture anchors:
 *   - Hub link href:  `/news/{slug}` (one per category, five total)
 *   - Category h1:    matches /암호화폐/ for /news/crypto
 *   - Fixture card:   "E2E fixture crypto headline one" (from FakeMarketNewsClient)
 *   - Digest section: heading text "시장 AI 다이제스트" (rendered in any digest state)
 */

const CATEGORY_SLUGS = [
    'general',
    'stock',
    'crypto',
    'forex',
    'articles',
] as const;

test.describe('/news 마켓 뉴스 허브', () => {
    /**
     * 허브 인덱스가 5개 카테고리 딥링크를 SSR-렌더하는지 검증해요.
     * CategoryCard는 `href="/news/${slug}"`로 직접 연결돼요.
     */
    test('허브가 5개 카테고리 딥링크를 렌더해요 (happy)', async ({ page }) => {
        await page.goto('/news');

        for (const slug of CATEGORY_SLUGS) {
            await expect(
                page.locator(`a[href="/news/${slug}"]`).first()
            ).toBeVisible();
        }
    });

    /**
     * 카테고리 페이지가 SSR 카드 + 다이제스트 영역을 렌더하는지 검증해요.
     * FakeMarketNewsClient가 결정적 fixture 기사를 반환하므로 타이틀이
     * 클라이언트 hydration 전에 SSR HTML에 이미 존재해요.
     */
    test('카테고리 페이지가 SSR 카드 + 다이제스트 영역을 렌더해요 (happy)', async ({
        page,
    }) => {
        await page.goto('/news/crypto');

        // h1 = "미국 미국 암호화폐 뉴스" (koLabel = '미국 암호화폐')
        await expect(page.getByRole('heading', { level: 1 })).toContainText(
            '암호화폐'
        );

        // FakeMarketNewsClient의 crypto fixture 첫 번째 기사 타이틀 (영어)
        await expect(
            page.getByText('E2E fixture crypto headline one', { exact: false })
        ).toBeVisible();

        // MarketNewsDigest는 로딩/결과 어떤 상태든 "시장 AI 다이제스트" 제목을
        // 렌더해요 (DigestStatusCard / DigestResultView 모두 동일 텍스트 사용).
        await expect(
            page.getByRole('heading', { name: '시장 AI 다이제스트' })
        ).toBeVisible({ timeout: 10_000 });
    });

    /**
     * 유효하지 않은 카테고리 slug는 404를 반환해야 해요.
     * categoryFromSlug('bogus')가 null을 반환하므로 Next.js notFound()가
     * 404 응답을 돌려줘요.
     */
    test('유효하지 않은 카테고리는 404를 반환해요 (worst)', async ({
        page,
    }) => {
        const res = await page.goto('/news/bogus');
        expect(res?.status()).toBe(404);
    });
});

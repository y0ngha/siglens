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
 *   - `/news/[category]` renders h1 = `${cfg.koLabel} 뉴스` from the page RSC.
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

        await expect(page.getByRole('heading', { level: 1 })).toHaveText(
            '미국 암호화폐 뉴스'
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

        // FakeMarketNewsClient가 enriched fixture를 반환하므로 digest가 done 상태에
        // 도달해요. done 상태 전용 배지가 보이는지 확인해요.
        await expect(
            page.locator('[data-testid="sentiment-badge"]').first()
        ).toBeVisible({ timeout: 15_000 });
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

    /**
     * 카테고리 페이지의 허브 breadcrumb 링크가 올바른 href(/news)를 가지는지 검증해요.
     * FakeMarketNewsClient fixture 기사와 함께 nav 헤더의 뉴스 링크도 검증해요.
     */
    test('카테고리 페이지에서 허브로 돌아가는 링크가 올바른 href를 가져요 (happy)', async ({
        page,
    }) => {
        await page.goto('/news/crypto');

        await expect(page.getByRole('heading', { level: 1 })).toHaveText(
            '미국 암호화폐 뉴스'
        );

        // Verify there is at least one article from SSR fixture
        await expect(
            page.getByText('E2E fixture crypto headline one', { exact: false })
        ).toBeVisible();

        // Hub link in nav header should point to /news
        const newsNavLink = page.locator('a[href="/news"]').first();
        await expect(newsNavLink).toHaveAttribute('href', '/news');
    });

    /**
     * 다이제스트 degrade 상태: 카테고리에 AI-enriched 뉴스가 없어도
     * 페이지가 정상 렌더돼야 해요 (가장 가까운 degrade path).
     *
     * E2E_TEST=1에서 FakeMarketNewsClient는 항상 enriched fixture를 반환하므로
     * 이 테스트는 degrade 페이지 구조(h1 존재 여부)만 검증해요.
     */
    test('카테고리 페이지가 degrade 경로에서도 h1을 렌더해요 (worst)', async ({
        page,
    }) => {
        // articles 카테고리는 FakeMarketNewsClient에서 fixture가 없을 수 있어요
        await page.goto('/news/articles');

        // Page should always have an h1 regardless of data state
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    });

    /**
     * E1 — 카테고리 탭바 내비게이션: `nav[aria-label="뉴스 카테고리"]` 탭바가
     * `/news/[category]` 페이지에서 올바른 active 탭을 표시하고,
     * 다른 탭 클릭 시 해당 카테고리 URL로 이동하는지 검증해요.
     *
     * NewsCategoryTabs는 서버 컴포넌트 — `activeCategory` prop이 slug에서
     * 파생되므로 별도 hydration 없이 SSR HTML에서 즉시 aria-current를 확인할 수 있어요.
     * FakeMarketNewsClient가 stock·crypto fixture를 모두 반환하므로 양쪽 카테고리 페이지가
     * 데이터 있는 상태(not degrade)로 렌더돼요.
     */
    test('카테고리 탭바가 active 탭을 표시하고 다른 탭 클릭 시 URL이 변경돼요 (E1)', async ({
        page,
    }) => {
        await page.goto('/news/stock');

        // 뉴스 카테고리 nav 랜드마크가 존재해야 해요.
        const categoryNav = page.getByRole('navigation', {
            name: '뉴스 카테고리',
        });
        await expect(categoryNav).toBeVisible();

        // /news/stock에서 '주식' 탭이 활성 상태(aria-current="page")여야 해요.
        await expect(
            categoryNav.getByRole('link', { name: '주식' })
        ).toHaveAttribute('aria-current', 'page');

        // '암호화폐' 탭을 클릭하면 /news/crypto로 이동해야 해요.
        await categoryNav.getByRole('link', { name: '암호화폐' }).click();
        await page.waitForURL('**/news/crypto');

        // URL 이동 후 '암호화폐' 탭이 새 active 탭이 돼야 해요.
        const updatedNav = page.getByRole('navigation', {
            name: '뉴스 카테고리',
        });
        await expect(
            updatedNav.getByRole('link', { name: '암호화폐' })
        ).toHaveAttribute('aria-current', 'page');

        // '주식' 탭은 더 이상 활성 상태가 아니에요.
        await expect(
            updatedNav.getByRole('link', { name: '주식' })
        ).not.toHaveAttribute('aria-current', 'page');
    });
});

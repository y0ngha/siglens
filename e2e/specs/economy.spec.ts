import { test, expect } from '../support/fixtures';

/**
 * /economy — Tier 3 render outcomes.
 *
 * E2E 환경에서는 `FakeEconomyProvider`가 결정적 fixture를 반환한다(부록 A 검증된 9 지표
 * + treasury + US 캘린더 3건). 따라서 안정적 landmark(h1·카테고리 섹션 헤딩·캘린더
 * 헤딩·specific 라벨)를 어서션한다.
 */
test.describe('economy overview', () => {
    test('h1과 세 축(브리핑·지표·캘린더) landmark가 렌더된다', async ({
        page,
    }) => {
        await page.goto('/economy');

        await expect(
            page.getByRole('heading', {
                level: 1,
                name: '미국 경제 — 지표·캘린더 한눈에',
            })
        ).toBeVisible();

        // 카테고리 그룹 헤딩 — Fake fixture가 모든 카테고리에 latest 값을 가짐.
        await expect(
            page.getByRole('heading', { level: 2, name: '경제지표' })
        ).toBeVisible();
        await expect(
            page.getByRole('heading', { level: 3, name: '금리' })
        ).toBeVisible();

        // 캘린더 섹션 헤딩.
        await expect(
            page.getByRole('heading', { level: 2, name: '경제 캘린더' })
        ).toBeVisible();
    });

    /**
     * SSR 크롤 텍스트 보장. 지표 카드와 캘린더 이벤트는 서버 컴포넌트라 no-JS HTML에
     * 그대로 박힌다. 검색 엔진이 JS 없이도 거시 데이터를 색인할 수 있어야 한다.
     */
    test('SSR HTML에 지표·캘린더 텍스트가 노출된다 (no-JS crawlers)', async ({
        page,
    }) => {
        const res = await page.request.get('/economy');
        expect(res.status()).toBe(200);
        const html = await res.text();

        // 카테고리 헤딩 (서버 렌더).
        expect(html).toContain('경제지표');
        expect(html).toContain('금리');
        expect(html).toContain('경제 캘린더');

        // Fake fixture가 federalFunds=3.63를 latest로 시드 — 라벨 + 값이 SSR HTML에 있어야 한다.
        expect(html).toContain('연방기금금리');

        // Fake calendar의 첫 이벤트가 Fed Rate Decision — 본문이 SSR로 노출.
        expect(html).toContain('Fed Rate Decision');
    });

    /**
     * 금리 카드 — 2년물·10년물·2s10s 스프레드가 모두 표시되는지 검증.
     * Fake fixture: year2=4.07, year10=4.47 → spread=+0.40.
     */
    test('금리 섹션에 2년물·10년물·2s10s 스프레드 카드가 표시된다', async ({
        page,
    }) => {
        await page.goto('/economy');
        await expect(page.getByText('2년물 국채')).toBeVisible();
        await expect(page.getByText('10년물 국채')).toBeVisible();
        await expect(page.getByText('2s10s 스프레드')).toBeVisible();
    });
});

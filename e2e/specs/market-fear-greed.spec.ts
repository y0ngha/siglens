import { test, expect } from '../support/fixtures';

const PAGE_TITLE = '오늘 미국 증시 심리, 공포 탐욕 지수로 확인';

/**
 * `/fear-greed` — 시장 전체 공포·탐욕 지수 (Tier 3 정적 최상위 라우트).
 *
 * E2E 빌드에는 FMP 키가 없지만 `fetchDailyCloses`가 `isE2E()`에서 결정적 fixture로
 * 갈아타므로, 게이지·기간별 비교·요인 막대까지 실제로 렌더된다. 다만 점수 값 자체는
 * fixture 난수에 달렸으므로 어서션하지 않는다 — 구조와 범위만 본다.
 */
test.describe('market fear & greed', () => {
    /**
     * 최우선 회귀 가드: `src/proxy.ts`의 ticker 케이스 정규화가 하이픈 라우트명을
     * 심볼로 오인해 `/fear-greed`를 `/FEAR-GREED`로 301시킨 적이 있다. App Router는
     * 정적 세그먼트를 우선하므로 빌드 산출물만 보면 정상으로 보이고, 프록시가
     * 라우팅보다 먼저 도는 런타임에서만 깨진다.
     */
    test('리다이렉트 없이 200으로 응답한다 (proxy 대문자 정규화 회귀 가드)', async ({
        page,
    }) => {
        const res = await page.request.get('/fear-greed', {
            maxRedirects: 0,
        });

        expect(res.status()).toBe(200);
    });

    test('h1과 지수 가이드 landmark가 렌더된다', async ({ page }) => {
        await page.goto('/fear-greed');

        await expect(
            page.getByRole('heading', { level: 1, name: PAGE_TITLE })
        ).toBeVisible();

        await expect(
            page.getByRole('heading', { level: 2, name: '지수 읽는 법' })
        ).toBeVisible();
    });

    /**
     * SSR 크롤 텍스트 보장. 이 페이지는 전부 서버 컴포넌트라 JS 없이도 본문이
     * 그대로 박혀야 한다 — 이 사이트는 thin content로 코어 업데이트에 맞은 이력이 있다.
     */
    test('SSR HTML에 지수 설명·점수 구간·요인 설명이 노출된다 (no-JS crawlers)', async ({
        page,
    }) => {
        const res = await page.request.get('/fear-greed');
        expect(res.status()).toBe(200);
        const html = await res.text();

        expect(html).toContain('지수 읽는 법');
        expect(html).toContain('극심한 탐욕');
        expect(html).toContain('시장 모멘텀');
        expect(html).toContain('시장 변동성');
        expect(html).toContain('안전자산 선호');
        expect(html).toContain('하이일드 수요');
        expect(html).toContain('시장 폭');

        // CNN과 구성이 다르다는 고지가 본문에 있어야 한다(FAQ 답변과 일치).
        expect(html).toContain('CNN Fear');
    });

    test('WebPage·BreadcrumbList·FAQPage JSON-LD가 SSR HTML에 포함된다', async ({
        page,
    }) => {
        const res = await page.request.get('/fear-greed');
        const html = await res.text();

        expect(html).toContain('"@type":"WebPage"');
        expect(html).toContain('"@type":"BreadcrumbList"');
        expect(html).toContain('"@type":"FAQPage"');
    });

    /**
     * fixture가 살아 있으면 게이지·비교 4칸·요인 막대 5개가 모두 렌더된다.
     * 점수 숫자는 fixture 난수에 달렸으므로 0~100 범위만 확인한다.
     */
    test('게이지·기간별 비교 4칸·요인 막대 5개가 렌더된다', async ({
        page,
    }) => {
        await page.goto('/fear-greed');

        await expect(
            page.getByRole('heading', { level: 2, name: '기간별 비교' })
        ).toBeVisible();
        await expect(
            page.getByRole('heading', { level: 2, name: '요인별 기여도' })
        ).toBeVisible();

        for (const label of ['현재', '1주 전', '1개월 전', '1년 전']) {
            await expect(page.getByText(label, { exact: true })).toBeVisible();
        }

        // 요인 막대는 각각 progressbar role을 갖는다.
        await expect(page.getByRole('progressbar')).toHaveCount(5);

        const score = await page.evaluate(() => {
            const m = document.body.innerText.match(/(\d+)\s*\/\s*100/);
            return m ? Number(m[1]) : null;
        });
        expect(score).not.toBeNull();
        expect(score as number).toBeGreaterThanOrEqual(0);
        expect(score as number).toBeLessThanOrEqual(100);
    });

    test('헤더 "공포·탐욕 지수" 링크 클릭으로 /fear-greed에 도달한다', async ({
        page,
    }) => {
        // 헤더 nav 링크는 sm(640px) 이상에서만 표시된다.
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.goto('/');

        await page
            .getByRole('banner')
            .getByRole('navigation', { name: '주요 네비게이션' })
            .getByRole('link', { name: '공포·탐욕 지수' })
            .click();

        await page.waitForURL('**/fear-greed');

        await expect(
            page.getByRole('heading', { level: 1, name: PAGE_TITLE })
        ).toBeVisible();
    });

    test('모바일 viewport(375px)에서 가로 오버플로가 없다', async ({
        page,
    }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await page.goto('/fear-greed');

        await expect(
            page.getByRole('heading', { level: 1, name: PAGE_TITLE })
        ).toBeVisible();

        const overflow = await page.evaluate(
            () =>
                document.documentElement.scrollWidth -
                document.documentElement.clientWidth
        );
        expect(
            overflow,
            `/fear-greed 375px: 가로 오버플로 ${overflow}px — 레이아웃 회귀`
        ).toBeLessThanOrEqual(0);
    });

    /**
     * sitemap 등록 확인 — 새 최상위 라우트가 정적 sitemap에서 누락되면 색인이 늦는다.
     */
    test('정적 sitemap에 /fear-greed 엔트리가 있다', async ({ page }) => {
        const res = await page.request.get('/sitemap-static.xml');
        expect(res.status()).toBe(200);

        expect(await res.text()).toContain('/fear-greed</loc>');
    });
});

import type { Page } from '@playwright/test';
import { test, expect } from '../support/fixtures';

/**
 * 페이지 이동 골격 — Playwright E2E.
 *
 * 내부 링크는 `prefetch={false}`라 클릭 뒤 목적지 RSC가 다 올 때까지 라우터가 아무것도
 * 커밋하지 못한다. 그 사이 떠나온 화면이 그대로 남지 않도록, 클릭 즉시 목적지 모양의
 * 골격으로 바꾼다(`RoutePendingSlot`).
 *
 * 이 스펙이 지키는 것:
 *
 *   - **클릭 직후 골격이 뜨고, 도착하면 걷힌다.** 로컬 서버는 RSC가 수십 ms 만에 와서
 *     골격을 볼 틈이 없으므로 `_rsc` 요청만 늦춰 운영(LAX 경유 0.4~0.6s)과 같은 공백을 만든다.
 *
 *   - **골격은 클라이언트 상태일 뿐이다.** 서버가 내는 HTML에는 골격도 pending 표식도
 *     없어야 한다 — 직접 접속·크롤러·상태 코드에 관여하지 않는다는 것이 이 설계의 전제다.
 */

const RSC_DELAY_MS = 1_200;

/** 목적지 RSC 응답만 늦춘다. 문서·정적 자산·서버 액션은 그대로 둔다. */
async function delayRsc(page: Page) {
    await page.route(
        url => url.searchParams.has('_rsc'),
        async route => {
            await new Promise(resolve => setTimeout(resolve, RSC_DELAY_MS));
            await route.fallback();
        }
    );
}

const skeleton = (page: Page, kind: string) =>
    page.locator(`[data-route-skeleton="${kind}"]`);

test.describe('페이지 이동 골격', () => {
    test('소개 → 분석 방법: 클릭 즉시 목적지 골격, 도착하면 본문', async ({
        page,
    }) => {
        await page.goto('/about');
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await delayRsc(page);

        await page.locator('footer a[href="/methodology"]').click();

        await expect(skeleton(page, 'article')).toBeVisible();
        // 떠나온 페이지는 언마운트가 아니라 숨김이다 — 골격만 보인다.
        await expect(page.locator('main')).toBeHidden();

        await expect(page).toHaveURL(/\/methodology$/);
        await expect(page.locator('[data-route-skeleton]')).toHaveCount(0);
        await expect(page.locator('[data-route-pending]')).toHaveCount(0);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    });

    test('종목 디렉터리로 가는 이동은 디렉터리 모양의 골격을 쓴다', async ({
        page,
    }) => {
        await page.goto('/about');
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await delayRsc(page);

        await page.locator('footer a[href="/symbols"]').click();

        await expect(skeleton(page, 'symbols')).toBeVisible();
        await expect(page).toHaveURL(/\/symbols$/);
        await expect(page.locator('[data-route-skeleton]')).toHaveCount(0);
    });

    test('뒤로가기는 골격 없이 떠나온 페이지를 되돌린다', async ({ page }) => {
        await page.goto('/about');
        await page.locator('footer a[href="/methodology"]').click();
        await expect(page).toHaveURL(/\/methodology$/);

        await page.goBack();

        await expect(page).toHaveURL(/\/about$/);
        await expect(page.locator('[data-route-skeleton]')).toHaveCount(0);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    });

    test('서버 HTML에는 골격도 pending 표식도 없다', async ({ request }) => {
        for (const path of ['/', '/about', '/market', '/news', '/privacy']) {
            const response = await request.get(path);
            expect(response.status(), path).toBe(200);
            const html = await response.text();
            expect(html, path).not.toContain('data-route-skeleton');
            expect(html, path).not.toContain('data-route-pending');
        }
    });
});

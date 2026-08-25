import { test, expect } from '../support/fixtures';

/**
 * Not-found handling (`/`) — Tier 4 cross-cutting outcome.
 *
 * Three ways to reach the global not-found.tsx:
 *   - an unknown route segment (no matching page),
 *   - a symbol whose identity cannot be resolved at all — `/INVALIDTICKER1`
 *     passes SYMBOL_EDGE_RE, so it reaches getAssetInfoResilient and 404s via
 *     the degraded/unresolvable path (NOT at the shape gate), and
 *   - a foreign-exchange suffix (`.L`/`.TO`/`.V`/`.CN`), rejected by
 *     `isAdmissibleSymbolShape` before any FMP call.
 *   A well-FORMED, resolvable but unseeded ticker does NOT notFound — it renders
 *   200 + noindex (see symbol-seo.spec.ts).
 *
 * ⚠️ HTTP STATUS IS ASSERTED ON PURPOSE — do not weaken it back to a UI-only check.
 *
 * Until 2026-07-26 these routes answered **200** with the 404 UI (a soft 404 —
 * Google counts it as thin content). Cause: in Next 16.2 a `notFound()` thrown
 * inside a Suspense boundary leaves the status at 200, and `[symbol]/loading.tsx`
 * plus the layout's own Suspense put every tab inside one. The fix hoists the
 * decision into `[symbol]/layout.tsx`, above those boundaries.
 *
 * This spec is the ONLY committed test that can observe a real HTTP status
 * against a production build — the unit tests can only assert that `notFound()`
 * was called, not what status the framework ends up emitting. If someone
 * reintroduces a Suspense boundary above the guard, or moves the guard back into
 * page.tsx, ONLY this assertion catches it.
 */
const NOT_FOUND_URLS = [
    '/this-route-does-not-exist-zzz',
    '/INVALIDTICKER1', // resolvable-shape but unknown asset → unresolvable path
    '/HVO.L', // 해외 거래소 접미사 → 형상 게이트에서 FMP 호출 전 차단
    '/HVO.L/options', // 자체 loading.tsx가 있는 탭 — 200이 새던 바로 그 구성
] as const;

test.describe('not found', () => {
    for (const url of NOT_FOUND_URLS) {
        test(`${url} renders the not-found page with a home link`, async ({
            page,
        }) => {
            const response = await page.goto(url);
            expect(response?.status()).toBe(404);

            await expect(
                page.getByRole('heading', { name: '페이지를 찾을 수 없습니다' })
            ).toBeVisible();

            const homeLink = page.getByRole('link', {
                name: /홈으로 돌아가기/,
            });
            await expect(homeLink).toBeVisible();
            await expect(homeLink).toHaveAttribute('href', '/');
        });
    }

    /**
     * 에러 셸 404가 저장된 테마를 적용하는지 — **프로덕션 빌드에서만** 볼 수 있다.
     *
     * `/INVALIDTICKER1`은 동적 세그먼트에서 `notFound()`를 부르므로 Next가
     * 루트 레이아웃을 거치지 않는 `<html id="__next_error__">` 셸을 내보낸다.
     * 그 셸의 `<head>`에는 인라인 스크립트가 **하나도 없어서**, 테마를 찍는
     * 것은 `not-found.tsx`가 렌더하는 클라이언트 폴백뿐이다. 유닛 테스트는
     * jsdom이라 이 셸을 재현할 수 없다 — 여기서만 진짜로 확인된다.
     */
    test('에러 셸 404도 저장된 라이트 테마를 적용한다', async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem('siglens-theme', 'light');
        });

        const response = await page.goto('/INVALIDTICKER1');
        expect(response?.status()).toBe(404);

        await expect(page.locator('html')).toHaveAttribute(
            'data-theme',
            'light'
        );
        await expect(
            page.getByRole('heading', { name: '페이지를 찾을 수 없습니다' })
        ).toBeVisible();
    });

    test('the not-found home link navigates back to the landing page', async ({
        page,
    }) => {
        await page.goto('/this-route-does-not-exist-zzz');
        await page.getByRole('link', { name: /홈으로 돌아가기/ }).click();
        await page.waitForURL('**/');
        await expect(
            page
                .getByRole('banner')
                .getByRole('combobox', { name: '종목 티커 검색' })
        ).toBeVisible();
    });
});

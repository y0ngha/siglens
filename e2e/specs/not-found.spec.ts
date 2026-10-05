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
 * plus the layout's own Suspense put every tab inside one. The fix hoisted the
 * existence decision into `[symbol]/layout.tsx`, above those boundaries; since
 * 2026-10-05 the boundaries themselves are gone (no `loading.tsx` under `[symbol]`,
 * chrome not in Suspense), so tab-availability `notFound()` is a real 404 too.
 *
 * This spec is the ONLY committed test that can observe a real HTTP status
 * against a production build — the unit tests can only assert that `notFound()`
 * was called, not what status the framework ends up emitting. If someone
 * reintroduces a Suspense boundary above the guard, or moves the guard back into
 * page.tsx, ONLY this assertion catches it.
 */
const NOT_FOUND_URLS = [
    '/this-route-does-not-exist-zzz',
    '/foo/bar', // 어떤 라우트에도 매칭되지 않음 → 루트 `not-found.tsx` (자체 문서)
    '/INVALIDTICKER1', // resolvable-shape but unknown asset → unresolvable path
    '/HVO.L', // 해외 거래소 접미사 → 형상 게이트에서 FMP 호출 전 차단
    '/HVO.L/options', // 예전엔 자체 loading.tsx가 있던 탭 — 200이 새던 구성
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

    /**
     * 404의 `<title>`·`lang`·본문 언어. 이 경계들은 서로 다른 파일에서 오고(`[locale]/not-found.tsx`
     * 는 `[symbol]` 레이아웃의 `notFound()`, 루트 `not-found.tsx`는 매칭 실패) 둘 다 로케일을
     * 알아야 한다. 예전에는 존재하지 않는 심볼의 제목이 티커를 단 정상 페이지 제목이었고
     * (`generateMetadata`가 noindex 메타데이터를 돌려줬다), 매칭 실패 404는 ko·en 병기였다.
     */
    const TITLE_CASES = [
        {
            url: '/INVALIDTICKER1',
            title: '페이지를 찾을 수 없습니다 | Siglens',
        },
        { url: '/foo/bar', title: '페이지를 찾을 수 없습니다 | Siglens' },
        { url: '/en/foo/bar', title: 'Page not found | Siglens' },
    ] as const;

    for (const { url, title } of TITLE_CASES) {
        test(`${url} 제목은 404 제목이다 — 티커·병기 제목이 아니다`, async ({
            page,
        }) => {
            const response = await page.goto(url);
            expect(response?.status()).toBe(404);

            await expect(page).toHaveTitle(title);
        });
    }

    test('/en/foo/bar는 영어 한 언어로만 렌더하고 html lang이 en이다', async ({
        page,
    }) => {
        await page.goto('/en/foo/bar');

        await expect(page.locator('html')).toHaveAttribute('lang', 'en');
        await expect(
            page.getByRole('heading', { name: 'Page not found' })
        ).toBeVisible();
        await expect(page.getByText('페이지를 찾을 수 없습니다')).toHaveCount(
            0
        );
    });

    /**
     * 루트 `not-found.tsx`는 `<html>`까지 직접 SSR한다 — JS 없이 받는 크롤러도 한국어 제목·본문·
     * 홈 링크를 본다(`[locale]/not-found.tsx`의 알려진 한계와 다른 점). 이 문서는 **정적**이라
     * 로케일·호스트와 무관하게 늘 한국어 · 메인 호스트 한 벌이고, 실제 로케일·호스트는
     * 하이드레이션 뒤 클라이언트 섬이 주소로 알아내 바꾼다(위 `/en/foo/bar` 단언은 그래서
     * 하이드레이션을 기다린다).
     */
    test('/foo/bar는 JS 없이도 본문과 홈 링크를 SSR한다', async ({
        request,
    }) => {
        const res = await request.get('/foo/bar');
        expect(res.status()).toBe(404);

        const html = await res.text();
        expect(html).toContain('<html lang="ko"');
        expect(html).toMatch(/<h1[^>]*>페이지를 찾을 수 없습니다<\/h1>/);
        expect(html).toMatch(/<a [^>]*href="\/"[^>]*>/);
    });

    test('SiglensAI 호스트의 없는 경로는 404이고, 하이드레이션 뒤 SIGLENS AI 문구로 바뀐다', async ({
        page,
    }) => {
        const response = await page.goto('http://ai.localhost:4300/foo/bar');
        expect(response?.status()).toBe(404);

        await expect(page).toHaveTitle(
            '페이지를 찾을 수 없습니다 | SIGLENS AI'
        );
        await expect(
            page.getByRole('link', { name: '새 대화 시작' })
        ).toBeVisible();
        // 메인 사이트의 시장 내비는 SiglensAI에 없다.
        await expect(page.getByRole('navigation')).toHaveCount(0);
    });
});

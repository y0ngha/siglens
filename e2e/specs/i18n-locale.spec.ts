import { test, expect } from '../support/fixtures';
import { LOCALE_SWITCHER_VISIBLE } from '@/shared/i18n/locales';

/**
 * 로케일 라우팅 스모크.
 *
 * ## 왜 이 스펙이 필요한가
 *
 * i18n 브랜치의 위험은 전부 **응답 헤더·상태 코드·리다이렉트 체인·렌더된
 * `<head>`**에 있는데, `yarn build`도 10,000개 넘는 단위 테스트도 실제 HTTP 요청을
 * 보내지 않는다. 실제로 세 건의 독립 감사가 잡은 결함이 모두 그 층에 있었다:
 *
 *  - `loading.tsx`의 서버 `useTranslations` → 모든 종목 페이지 500
 *    (빌드는 성공한다 — `[symbol]`은 요청 시점 생성이라 빌드가 렌더하지 않는다)
 *  - `/KO`(코카콜라)가 로케일 `ko`로 잡혀 홈으로 리다이렉트
 *  - 미들웨어가 `Link: rel=alternate hreflang`을 전 응답에 붙여 noindex 게이트 우회
 *  - `Set-Cookie: NEXT_LOCALE`이 캐시 대상 HTML에 붙어 CDN 캐시 무력화
 */
test.describe('로케일 라우팅', () => {
    test('종목 페이지가 로케일별로 200을 반환한다', async ({ page }) => {
        for (const path of ['/AAPL', '/en/AAPL', '/ja/AAPL']) {
            const res = await page.goto(path);
            expect(res?.status(), `${path} status`).toBe(200);
        }
    });

    test('로케일과 철자가 같은 티커가 살아 있다', async ({ page }) => {
        // `KO`는 코카콜라이고 sitemap에 실려 있다. next-intl이 로케일 접두사를
        // 대소문자 무시로 매칭하기 때문에 정확히 이 자리가 깨졌었다.
        const res = await page.goto('/KO');
        expect(res?.status()).toBe(200);
        expect(new URL(page.url()).pathname).toBe('/KO');
    });

    test('없는 심볼은 500이 아니라 404다', async ({ page }) => {
        const res = await page.goto('/ZZZZZZZZZ');
        expect(res?.status()).toBe(404);
    });

    test('기본 로케일 접두사는 정규화된다', async ({ page }) => {
        await page.goto('/ko/market');
        expect(new URL(page.url()).pathname).toBe('/market');
    });

    test('html lang이 로케일을 따른다', async ({ page }) => {
        await page.goto('/ja/market');
        await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
    });

    test('언어 스위처가 경로를 유지한 채 로케일을 바꾼다', async ({ page }) => {
        // 스위처는 현재 제품 결정으로 숨겨져 있다(한국어 고정). 라우팅·카탈로그·AI
        // 출력 언어는 그대로 살아 있으므로 위 테스트들이 계속 실질 위험을 지킨다.
        // `LOCALE_SWITCHER_VISIBLE`을 다시 켜면 이 테스트도 함께 살아난다.
        test.skip(
            !LOCALE_SWITCHER_VISIBLE,
            '언어 스위처가 숨김 상태 — LOCALE_SWITCHER_VISIBLE=false'
        );
        await page.goto('/market');
        // `<select>`가 아니라 팝오버 라디오그룹이다.
        await page.getByRole('button', { name: /언어|language/i }).click();
        await page
            .getByRole('radiogroup', { name: /언어|language/i })
            .getByRole('radio', { name: 'English' })
            .click();
        await page.waitForURL('**/en/market');
        await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    });

    test('hreflang Link 헤더를 내보내지 않는다', async ({ request }) => {
        // 게이트를 HTTP 계층에서 우회하던 자리. HTML의 hreflang은
        // `seoAlternates.ts`와 sitemap 한 곳에서만 나가야 한다.
        const res = await request.get('/AAPL');
        expect(res.headers()['link'] ?? '').not.toContain('hreflang');
    });

    test('캐시 대상 HTML에 로케일 쿠키를 굽지 않는다', async ({ request }) => {
        // `Set-Cookie`가 붙으면 Cloudflare가 HTML을 캐시하지 않는다.
        const res = await request.get('/', {
            headers: { 'Accept-Language': 'en-US,en;q=0.9' },
        });
        expect(res.headers()['set-cookie'] ?? '').not.toContain('NEXT_LOCALE');
    });

    test('비-기본 로케일 정적 페이지는 noindex다', async ({ page }) => {
        // 번역이 끝나기 전까지 색인되면 2026-07 thin-content 붕괴가 3개 언어로
        // 재현된다. 게이트는 `STATIC_INDEXABLE_LOCALES`다.
        await page.goto('/en/terms');
        await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
            'content',
            /noindex/
        );
    });
});

import { test, expect } from '../support/fixtures';
import { normalizeReactSsrText } from '../support/ssrText';

/**
 * `/email-report/sample` — 비회원이 정기 메일 리포트가 어떻게 오는지 미리 보는 공개 페이지.
 *
 * 로그인 없이 열리고(`/email-report` 설정 페이지와 달리 로그인으로 보내지 않는다), 색인하지
 * 않되 링크는 따라가게 둔다. 메일 본문은 스크립트 없는 샌드박스 iframe의 `srcdoc`에 들어 있어
 * SSR HTML에 그대로 실린다 — 크롤러가 빈 골격이 아니라 본문을 본다. 차트 이미지는 시세
 * 제공자 없이 고정 샘플 봉으로 그려지는 정적 라우트다(E2E는 FMP 키가 없는 환경이다).
 */
const SAMPLE_PATH = '/email-report/sample';
const IFRAME_TITLE = '메일 리포트 샘플 미리보기';
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47];

test.describe('email report sample', () => {
    test('SSR HTML carries the page copy, the sandboxed iframe and noindex,follow', async ({
        page,
    }) => {
        const res = await page.request.get(SAMPLE_PATH, { maxRedirects: 0 });
        expect(res.status()).toBe(200);

        const html = normalizeReactSsrText(await res.text());
        expect(html).toContain('이런 메일을 받아요');
        expect(html).toMatch(/<meta name="robots" content="noindex, follow"/);
        expect(html).toContain('rel="canonical"');
        expect(html).toContain(`title="${IFRAME_TITLE}"`);
        // 메일 본문(srcdoc 안에서 이스케이프된 HTML)이 SSR에 실려 있다 — 골격이 아니다.
        expect(html).toContain('sample-chart/NVDA');
        // 샌드박스에 스크립트 권한이 없다.
        const sandbox = /<iframe[^>]*sandbox="([^"]*)"/.exec(html)?.[1] ?? '';
        expect(sandbox).toContain('allow-popups');
        expect(sandbox).not.toContain('allow-scripts');
    });

    test('renders the iframe and the signup CTA without logging in', async ({
        page,
    }) => {
        await page.goto(SAMPLE_PATH);

        await expect(page).not.toHaveURL(/\/login/);
        await expect(
            page.getByRole('heading', { level: 1, name: '이런 메일을 받아요' })
        ).toBeVisible();
        await expect(page.getByTitle(IFRAME_TITLE)).toBeVisible();
        await expect(
            page.getByRole('link', { name: '회원가입하고 받아보기' })
        ).toHaveAttribute('href', '/signup');
    });

    for (const symbol of ['NVDA', 'AAPL']) {
        test(`/api/email-report/sample-chart/${symbol} serves a PNG`, async ({
            page,
        }) => {
            const res = await page.request.get(
                `/api/email-report/sample-chart/${symbol}`
            );
            expect(res.status()).toBe(200);
            expect(res.headers()['content-type']).toBe('image/png');
            const bytes = await res.body();
            expect(Array.from(bytes.subarray(0, 4))).toEqual(PNG_SIGNATURE);
        });
    }

    test('an unknown symbol has no sample chart', async ({ page }) => {
        const res = await page.request.get(
            '/api/email-report/sample-chart/MSFT'
        );
        expect(res.status()).toBe(404);
    });
});

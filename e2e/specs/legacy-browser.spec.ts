import { test, expect } from '../support/fixtures';

/**
 * 구형 브라우저 흉내 — 지원 대상인데 일부 표준 메서드가 없는 브라우저(Chrome 109의
 * `toSorted`·`toReversed`, iOS 15.0~15.3의 `at`·`findLast`·`Object.hasOwn`)에서도 페이지가
 * 깨지지 않는지 본다.
 *
 * 페이지 스크립트보다 먼저 도는 `addInitScript`로 그 메서드들을 지운다. 그러면 앱이 쓰는
 * 순간 `… is not a function`이 나는데, `instrumentation-client.ts`의
 * `installLegacyBrowserPolyfills`가 앱 코드보다 먼저 채워 두므로 오류가 없어야 한다.
 * 운영 로그의 `[client-error] RootRoute … toSorted is not a function`이 이 형태였다.
 */
const REMOVE_MODERN_METHODS = `
    for (const [target, name] of [
        [Array.prototype, 'toSorted'],
        [Array.prototype, 'toReversed'],
        [Array.prototype, 'toSpliced'],
        [Array.prototype, 'with'],
        [Array.prototype, 'findLast'],
        [Array.prototype, 'findLastIndex'],
        [Array.prototype, 'at'],
        [String.prototype, 'at'],
        [Object, 'hasOwn'],
    ]) {
        delete target[name];
    }
`;

const NOT_A_FUNCTION = /is not a function/;

test.describe('legacy browser without ES2022/ES2023 built-ins', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(REMOVE_MODERN_METHODS);
    });

    for (const { path, heading } of [
        { path: '/', heading: /주식과 코인 분석 서비스/ },
        { path: '/AAPL', heading: /AAPL/ },
    ]) {
        test(`${path} renders and hydrates without missing-method errors`, async ({
            page,
        }) => {
            const errors: string[] = [];
            page.on('pageerror', error => errors.push(error.message));
            page.on('console', message => {
                if (
                    message.type() === 'error' &&
                    NOT_A_FUNCTION.test(message.text())
                ) {
                    errors.push(message.text());
                }
            });

            await page.goto(path);

            await expect(
                page.getByRole('heading', { level: 1, name: heading })
            ).toBeVisible();
            // 하이드레이션까지 끝나야 클라이언트 모듈이 모두 평가된다 — 헤더 검색이 입력을 받는지로 본다.
            const search = page
                .getByRole('banner')
                .getByRole('combobox', { name: '종목 티커 검색' });
            await search.fill('ms');
            await expect(search).toHaveValue('ms');

            expect(errors).toEqual([]);
        });
    }
});

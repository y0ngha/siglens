import { test, expect } from '../support/fixtures';
import type { Page } from '@playwright/test';
import { getEmailDebug } from '../support/emailHelper';
import { LOCAL_STORAGE_WATCHLIST_KEY } from '@/shared/lib/storageKeys';

/**
 * 관심종목: 비회원이 홈 인기 종목 알약의 ★로 2개 담고, 헤더 ★·`/watchlist`에서 보는 흐름과,
 * 그 상태로 가입하면 랜딩(/portfolio)에서 병합 토스트가 뜨고 로컬이 비며 `/watchlist`가 서버 목록을
 * 그리는 흐름. AAPL만 asset_translations에 시드돼 있지만 병합은 getAssetInfo를 부르지 않으므로
 * MSFT도 그대로 들어간다.
 */
const SETTLE_TIMEOUT_MS = 15_000;

async function addFromHome(page: Page, symbols: string[]): Promise<void> {
    await page.goto('/');
    const popular = page.locator('#popular');
    for (const symbol of symbols) {
        const pill = popular
            .getByRole('listitem')
            .filter({ has: page.locator(`a[href="/${symbol}"]`) });
        const toggle = pill.getByRole('button', { name: /^관심종목: / });
        await expect(toggle).toHaveAttribute('aria-pressed', 'false', {
            timeout: SETTLE_TIMEOUT_MS,
        });
        await toggle.click();
        await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    }
    // 홈 "내 관심종목" 카드가 담은 개수로 관심 탭을 연다.
    await expect(
        page.getByRole('tab', { name: `관심 ${symbols.length}` })
    ).toHaveAttribute('aria-selected', 'true');
}

test.describe('watchlist (anonymous → signup merge)', () => {
    test.describe.configure({ timeout: 90_000 });

    test('guest saves two symbols on home and sees them in the header and on /watchlist', async ({
        page,
    }) => {
        await addFromHome(page, ['AAPL', 'MSFT']);
        await expect(
            page.getByRole('button', { name: '관심종목 열기, 2개' })
        ).toBeVisible();

        await page.goto('/watchlist');
        await expect(page).toHaveURL(/\/watchlist$/);
        await expect(
            page.getByRole('heading', { level: 1, name: '관심종목' })
        ).toBeVisible();

        const list = page.getByRole('list', { name: '관심종목 목록' });
        await expect(list.getByRole('listitem')).toHaveCount(2, {
            timeout: SETTLE_TIMEOUT_MS,
        });
        await expect(list.locator('a[href="/AAPL"]')).toBeVisible();
        // 비회원에게는 "보유로 전환"이 없다.
        await expect(
            list.getByRole('button', { name: /보유로 전환/ })
        ).toHaveCount(0);

        const stored = await page.evaluate(
            key => localStorage.getItem(key),
            LOCAL_STORAGE_WATCHLIST_KEY
        );
        expect(stored).toContain('AAPL');

        // 보유종목은 /portfolio가 따로 맡고, 비회원에게는 가입 카드를 보여 준다.
        await page.goto('/portfolio');
        await expect(
            page.getByRole('heading', { level: 1, name: '내 포트폴리오' })
        ).toBeVisible();
        await expect(page.getByTestId('portfolio-signup-cta')).toBeVisible();
    });

    test('signing up with local symbols merges them and shows the toast on the landing page', async ({
        page,
    }) => {
        await addFromHome(page, ['AAPL', 'MSFT']);

        const email = `e2e-watchlist-${Date.now()}@test.com`;
        await page.goto('/signup');
        await page.getByLabel('이메일').fill(email);
        await page.getByRole('button', { name: '인증 코드 받기' }).click();
        const codeField = page.getByLabel('인증 코드');
        await expect(codeField).toBeVisible({ timeout: SETTLE_TIMEOUT_MS });
        const debug = await getEmailDebug(email);
        expect(debug?.code).toMatch(/^\d{6}$/);
        await codeField.fill(debug!.code!);
        await page.getByRole('button', { name: '코드 확인' }).click();
        const passwordField = page.getByLabel('비밀번호', { exact: true });
        await expect(passwordField).toBeVisible({ timeout: SETTLE_TIMEOUT_MS });
        await passwordField.fill('E2eWatchlist1!');
        await page.getByLabel('모두 동의').check();
        await page.getByRole('button', { name: '회원가입' }).click();

        // 가입 기본 랜딩은 /portfolio(resolvePostSignupDestination). 병합 토스트는 여기서 뜬다.
        await page.waitForURL(/\/portfolio$/, { timeout: SETTLE_TIMEOUT_MS });
        const status = page
            .getByRole('status')
            .filter({ hasText: '계정으로 가져왔어요' });
        await expect(status).toContainText(
            '관심종목 2개를 계정으로 가져왔어요',
            { timeout: SETTLE_TIMEOUT_MS }
        );
        await expect(
            status.getByRole('link', { name: '관심종목 보기' })
        ).toHaveAttribute('href', '/watchlist');

        // 서버 목록으로 바뀌었고 로컬은 비었다.
        await page.goto('/watchlist');
        const list = page.getByRole('list', { name: '관심종목 목록' });
        await expect(list.getByRole('listitem')).toHaveCount(2, {
            timeout: SETTLE_TIMEOUT_MS,
        });
        await expect(
            list.getByRole('button', { name: 'AAPL 보유로 전환' })
        ).toBeVisible();
        await expect
            .poll(() =>
                page.evaluate(
                    key => localStorage.getItem(key),
                    LOCAL_STORAGE_WATCHLIST_KEY
                )
            )
            .toBeNull();

        // 종목 헤더 ☆는 회원 목록을 반영한다.
        await page.goto('/AAPL');
        await expect(
            page.getByRole('button', { name: /^관심종목: / })
        ).toHaveAttribute('aria-pressed', 'true', {
            timeout: SETTLE_TIMEOUT_MS,
        });
    });
});

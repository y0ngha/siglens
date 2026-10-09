import { test, expect } from '../support/fixtures';
import type { Page } from '@playwright/test';
import { getEmailDebug } from '../support/emailHelper';
import { LOCAL_STORAGE_WATCHLIST_KEY } from '@/shared/lib/storageKeys';

/**
 * 관심종목(2026-10-09 설계 §9 E2E): 비회원이 홈에서 2개 담고 /portfolio("내 종목")에서 보는 흐름과,
 * 그 상태로 가입하면 랜딩(/portfolio)에서 병합 토스트가 뜨고 로컬이 비는 흐름.
 * AAPL만 asset_translations에 시드돼 있지만 병합은 getAssetInfo를 부르지 않으므로 MSFT도 그대로 들어간다.
 */
const ONBOARDING_HEADING = '관심 종목부터 담아 보세요';
const ADD_LABEL = '관심종목에 담기';
const REMOVE_LABEL = '관심종목에서 빼기';
const SETTLE_TIMEOUT_MS = 15_000;

async function addFromHome(page: Page, symbols: string[]): Promise<void> {
    await page.goto('/');
    const block = page.getByRole('region', { name: ONBOARDING_HEADING });
    await expect(block).toBeVisible();
    for (const symbol of symbols) {
        const tile = block.getByRole('listitem').filter({ hasText: symbol });
        await tile.getByRole('button', { name: ADD_LABEL }).click();
        await expect(
            tile.getByRole('button', { name: REMOVE_LABEL })
        ).toHaveAttribute('aria-pressed', 'true');
    }
    await expect(
        block.getByText(`담은 종목 ${symbols.length}개`)
    ).toBeVisible();
}

test.describe('watchlist (anonymous → signup merge)', () => {
    test.describe.configure({ timeout: 90_000 });

    test('guest saves two symbols on home and sees them on /portfolio without a login redirect', async ({
        page,
    }) => {
        await addFromHome(page, ['AAPL', 'MSFT']);

        await page.goto('/portfolio');
        await expect(page).toHaveURL(/\/portfolio$/);
        await expect(
            page.getByRole('heading', { level: 1, name: '내 종목' })
        ).toBeVisible();
        await expect(page.getByTestId('portfolio-signup-cta')).toBeVisible();

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
            status.getByRole('link', { name: '내 종목 보기' })
        ).toBeVisible();

        // 서버 목록으로 바뀌었고 로컬은 비었다.
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
            page.getByRole('button', { name: REMOVE_LABEL })
        ).toHaveAttribute('aria-pressed', 'true', {
            timeout: SETTLE_TIMEOUT_MS,
        });
    });
});

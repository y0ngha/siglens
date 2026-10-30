import { test, expect } from '../support/fixtures';
import { E2E_FORCE_ANALYSIS_ERROR_COOKIE } from '@/shared/api/e2eAnalysisStub';

/**
 * Widget resilience (`/AAPL/options`) — error boundary → retry → recovery.
 *
 * The options AI-analysis card is isolated in a react-error-boundary
 * (OptionsPageClient → ErrorBoundary → OptionsAiAnalysisError, with a "다시 시도"
 * wired to the hook's retry). Triggering its failure deterministically under E2E
 * is otherwise hard — the analysis short-circuits to a cached fixture server-side
 * and network interception of the server-action POST races. So the submit action
 * honors a force-error cookie under E2E_TEST (see e2eAnalysisStub
 * `E2E_FORCE_ANALYSIS_ERROR_COOKIE` / `e2eForcedOptionsError`): with the cookie
 * set it returns a transient error, without it the cached fixture.
 *
 * The options card always renders under E2E (FakeOptionsDataProvider seeds a
 * non-zero-OI snapshot → never oiStale), so this is deterministic without a
 * frozen clock. Chromium-only desktop interaction check.
 *
 * The force-error cookie name is imported from the stub (single source of truth)
 * rather than mirrored as a literal.
 */
/**
 * 강제 오류 스텁은 `no_chains_error`를 돌려준다 — 오류 카드는 훅이 만든 원인 문구(옵션 없음)를 보인다.
 */
const OPTIONS_ANALYSIS_ERROR = '분석할 옵션 데이터가 없습니다.';

test.describe('widget resilience', () => {
    test('options analysis error boundary recovers via retry', async ({
        page,
        context,
    }) => {
        await context.addCookies([
            {
                name: E2E_FORCE_ANALYSIS_ERROR_COOKIE,
                value: '1',
                url: 'http://localhost:4300',
            },
        ]);

        await page.goto('/AAPL/options');

        await expect(page.getByText(OPTIONS_ANALYSIS_ERROR)).toBeVisible();

        // 에러는 한 위젯에 격리된다 — 페이지 탭 네비게이션은 여전히 살아 있다.
        await expect(
            page.getByRole('navigation', { name: '분석 종류' })
        ).toBeVisible();

        // 쿠키를 비워야 재시도가 강제 에러 대신 캐시 픽스처로 복구된다.
        await context.clearCookies({ name: E2E_FORCE_ANALYSIS_ERROR_COOKIE });
        await page.getByRole('button', { name: '다시 시도' }).click();

        await expect(page.getByText(OPTIONS_ANALYSIS_ERROR)).toHaveCount(0);
    });
});

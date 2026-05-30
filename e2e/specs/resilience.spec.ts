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
const OPTIONS_ANALYSIS_ERROR =
    '옵션 분석을 가져오지 못했어요. 잠시 후 다시 시도해주세요.';

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

        // 1) 강제 실패 → 격리된 에러 fallback이 노출된다.
        await expect(page.getByText(OPTIONS_ANALYSIS_ERROR)).toBeVisible();

        // 에러는 한 위젯에 격리된다 — 페이지 탭 네비게이션은 여전히 살아 있다.
        await expect(
            page.getByRole('navigation', { name: '분석 종류' })
        ).toBeVisible();

        // 2) 쿠키 제거 → 재시도하면 캐시 픽스처로 복구된다.
        await context.clearCookies({ name: E2E_FORCE_ANALYSIS_ERROR_COOKIE });
        await page.getByRole('button', { name: '다시 시도' }).click();

        await expect(page.getByText(OPTIONS_ANALYSIS_ERROR)).toHaveCount(0);
    });
});

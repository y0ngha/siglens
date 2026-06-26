import { test, expect } from '../support/fixtures';
import {
    E2E_FORCE_FINANCIALS_ERROR_COOKIE,
    E2E_FORCE_CONGRESS_ERROR_COOKIE,
} from '@/shared/api/e2eAnalysisStub';

/**
 * AI 탭 위젯 회복성 (financials / congress) — 에러 바운더리 → 재시도 → 복구.
 *
 * E2E_FORCE_*_ERROR_COOKIE seam을 사용해 결정적으로 실패를 주입한다.
 * options 탭은 e2e/specs/resilience.spec.ts에서 이미 커버됨.
 *
 * 지원 seam 현황 (e2eAnalysisStub.ts 기준):
 *   - options:    E2E_FORCE_ANALYSIS_ERROR_COOKIE  → resilience.spec.ts
 *   - financials: E2E_FORCE_FINANCIALS_ERROR_COOKIE → 이 파일
 *   - congress:   E2E_FORCE_CONGRESS_ERROR_COOKIE  → 이 파일
 *   - overall / fundamental / news / chat:
 *       대응하는 force-error 쿠키 seam이 아직 없다.
 *       이들 탭의 에러 경로는 E2E 환경에서 항상 캐시 픽스처를 반환하므로
 *       결정적 실패 주입이 불가능하다.
 *       seam 추가 후 여기에 케이스를 보충한다.
 *
 * 에러 격리 검증: 에러 발생 시 탭 네비게이션(분석 종류 nav)이 살아 있어야 한다.
 */

test.describe('financials AI summary — error boundary recovery', () => {
    test('financials analysis error boundary recovers via retry', async ({
        page,
        context,
    }) => {
        // financials 에러 쿠키를 설정해 submitFinancialsAnalysisAction이
        // e2eForcedFinancialsError()를 반환하도록 강제한다.
        await context.addCookies([
            {
                name: E2E_FORCE_FINANCIALS_ERROR_COOKIE,
                value: '1',
                url: 'http://localhost:4300',
            },
        ]);

        await page.goto('/AAPL/financials');

        // 에러 바운더리가 fallback(FinancialsAiSummaryError)을 렌더할 때까지 기다린다.
        // 주의: 헤딩 'AI 재무제표 분석'은 로딩/성공 상태에도 존재하므로 에러 렌더의
        // 결정적 신호가 아니다 — 분석은 client hook이 hydration 후 비동기로 가져오므로,
        // 헤딩만 기다리고 쿠키를 비우면 액션이 실행되기 전에 쿠키가 사라져 정상 픽스처가
        // 렌더되는 레이스가 발생한다. 에러 전용 신호인 '다시 시도' 버튼을 기다려야 한다.
        await expect(
            page.getByRole('button', { name: '다시 시도' })
        ).toBeVisible();

        // 에러는 한 위젯에 격리된다 — 탭 네비게이션은 여전히 살아 있다.
        await expect(
            page.getByRole('navigation', { name: '분석 종류' })
        ).toBeVisible();

        // 쿠키를 비워 재시도 시 캐시 픽스처로 복구되도록 준비한다.
        await context.clearCookies({ name: E2E_FORCE_FINANCIALS_ERROR_COOKIE });
        await page.getByRole('button', { name: '다시 시도' }).click();

        // 재시도 후 에러 바운더리 fallback이 사라져야 한다.
        // (에러 섹션이 여전히 있으면 재시도가 실패한 것)
        await expect(
            page.getByRole('button', { name: '다시 시도' })
        ).toHaveCount(0);
    });
});

test.describe('congress AI trend — error boundary recovery', () => {
    test('congress trend error boundary recovers via retry', async ({
        page,
        context,
    }) => {
        // congress 에러 쿠키를 설정해 submitCongressTrendAction이
        // e2eForcedCongressError()를 반환하도록 강제한다.
        await context.addCookies([
            {
                name: E2E_FORCE_CONGRESS_ERROR_COOKIE,
                value: '1',
                url: 'http://localhost:4300',
            },
        ]);

        await page.goto('/AAPL/congress');

        // 에러 바운더리가 fallback(CongressTrendSummaryError)을 렌더할 때까지 기다린다.
        // 주의: 헤딩 'AI 동향 해석'은 로딩/성공 상태에도 존재하므로 에러 렌더의 결정적
        // 신호가 아니다 — 분석은 client hook이 hydration 후 비동기로 가져오므로, 헤딩만
        // 기다리고 쿠키를 비우면 액션 실행 전에 쿠키가 사라져 정상 픽스처가 렌더되는
        // 레이스가 발생한다. 에러 전용 신호인 '다시 시도' 버튼을 기다려야 한다.
        await expect(
            page.getByRole('button', { name: '다시 시도' })
        ).toBeVisible();

        // 에러는 한 위젯에 격리된다 — 탭 네비게이션은 여전히 살아 있다.
        await expect(
            page.getByRole('navigation', { name: '분석 종류' })
        ).toBeVisible();

        // 쿠키를 비워 재시도 시 캐시 픽스처로 복구되도록 준비한다.
        await context.clearCookies({ name: E2E_FORCE_CONGRESS_ERROR_COOKIE });
        await page.getByRole('button', { name: '다시 시도' }).click();

        // 재시도 후 에러 바운더리 fallback이 사라져야 한다.
        await expect(
            page.getByRole('button', { name: '다시 시도' })
        ).toHaveCount(0);
    });
});

/**
 * ISR cold-gen 단언 — cache-busted 요청이 500이 아닌 200을 반환한다.
 *
 * /MSFT는 E2E seed에 없으므로(AAPL만 seed됨) 외부 API call 없이
 * getAssetInfoResilient가 degraded fallback을 반환한다 (PR #549 F2 fix).
 * ISR cold-gen이 500을 반환하면 DYNAMIC_SERVER_USAGE throw가 원인이다.
 *
 * 이 테스트는 symbol-seo.spec.ts의 "unseeded ticker degrades to 200 + noindex"
 * 와 동일한 URL을 사용하지만 목적이 다르다 — 저쪽은 robots 메타 + h1을 검증하고,
 * 이쪽은 HTTP 200 자체가 ISR cold-gen 안전성을 보증한다는 점을 명시적으로 단언한다.
 *
 * provider-outage degrade journey:
 * E2E 환경에서는 fake provider가 항상 주입돼 실제 FMP/LLM outage를 시뮬레이션하는
 * 결정적 seam이 없다. provider-outage 시나리오는 단위 테스트(FakeProvider 에러 주입)와
 * 수동 실증으로 커버한다.
 */
test.describe('ISR cold-gen safety', () => {
    test('unseeded symbol cold-gen stays 200, not 500', async ({ page }) => {
        // /MSFT: E2E seed 없음 + FMP key 없음 → getAssetInfoResilient가 degraded
        // fallback을 반환. ISR cold-gen이 200을 유지해야 한다 (500이면 DYNAMIC_SERVER_USAGE).
        const response = await page.request.get('/MSFT');
        expect(response.status()).toBe(200);

        // degraded 상태에서도 noindex가 설정돼 크롤러에 불완전한 콘텐츠가 색인되지 않는다.
        const html = await response.text();
        expect(html).toMatch(
            /<meta name="robots" content="noindex, nofollow"\/?>/
        );
    });
});

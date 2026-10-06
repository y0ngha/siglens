import { test, expect } from '../support/fixtures';
import {
    ANALYSIS_FIXTURE_SUMMARY_PREFIX,
    ANALYSIS_RENDER_TIMEOUT_MS,
} from '../support/constants';
import { srhCommand } from '../support/srhClient';

/**
 * Analysis E2E: two branches that the cached-fixture happy path
 * (symbol-analysis.spec) does NOT exercise —
 *   1. bot UA parity (a crawler gets the same fixture body a human does), and
 *   2. the user-initiated force re-analysis branch (`handleReanalyze`).
 *
 * Both run against the E2E short-circuit in the SSE route
 * (`src/app/api/analysis/stream/route.ts`). No LLM round-trip, no external
 * browser request — the support/fixtures network guard enforces zero
 * non-app traffic.
 *
 * **2026-09-27: the E2E short-circuit is no longer bot-aware.** It used to
 * branch on `isBot(request.headers)` and return `{ status: 'miss_no_trigger' }`
 * for a crawler UA, which made `useAnalysis` flip `isBotBlocked` and
 * `ChartContent` render `BotBlockedNotice` — Googlebot then indexed that
 * notice instead of the real analysis (see the file-top invariant in
 * route.ts: "응답 본문은 User-Agent에 의존하지 않는다"). Now every UA takes the
 * same path and gets the same deterministic cached fixture.
 *
 * Render path reminder (see symbol-analysis.spec for the full write-up): the
 * SSR page always passes `initialAnalysisFailed={true}`, so on client mount
 * `useAnalysis` auto-submits without a `reanalyze` intent (so the server
 * derives `force=false`), and the cached fixture's `summary` only surfaces
 * after the ~9s progress-finishing animation (real `setTimeout`s — we do NOT
 * freeze the clock). This is now identical for a bot UA and a normal UA.
 */

// StaleAnalysisBanner (src/widgets/analysis/StaleAnalysisBanner.tsx) message —
// role="status". The fixture's analysis date is old, so the chart panel
// shows this banner (and its own "재분석" button) above the analysis body.
const STALE_BANNER_TEXT = 'AI 분석 결과가 오래됐어요';

// Standard Googlebot UA — used to prove bot/human parity, not to trigger a
// different branch (there is none left; see the file-top comment above).
const GOOGLEBOT_UA =
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

// 첫 캐시 히트(force=false) 직후 useAnalysis가 30s 캐시-히트 쿨다운을 걸어 재분석
// 버튼이 비활성화된다. 렌더(~9s) + 쿨다운 해제(~30s) + force 재렌더(~9s)를 모두
// 수용하도록 이 테스트만 타임아웃을 늘린다(기본 30s로는 부족).
const FORCE_REANALYZE_TEST_TIMEOUT_MS = 90_000;
// 30s 클라이언트 쿨다운이 0으로 카운트다운되어 버튼이 다시 클릭 가능해지기까지의 대기.
const REANALYZE_ENABLED_TIMEOUT_MS = 45_000;

/**
 * 재분석 쿨다운 Redis 키(`analysis:cooldown:<symbol>:<timeframe>`, 5분 TTL)를 비운다.
 *
 * 이 브랜치(feat/worker-removal-sse)에서 클라이언트(`useAnalysis`)는 쿨다운을 직접
 * 획득하지 않는다 — 획득은 SSE 라우트 서버 측에서만 수행한다. 또한 `isE2E()`가
 * true이면 라우트가 쿨다운 코드 도달 전에 단락(short-circuit)해 fixture를 반환한다.
 * 따라서 이 헬퍼가 지우는 키는 E2E 런 중에 `tryAcquireReanalyzeCooldown`을 막지
 * 않는다. 대신 **컨테이너가 런 사이에 유지**될 때 직전 비-E2E 테스트(또는 수동 개발
 * 실행)가 남긴 키를 비워 force-reanalyze 경로가 결정적으로 클린 상태에서 시작하도록
 * 보장한다. 공유 SRH 클라이언트를 통해 Node에서 직접 보내므로 브라우저 네트워크 가드에
 * 걸리지 않는다.
 */
async function clearReanalyzeCooldown(
    symbol: string,
    timeframe: string
): Promise<void> {
    await srhCommand(['DEL', `analysis:cooldown:${symbol}:${timeframe}`]);
}

test.describe('analysis jobs: bot parity + force re-analysis', () => {
    test.describe('bot UA parity (2026-09-27)', () => {
        // 봇 UA로 컨텍스트를 띄운다 — 예전엔 이게 SSE 라우트의 E2E 단락에서
        // miss_no_trigger를 반환시켰지만, 지금은 사람과 같은 경로를 탄다.
        test.use({ userAgent: GOOGLEBOT_UA });

        test('crawler User-Agent renders the same cached fixture a human gets', async ({
            page,
        }) => {
            await page.goto('/AAPL');

            // 사람 UA와 동일한 fixture summary가 렌더돼야 한다 — bot/human 본문
            // 동일성이 핵심 회귀 가드다. (봇 차단 안내 UI 자체가 삭제됐으므로
            // 그 부재는 더 이상 별도로 검증할 필요가 없다.)
            await expect(
                page
                    .getByText(ANALYSIS_FIXTURE_SUMMARY_PREFIX, {
                        exact: false,
                    })
                    .first()
            ).toBeVisible({ timeout: ANALYSIS_RENDER_TIMEOUT_MS });
        });
    });

    test.describe('force re-analysis', () => {
        // 일반(비-봇) 컨텍스트 — 기본 Desktop Chrome UA를 그대로 사용한다.
        test.beforeEach(async () => {
            // 기본 타임프레임은 1Day. 직전 런이 남긴 락을 비워 클릭이 새 force
            // mutation을 발동할 수 있게 한다.
            await clearReanalyzeCooldown('AAPL', '1Day');
        });

        test('force re-analysis re-renders the fixture analysis', async ({
            page,
        }) => {
            test.setTimeout(FORCE_REANALYZE_TEST_TIMEOUT_MS);

            await page.goto('/AAPL');

            // 초기 캐시 fixture가 렌더될 때까지 대기(진행 애니메이션 ~9s 포함).
            // 오프스크린 모바일 시트 사본과의 strict-mode 충돌을 피하려고 데스크톱
            // 분석 패널(이름 붙은 section — role="region", "AI 차트 분석")로 좁힌다.
            const fixtureSummary = page
                .getByRole('region', { name: 'AI 차트 분석' })
                .getByText(ANALYSIS_FIXTURE_SUMMARY_PREFIX, { exact: false });
            await expect(fixtureSummary).toBeVisible({
                timeout: ANALYSIS_RENDER_TIMEOUT_MS,
            });

            // fixture 분석 날짜가 과거라 StaleAnalysisBanner가 떠 있다. 그 배너
            // 안의 "재분석" 버튼을 정확히 겨냥한다(패널 하단에도 같은 라벨의 버튼이
            // 있어 status-banner로 스코프하지 않으면 strict-mode 위반).
            const reanalyzeButton = page
                .getByRole('status')
                .filter({ hasText: STALE_BANNER_TEXT })
                .getByRole('button', { name: '재분석', exact: true });

            // 첫 캐시 히트 직후 30s 클라이언트 쿨다운으로 버튼이 비활성화된다.
            // 쿨다운이 0으로 내려가 버튼이 다시 활성화될 때까지 기다린 뒤 클릭해
            // force 경로(force=true)를 실제로 태운다.
            await expect(reanalyzeButton).toBeEnabled({
                timeout: REANALYZE_ENABLED_TIMEOUT_MS,
            });
            await reanalyzeButton.click();

            // force 재분석이 시작되면 useAnalysis가 analysisResult를 null로 비워
            // analysis가 FALLBACK으로 돌아가고(hasNarrative=false), 패널이
            // TechnicalFactsSummary 자리표시자로 교체돼 fixture summary가 사라진다.
            // = 클릭이 실제로 새 분석을 발동했다는 증거.
            await expect(fixtureSummary).toBeHidden({
                timeout: ANALYSIS_RENDER_TIMEOUT_MS,
            });

            // 재분석 의도 제출은 E2E 단락에서 운영과 같은 생성 결과(`status: 'done'`,
            // `e2eGeneratedTechnical`)로 fixture를 반환한다. `cached`였다면 클라이언트가
            // 즉시 응답으로 보고 진행 화면 마무리를 건너뛰어 위 toBeHidden 창이 요청
            // 왕복 시간만큼으로 줄어든다. 진행 애니메이션이 끝난 뒤 fixture summary가
            // 다시 렌더돼야 한다(blank/stuck-loading이 아니라). force 경로가 끝까지
            // 동작했다는 증거.
            await expect(fixtureSummary).toBeVisible({
                timeout: ANALYSIS_RENDER_TIMEOUT_MS,
            });
        });
    });
});

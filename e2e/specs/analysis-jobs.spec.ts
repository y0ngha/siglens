import { test, expect } from '../support/fixtures';
import { ANALYSIS_FIXTURE_SUMMARY_PREFIX } from '../support/constants';
import { srhCommand } from '../support/srhClient';

/**
 * Analysis-jobs E2E: the two job-lifecycle branches that the cached-fixture
 * happy path (symbol-analysis.spec) does NOT exercise —
 *   1. the bot-blocked branch (`miss_no_trigger` → `BotBlockedNotice`), and
 *   2. the user-initiated force re-analysis branch (`handleReanalyze`).
 *
 * Both run against the E2E short-circuit in `submitAnalysisAction`, which is
 * bot-aware: under E2E_TEST=1 a crawler User-Agent yields the core
 * `{ status: 'miss_no_trigger' }` shape (mirroring prod's `skipEnqueueIfMiss`
 * + cache miss), while a normal UA yields the deterministic cached fixture.
 * No worker / LLM round-trip, no external browser request — the
 * support/fixtures network guard enforces zero non-app traffic.
 *
 * Render path reminder (see symbol-analysis.spec for the full write-up): the
 * SSR page always passes `initialAnalysisFailed={true}`, so on client mount
 * `useAnalysis` auto-runs `submitAnalysisAction(force=false)`. For a normal UA
 * that returns the cached fixture; the fixture `summary` only surfaces after
 * the ~9s progress-finishing animation (real `setTimeout`s — we do NOT freeze
 * the clock). For a bot UA it returns `miss_no_trigger`, and `useAnalysis`
 * flips `isBotBlocked` so `ChartContent` renders `BotBlockedNotice` instead.
 */

// BotBlockedNotice (src/shared/ui/BotBlockedNotice.tsx) — role="status",
// first line of its explanatory copy.
const BOT_BLOCKED_NOTICE_TEXT =
    '봇 트래픽으로 보여 분석 결과를 표시하지 않았어요.';

// StaleAnalysisBanner (src/widgets/analysis/StaleAnalysisBanner.tsx) message —
// also role="status". The fixture's analysis date is old, so the chart panel
// shows this banner (and its own "재분석" button) above the analysis body.
const STALE_BANNER_TEXT = 'AI 분석 결과가 오래됐어요';

// Standard Googlebot UA. Next.js' `userAgent({headers}).isBot` (which
// `src/shared/api/isBot.ts` delegates to) matches /Googlebot/i, so this is
// flagged as a bot and the E2E short-circuit returns `miss_no_trigger`.
const GOOGLEBOT_UA =
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

// 진행 마무리 애니메이션(~9s)이 끝난 뒤에야 fixture summary가 드러나므로 넉넉히 잡는다.
const ANALYSIS_RENDER_TIMEOUT_MS = 20_000;

// 첫 캐시 히트(force=false) 직후 useAnalysis가 30s 캐시-히트 쿨다운을 걸어 재분석
// 버튼이 비활성화된다. 렌더(~9s) + 쿨다운 해제(~30s) + force 재렌더(~9s)를 모두
// 수용하도록 이 테스트만 타임아웃을 늘린다(기본 30s로는 부족).
const FORCE_REANALYZE_TEST_TIMEOUT_MS = 90_000;
// 30s 클라이언트 쿨다운이 0으로 카운트다운되어 버튼이 다시 클릭 가능해지기까지의 대기.
const REANALYZE_ENABLED_TIMEOUT_MS = 45_000;

/**
 * 재분석 쿨다운은 Redis(`analysis:cooldown:<symbol>:<timeframe>`, 5분 TTL)에
 * 저장된다(@y0ngha/siglens-core reanalyzeCooldown). 컨테이너가 테스트 런 사이에
 * 유지되므로 직전 force 클릭의 락이 남아 `tryAcquireReanalyzeCooldown`이 실패하면
 * 클릭이 mutation을 발동하지 못한다. force 테스트가 결정적이도록 해당 키를 미리
 * 비운다. 공유 SRH 클라이언트(`../support/srhClient`)를 통해 Node(테스트 프로세스)
 * 에서 SRH로 직접 보내므로 page 네트워크 가드(브라우저 요청만 감시)에 걸리지 않고,
 * env 폴백(UPSTASH_REDIS_REST_URL/TOKEN)도 resetChatTokens와 동일하게 공유한다.
 */
async function clearReanalyzeCooldown(
    symbol: string,
    timeframe: string
): Promise<void> {
    await srhCommand(['DEL', `analysis:cooldown:${symbol}:${timeframe}`]);
}

test.describe('analysis jobs: bot-block + force re-analysis', () => {
    test.describe('bot-blocked notice', () => {
        // 봇 UA로 컨텍스트를 띄워 isBot()이 true가 되도록 한다 →
        // submitAnalysisAction E2E 단락이 miss_no_trigger를 반환 →
        // useAnalysis가 isBotBlocked=true → ChartContent가 BotBlockedNotice 렌더.
        test.use({ userAgent: GOOGLEBOT_UA });

        test('renders BotBlockedNotice for a crawler User-Agent', async ({
            page,
        }) => {
            await page.goto('/AAPL');

            // BotBlockedNotice는 role="status"로 렌더된다. StaleAnalysisBanner도
            // role="status"라 텍스트로 좁힌다. 이 notice의 존재가 곧 bot-aware
            // 단락이 작동했다는 증거다.
            const botNotice = page
                .getByRole('status')
                .filter({ hasText: BOT_BLOCKED_NOTICE_TEXT });
            await expect(botNotice.first()).toBeVisible({
                timeout: ANALYSIS_RENDER_TIMEOUT_MS,
            });

            // 봇 경로에서는 캐시 fixture가 절대 렌더되지 않아야 한다(단락이 cached가
            // 아닌 miss_no_trigger를 반환했음을 교차 검증).
            await expect(
                page.getByText(ANALYSIS_FIXTURE_SUMMARY_PREFIX, {
                    exact: false,
                })
            ).toHaveCount(0);
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
            // 분석 aside(role="complementary")로 좁힌다.
            const fixtureSummary = page
                .getByRole('complementary')
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

            // force 제출도 E2E 단락에서 cached fixture를 반환하므로, 재분석 진행
            // 애니메이션이 끝난 뒤 fixture summary가 다시 렌더돼야 한다
            // (blank/stuck-loading이 아니라). force 경로가 끝까지 동작했다는 증거.
            await expect(fixtureSummary).toBeVisible({
                timeout: ANALYSIS_RENDER_TIMEOUT_MS,
            });
        });
    });
});

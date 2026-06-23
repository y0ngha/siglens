import type { MockedFunction } from 'vitest';
/**
 * OverallContent done branch만 검증하는 테스트. hook은 mock 처리해
 * 다양한 state shape를 강제로 주입하고, 4축 layout(특히 OptionsSummary 위치,
 * IntegratedConclusion rename, ReanalyzeButton 노출 + amber 강조 조건)을 확인한다.
 */

// vi.mock은 vitest가 import 위로 hoist하지만, ESLint(import/first)와
// 가독성을 위해 소스 코드에서도 모든 import보다 위에 둔다.
//
// 대부분의 describe는 useOverallAnalysis를 mock해 임의 state shape를 주입하지만,
// 'OverallContent SSR seed' describe는 mockImplementation으로 실제 훅을 복원해
// initialAnalysis prop → done 서사로 흐르는 전체 경로를 검증한다(아래 참고).
vi.mock('@/widgets/overall/hooks/useOverallAnalysis', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@/widgets/overall/hooks/useOverallAnalysis')
        >();
    return {
        ...actual,
        useOverallAnalysis: vi.fn(),
    };
});
vi.mock('@/features/symbol-chat', () => ({
    usePublishSymbolChat: vi.fn(),
}));
vi.mock('@/widgets/symbol-page/hooks/useDefaultModelId', () => ({
    useDefaultModelId: vi.fn(() => 'gemini-2.5-flash-lite'),
}));
// /news와 동일 게이트 적용 — 두 훅을 단순화해 효과만 검증한다.
// useNewsAnalysisTrigger는 fire-and-forget mount effect이므로 no-op.
// useWaitForNewsCards는 prop으로 받은 initialReady를 그대로 isReady로 노출한다.
// barrel(@/widgets/news)을 mock — production이 barrel을 import하므로 일치 필요.
vi.mock('@/widgets/news', async importOriginal => ({
    ...(await importOriginal<typeof import('@/widgets/news')>()),
    useNewsAnalysisTrigger: vi.fn(),
    useWaitForNewsCards: vi.fn((_symbol: string, initiallyReady: boolean) => ({
        isReady: initiallyReady,
        pollError: null,
    })),
}));
// react-markdown은 ESM-only라 Jest 환경에서 직접 로드하면 실패한다. 본 테스트는
// markdown rendering이 아니라 OverallContent의 layout과 trigger 동작을 검증하므로
// MarkdownText를 단순 wrapper로 대체한다.
vi.mock('@/shared/ui/MarkdownText', () => ({
    MarkdownText: ({ children }: { children: ReactNode }) => (
        <div>{children}</div>
    ),
}));
// Server Action 묶음 — SSR seed describe가 실제 useOverallAnalysis를 사용할 때
// 훅이 import하는 server-only 체인을 끊기 위해 mock한다. seed(done) 경로에서는
// submitOverallAnalysisAction이 호출되지 않음을 검증한다.
vi.mock('@/entities/analysis/actions', () => ({
    submitOverallAnalysisAction: vi.fn(),
    pollOverallAnalysisAction: vi.fn(),
    pollAnalysisAction: vi.fn(),
    pollFundamentalAnalysisAction: vi.fn(),
    cancelAnalysisJobAction: vi.fn().mockResolvedValue(undefined),
    cancelFundamentalAnalysisJobAction: vi.fn().mockResolvedValue(undefined),
    cancelOverallAnalysisJobAction: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/entities/news-article/actions', () => ({
    pollNewsAnalysisAction: vi.fn(),
    cancelNewsAnalysisJobAction: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/entities/options-chain/actions', () => ({
    pollOptionsAnalysisAction: vi.fn(),
    cancelOptionsAnalysisJobAction: vi.fn().mockResolvedValue(undefined),
}));
// useSearchParams를 테스트별로 바꿀 수 있도록 mutable ref로 모킹한다(§18 tf 분기 검증용).
const { searchParamsRef } = vi.hoisted(() => ({
    searchParamsRef: { value: new URLSearchParams() },
}));
vi.mock('next/navigation', () => ({
    useSearchParams: () => searchParamsRef.value,
}));

import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { OverallAnalysisResponse } from '@y0ngha/siglens-core';

import { OverallContent } from '@/widgets/overall/OverallContent';
import { DEFAULT_TIMEFRAME } from '@/shared/config/market';
import { useOverallAnalysis } from '@/widgets/overall/hooks/useOverallAnalysis';
import { submitOverallAnalysisAction } from '@/entities/analysis/actions';
import { createQueryClientWrapper } from '@/__tests__/utils/createQueryClientWrapper';

const mockUseOverallAnalysis = useOverallAnalysis as MockedFunction<
    typeof useOverallAnalysis
>;
const mockSubmit = submitOverallAnalysisAction as MockedFunction<
    typeof submitOverallAnalysisAction
>;

function makeDoneResult(
    overrides: Partial<OverallAnalysisResponse> = {}
): OverallAnalysisResponse {
    return {
        headlineKo: '헤드라인',
        technicalBulletsKo: ['기술적 신호'],
        fundamentalBulletsKo: ['펀더멘털 신호'],
        newsBulletsKo: ['뉴스 신호'],
        optionsBulletsKo: ['감마 상승'],
        financialsBulletsKo: [],
        integratedConclusionKo: '통합 결론 텍스트',
        scenarios: [],
        riskFactorsKo: [],
        ...overrides,
    };
}

function mockDoneState(result: OverallAnalysisResponse, trigger = vi.fn()) {
    mockUseOverallAnalysis.mockReturnValue({
        state: { status: 'done', result },
        trigger,
    });
}

describe('OverallContent tf 쿼리 파라미터 처리 (§18 분기)', () => {
    beforeEach(() => {
        mockUseOverallAnalysis.mockReset();
        mockUseOverallAnalysis.mockReturnValue({
            state: { status: 'idle' },
            trigger: vi.fn(),
        });
        searchParamsRef.value = new URLSearchParams();
    });

    afterEach(() => {
        searchParamsRef.value = new URLSearchParams();
    });

    it('유효한 tf가 있으면 그 timeframe으로 useOverallAnalysis를 호출한다 (참 분기)', () => {
        searchParamsRef.value = new URLSearchParams('tf=1Hour');
        render(
            <OverallContent
                symbol="AAPL"
                companyName="Apple Inc."
                hasEnrichedNews={true}
            />
        );
        expect(mockUseOverallAnalysis).toHaveBeenCalledWith(
            'AAPL',
            'Apple Inc.',
            '1Hour',
            'gemini-2.5-flash-lite',
            undefined,
            'equity'
        );
    });

    it('유효하지 않은 tf는 DEFAULT_TIMEFRAME(1Day)으로 폴백한다 (거짓 분기)', () => {
        searchParamsRef.value = new URLSearchParams('tf=not-a-timeframe');
        render(
            <OverallContent
                symbol="AAPL"
                companyName="Apple Inc."
                hasEnrichedNews={true}
            />
        );
        expect(mockUseOverallAnalysis).toHaveBeenCalledWith(
            'AAPL',
            'Apple Inc.',
            DEFAULT_TIMEFRAME,
            'gemini-2.5-flash-lite',
            undefined,
            'equity'
        );
    });
});

describe('OverallContent non-done branches', () => {
    beforeEach(() => {
        mockUseOverallAnalysis.mockReset();
    });

    it('renders trigger CTA in idle state', () => {
        mockUseOverallAnalysis.mockReturnValue({
            state: { status: 'idle' },
            trigger: vi.fn(),
        });
        render(
            <OverallContent
                symbol="AAPL"
                companyName="Apple Inc."
                hasEnrichedNews={true}
            />
        );
        expect(
            screen.getByRole('button', { name: /AI 종합 분석 받기/ })
        ).toBeInTheDocument();
    });

    it('renders BotBlockedNotice in bot_blocked state', () => {
        mockUseOverallAnalysis.mockReturnValue({
            state: { status: 'bot_blocked' },
            trigger: vi.fn(),
        });
        render(
            <OverallContent
                symbol="AAPL"
                companyName="Apple Inc."
                hasEnrichedNews={true}
            />
        );
        expect(
            screen.getByText(/봇 트래픽으로 보여 분석 결과를 표시하지 않았어요/)
        ).toBeInTheDocument();
    });

    it('renders DependencyProgress in pending_dependencies state', () => {
        mockUseOverallAnalysis.mockReturnValue({
            state: {
                status: 'pending_dependencies',
                pendingJobs: {
                    technical: 'job-t',
                    fundamental: undefined,
                    news: 'job-n',
                    options: undefined,
                },
                retryCount: 2,
            },
            trigger: vi.fn(),
        });
        render(
            <OverallContent
                symbol="AAPL"
                companyName="Apple Inc."
                hasEnrichedNews={true}
            />
        );
        // DependencyProgress 헤딩(완료/총합 카운트)으로 렌더 확인. 2개 axis가
        // pending이므로 완료 2/4.
        expect(
            screen.getByRole('region', {
                name: /종합 분석에 필요한 데이터 수집 중/,
            })
        ).toBeInTheDocument();
        expect(screen.getByText(/2\/4/)).toBeInTheDocument();
    });

    it('renders submitting loading state', () => {
        mockUseOverallAnalysis.mockReturnValue({
            state: { status: 'submitting' },
            trigger: vi.fn(),
        });
        render(
            <OverallContent
                symbol="AAPL"
                companyName="Apple Inc."
                hasEnrichedNews={true}
            />
        );
        expect(screen.getByText('AI 종합 분석 요청 중…')).toBeInTheDocument();
    });

    it('renders polling loading state', () => {
        mockUseOverallAnalysis.mockReturnValue({
            state: { status: 'polling' },
            trigger: vi.fn(),
        });
        render(
            <OverallContent
                symbol="AAPL"
                companyName="Apple Inc."
                hasEnrichedNews={true}
            />
        );
        expect(screen.getByText('AI 종합 분석 생성 중…')).toBeInTheDocument();
    });

    it('renders error state with default message', () => {
        mockUseOverallAnalysis.mockReturnValue({
            state: { status: 'error', error: '분석 중 오류가 발생했습니다.' },
            trigger: vi.fn(),
        });
        render(
            <OverallContent
                symbol="AAPL"
                companyName="Apple Inc."
                hasEnrichedNews={true}
            />
        );
        expect(
            screen.getByText(/분석 중 오류가 발생했습니다/)
        ).toBeInTheDocument();
    });

    it('renders error state with custom error message', () => {
        mockUseOverallAnalysis.mockReturnValue({
            state: { status: 'error', error: '커스텀 에러' },
            trigger: vi.fn(),
        });
        render(
            <OverallContent
                symbol="AAPL"
                companyName="Apple Inc."
                hasEnrichedNews={true}
            />
        );
        expect(screen.getByText(/커스텀 에러/)).toBeInTheDocument();
    });

    it('renders error state with axis info', () => {
        mockUseOverallAnalysis.mockReturnValue({
            state: { status: 'error', error: '분석 오류', axis: 'technical' },
            trigger: vi.fn(),
        });
        render(
            <OverallContent
                symbol="AAPL"
                companyName="Apple Inc."
                hasEnrichedNews={true}
            />
        );
        expect(screen.getByText(/technical 축 실패/)).toBeInTheDocument();
    });

    it('renders retry button in error state that calls trigger', () => {
        const trigger = vi.fn();
        mockUseOverallAnalysis.mockReturnValue({
            state: { status: 'error', error: '오류' },
            trigger,
        });
        render(
            <OverallContent
                symbol="AAPL"
                companyName="Apple Inc."
                hasEnrichedNews={true}
            />
        );
        fireEvent.click(screen.getByText('다시 시도'));
        expect(trigger).toHaveBeenCalled();
    });
});

describe('OverallContent done branch', () => {
    beforeEach(() => {
        mockUseOverallAnalysis.mockReset();
    });

    it('TechnicalSummary와 FundamentalSummary 사이에 OptionsSummary를 렌더한다', () => {
        mockDoneState(makeDoneResult());
        render(
            <OverallContent
                symbol="AAPL"
                companyName="Apple Inc."
                hasEnrichedNews={true}
            />
        );
        // 헤딩 텍스트 순서를 DOM 순서로 비교
        const headings = screen
            .getAllByRole('heading')
            .map(h => h.textContent ?? '');
        const techIdx = headings.findIndex(t => t.includes('기술'));
        const optsIdx = headings.findIndex(t => t.includes('옵션 시장'));
        const fundIdx = headings.findIndex(t => t.includes('펀더멘털'));
        expect(techIdx).toBeGreaterThanOrEqual(0);
        expect(optsIdx).toBeGreaterThan(techIdx);
        expect(fundIdx).toBeGreaterThan(optsIdx);
    });

    it('IntegratedConclusion("통합 결론") 헤딩을 렌더한다 (3축 종합 결론 X)', () => {
        mockDoneState(makeDoneResult());
        render(
            <OverallContent
                symbol="AAPL"
                companyName="Apple Inc."
                hasEnrichedNews={true}
            />
        );
        expect(
            screen.getByRole('heading', { name: /통합 결론/ })
        ).toBeInTheDocument();
        expect(
            screen.queryByRole('heading', { name: /3축 종합 결론/ })
        ).not.toBeInTheDocument();
    });

    it('ReanalyzeButton(재분석)이 done 상태에서 노출된다', () => {
        mockDoneState(makeDoneResult());
        render(
            <OverallContent
                symbol="AAPL"
                companyName="Apple Inc."
                hasEnrichedNews={true}
            />
        );
        expect(
            screen.getByRole('button', { name: /재분석/ })
        ).toBeInTheDocument();
    });

    it('options bullets가 있고 OI가 stale이면 ReanalyzeButton을 ui-warning으로 강조한다', () => {
        mockDoneState(
            makeDoneResult({
                optionsBulletsKo: ['감마 상승'],
                optionsOiStale: true,
            })
        );
        render(
            <OverallContent
                symbol="AAPL"
                companyName="Apple Inc."
                hasEnrichedNews={true}
            />
        );
        const btn = screen.getByRole('button', { name: /재분석/ });
        expect(btn.className).toMatch(/ui-warning/);
    });

    it('options bullets가 비어 있으면 stale이어도 ReanalyzeButton을 강조하지 않는다', () => {
        mockDoneState(
            makeDoneResult({
                optionsBulletsKo: [],
                optionsOiStale: true,
            })
        );
        render(
            <OverallContent
                symbol="AAPL"
                companyName="Apple Inc."
                hasEnrichedNews={true}
            />
        );
        const btn = screen.getByRole('button', { name: /재분석/ });
        expect(btn.className).not.toMatch(/ui-warning/);
    });

    it('ReanalyzeButton 클릭 시 trigger를 호출한다', () => {
        const trigger = vi.fn();
        mockDoneState(makeDoneResult(), trigger);
        render(
            <OverallContent
                symbol="AAPL"
                companyName="Apple Inc."
                hasEnrichedNews={true}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: /재분석/ }));
        expect(trigger).toHaveBeenCalledTimes(1);
    });

    it('financialsBulletsKo가 있으면 재무 분석 섹션을 렌더한다', () => {
        mockDoneState(
            makeDoneResult({
                financialsBulletsKo: ['매출 성장 10%', '부채비율 개선'],
            })
        );
        render(
            <OverallContent
                symbol="AAPL"
                companyName="Apple Inc."
                hasEnrichedNews={true}
            />
        );
        expect(
            screen.getByRole('heading', { name: /재무 분석/ })
        ).toBeInTheDocument();
        expect(screen.getByText('매출 성장 10%')).toBeInTheDocument();
        expect(screen.getByText('부채비율 개선')).toBeInTheDocument();
    });

    it('financialsBulletsKo가 비어 있으면 재무 분석 섹션을 렌더하지 않는다', () => {
        mockDoneState(makeDoneResult({ financialsBulletsKo: [] }));
        render(
            <OverallContent
                symbol="AAPL"
                companyName="Apple Inc."
                hasEnrichedNews={true}
            />
        );
        expect(
            screen.queryByRole('heading', { name: /재무 분석/ })
        ).not.toBeInTheDocument();
    });
});

/**
 * OverallContent SSR seed 테스트. 위 describe들과 달리 useOverallAnalysis를
 * mock하지 않고 (mockImplementation으로 실제 훅을 복원해) initialAnalysis prop이
 * seed(done 상태)로 흐르는 전체 경로를 검증한다. Server Action은 모듈 상단에서
 * mock해 네트워크/server-only 의존을 차단한다.
 */
const SEED_RESULT: OverallAnalysisResponse = {
    headlineKo: 'AAPL 시드 헤드라인',
    technicalBulletsKo: ['기술적 신호'],
    fundamentalBulletsKo: ['펀더멘털 신호'],
    newsBulletsKo: ['뉴스 신호'],
    optionsBulletsKo: ['옵션 신호'],
    financialsBulletsKo: [],
    integratedConclusionKo: '통합 결론',
    scenarios: [],
    riskFactorsKo: [],
};

describe('OverallContent SSR seed', () => {
    beforeEach(async () => {
        mockSubmit.mockReset();
        // 실제 훅을 복원해 initialAnalysis → query.initialData → done 경로를 그대로 탄다.
        const actual = await vi.importActual<
            typeof import('@/widgets/overall/hooks/useOverallAnalysis')
        >('@/widgets/overall/hooks/useOverallAnalysis');
        mockUseOverallAnalysis.mockImplementation(actual.useOverallAnalysis);
    });

    afterEach(() => {
        // 다른 describe는 mockReturnValue로 state를 강제 주입하므로 실제 구현 복원이
        // 누수되지 않도록 reset한다.
        mockUseOverallAnalysis.mockReset();
    });

    it('initialAnalysis가 주어지면 done 서사(headline)를 즉시 렌더하고 생성을 트리거하지 않는다', () => {
        render(
            <OverallContent
                symbol="AAPL"
                companyName="Apple Inc."
                initialAnalysis={SEED_RESULT}
                hasEnrichedNews={true}
            />,
            { wrapper: createQueryClientWrapper().wrapper }
        );

        expect(screen.getByText('AAPL 시드 헤드라인')).toBeInTheDocument();
        expect(mockSubmit).not.toHaveBeenCalled();
    });

    it('initialAnalysis가 없으면 idle CTA(분석 받기)를 렌더한다', () => {
        render(
            <OverallContent
                symbol="AAPL"
                companyName="Apple Inc."
                hasEnrichedNews={true}
            />,
            {
                wrapper: createQueryClientWrapper().wrapper,
            }
        );

        expect(
            screen.getByRole('button', { name: /AI 종합 분석 받기/ })
        ).toBeInTheDocument();
    });
});

/**
 * /news와 동일한 순차 게이트(useNewsAnalysisTrigger + useWaitForNewsCards) 검증.
 *
 * 의도: 사용자가 /overall 첫 방문 시 새 뉴스가 fetch+개별 분석 진행 중에 종합 분석을
 * trigger하면 새 뉴스가 누락된 부분 결과로 종합 분석이 진행된다. /news는 이 race를
 * 막기 위해 enabled gate로 개별 완료를 기다리는데, /overall도 동일 패턴이 적용됐는지
 * 보장한다.
 *
 * - 마운트 시 useNewsAnalysisTrigger가 호출돼 백그라운드 fetch 시작
 * - useWaitForNewsCards(initially=false) 폴링 동안 CTA 버튼 disabled
 * - hasEnrichedNews=true(SSR이 1개라도 enriched로 본 경우) → 즉시 활성
 * - polling 중 pollError 발생 → error boundary로 전파(throw)
 */
describe('OverallContent — /news와 동일 순차 게이트 (useNewsAnalysisTrigger + useWaitForNewsCards)', () => {
    beforeEach(async () => {
        mockUseOverallAnalysis.mockReset();
        mockUseOverallAnalysis.mockReturnValue({
            state: { status: 'idle' },
            trigger: vi.fn(),
        });
        const { useNewsAnalysisTrigger, useWaitForNewsCards } =
            await import('@/widgets/news');
        (
            useNewsAnalysisTrigger as MockedFunction<
                typeof useNewsAnalysisTrigger
            >
        ).mockClear();
        // 기본 동작: prop으로 들어온 initialReady를 그대로 isReady로 반환
        (
            useWaitForNewsCards as MockedFunction<typeof useWaitForNewsCards>
        ).mockImplementation((_symbol: string, initiallyReady: boolean) => ({
            isReady: initiallyReady,
            pollError: null,
        }));
    });

    it('마운트 시 useNewsAnalysisTrigger가 symbol과 함께 호출된다 (/news와 동일 fire-and-forget trigger)', async () => {
        const { useNewsAnalysisTrigger } = await import('@/widgets/news');
        render(
            <OverallContent
                symbol="AAPL"
                companyName="Apple Inc."
                hasEnrichedNews={false}
            />
        );
        expect(useNewsAnalysisTrigger).toHaveBeenCalledWith('AAPL');
    });

    it('hasEnrichedNews=false(개별 분석 미완료)면 CTA 버튼이 disabled', () => {
        render(
            <OverallContent
                symbol="AAPL"
                companyName="Apple Inc."
                hasEnrichedNews={false}
            />
        );
        const btn = screen.getByRole('button', { name: /뉴스 카드 분석 중/ });
        expect(btn).toBeDisabled();
        // 안내 문구 + 예상 대기 시간 힌트 노출 — 사용자 경험 보장 (회귀 가드)
        expect(
            screen.getByText(
                /개별 뉴스 분석이 완료되면 자동으로 종합 분석을 받을 수 있어요/
            )
        ).toBeInTheDocument();
        expect(screen.getByText(/30초~1분 소요/)).toBeInTheDocument();
    });

    it('hasEnrichedNews=true(이미 enriched card 있음)면 CTA 버튼이 즉시 활성 (회귀 가드: 게이트가 정상 통과)', () => {
        render(
            <OverallContent
                symbol="AAPL"
                companyName="Apple Inc."
                hasEnrichedNews={true}
            />
        );
        const btn = screen.getByRole('button', { name: /AI 종합 분석 받기/ });
        expect(btn).not.toBeDisabled();
    });

    it('disabled 상태에서 버튼 클릭해도 useOverallAnalysis.trigger가 호출되지 않는다 (race 차단)', () => {
        const trigger = vi.fn();
        mockUseOverallAnalysis.mockReturnValue({
            state: { status: 'idle' },
            trigger,
        });
        render(
            <OverallContent
                symbol="AAPL"
                companyName="Apple Inc."
                hasEnrichedNews={false}
            />
        );
        const btn = screen.getByRole('button', { name: /뉴스 카드 분석 중/ });
        fireEvent.click(btn);
        // HTML disabled — 브라우저가 click event를 dispatch 안 함
        expect(trigger).not.toHaveBeenCalled();
    });

    it('useWaitForNewsCards가 pollError를 반환하면 inline alert fallback + 다시 시도 버튼을 렌더한다', async () => {
        const { useWaitForNewsCards } = await import('@/widgets/news');
        (
            useWaitForNewsCards as MockedFunction<typeof useWaitForNewsCards>
        ).mockReturnValue({
            isReady: false,
            pollError: new Error('polling exhausted'),
        });
        render(
            <OverallContent
                symbol="AAPL"
                companyName="Apple Inc."
                hasEnrichedNews={false}
            />
        );
        // role="alert" + 안내 문구로 사용자에게 회복 메시지 노출.
        // ErrorBoundary로 감싸지 않으므로 자체 fallback을 렌더해 페이지 crash를 막는다.
        const alert = screen.getByRole('alert');
        expect(alert).toBeInTheDocument();
        expect(
            screen.getByText(/뉴스 카드 분석 준비 중 오류가 발생했어요/)
        ).toBeInTheDocument();
        // 사용자 복구 동선: "다시 시도" 버튼이 노출돼야 한다 (회귀 가드)
        expect(
            screen.getByRole('button', { name: /다시 시도/ })
        ).toBeInTheDocument();
    });
});

/**
 * F1: crypto assetClass — OverallContent hides options/fundamental/financials sections,
 * and useOverallAnalysis is called with assetClass='crypto'.
 */
describe('OverallContent — crypto assetClass (F1 / UI Group 3)', () => {
    beforeEach(async () => {
        mockUseOverallAnalysis.mockReset();
        // Reset useWaitForNewsCards to the default (non-error) state so the
        // previous describe's pollError mock doesn't bleed into these tests.
        const { useWaitForNewsCards } = await import('@/widgets/news');
        (
            useWaitForNewsCards as MockedFunction<typeof useWaitForNewsCards>
        ).mockImplementation((_symbol: string, initiallyReady: boolean) => ({
            isReady: initiallyReady,
            pollError: null,
        }));
    });

    it('useOverallAnalysis를 assetClass=crypto로 호출한다', () => {
        mockUseOverallAnalysis.mockReturnValue({
            state: { status: 'idle' },
            trigger: vi.fn(),
        });
        render(
            <OverallContent
                symbol="BTCUSD"
                companyName="Bitcoin USD"
                hasEnrichedNews={false}
                assetClass="crypto"
            />
        );
        expect(mockUseOverallAnalysis).toHaveBeenCalledWith(
            'BTCUSD',
            'Bitcoin USD',
            DEFAULT_TIMEFRAME,
            'gemini-2.5-flash-lite',
            undefined, // initialAnalysis
            'crypto'
        );
    });

    it('done 상태에서 OptionsSummary를 렌더하지 않는다', () => {
        mockUseOverallAnalysis.mockReturnValue({
            state: {
                status: 'done',
                result: makeDoneResult({ optionsBulletsKo: ['옵션 신호'] }),
            },
            trigger: vi.fn(),
        });
        render(
            <OverallContent
                symbol="BTCUSD"
                companyName="Bitcoin USD"
                hasEnrichedNews={true}
                assetClass="crypto"
            />
        );
        expect(screen.queryByRole('heading', { name: /옵션 시장/ })).toBeNull();
    });

    it('done 상태에서 FundamentalSummary를 렌더하지 않는다', () => {
        mockUseOverallAnalysis.mockReturnValue({
            state: {
                status: 'done',
                result: makeDoneResult({
                    fundamentalBulletsKo: ['펀더멘털 신호'],
                }),
            },
            trigger: vi.fn(),
        });
        render(
            <OverallContent
                symbol="BTCUSD"
                companyName="Bitcoin USD"
                hasEnrichedNews={true}
                assetClass="crypto"
            />
        );
        expect(
            screen.queryByRole('heading', { name: /펀더멘털 분석 요약/ })
        ).toBeNull();
    });

    it('done 상태에서 FinancialsSummary를 렌더하지 않는다', () => {
        mockUseOverallAnalysis.mockReturnValue({
            state: {
                status: 'done',
                result: makeDoneResult({ financialsBulletsKo: ['재무 신호'] }),
            },
            trigger: vi.fn(),
        });
        render(
            <OverallContent
                symbol="BTCUSD"
                companyName="Bitcoin USD"
                hasEnrichedNews={true}
                assetClass="crypto"
            />
        );
        expect(
            screen.queryByRole('heading', { name: /^재무 분석$/ })
        ).toBeNull();
    });

    it('done 상태에서 TechnicalSummary와 NewsSummary는 렌더한다', () => {
        mockUseOverallAnalysis.mockReturnValue({
            state: {
                status: 'done',
                result: makeDoneResult({
                    technicalBulletsKo: ['기술적 신호'],
                    newsBulletsKo: ['뉴스 신호'],
                }),
            },
            trigger: vi.fn(),
        });
        render(
            <OverallContent
                symbol="BTCUSD"
                companyName="Bitcoin USD"
                hasEnrichedNews={true}
                assetClass="crypto"
            />
        );
        expect(
            screen.getByRole('heading', { name: /기술적 분석 요약/ })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('heading', { name: /뉴스 분석 요약/ })
        ).toBeInTheDocument();
    });
});

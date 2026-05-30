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
vi.mock('@/widgets/overall/hooks/useOverallAnalysis', () => ({
    useOverallAnalysis: vi.fn(),
}));
vi.mock('@/features/symbol-chat', () => ({
    usePublishSymbolChat: vi.fn(),
}));
vi.mock('@/widgets/symbol-page/hooks/useDefaultModelId', () => ({
    useDefaultModelId: vi.fn(() => 'gemini-2.5-flash-lite'),
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

import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { OverallAnalysisResponse } from '@y0ngha/siglens-core';

import { OverallContent } from '@/widgets/overall/OverallContent';
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
                timeframe="1Day"
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
                timeframe="1Day"
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
                timeframe="1Day"
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
                timeframe="1Day"
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
                timeframe="1Day"
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
                timeframe="1Day"
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
                timeframe="1Day"
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
                timeframe="1Day"
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
                timeframe="1Day"
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
                timeframe="1Day"
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
                timeframe="1Day"
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
                timeframe="1Day"
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
                timeframe="1Day"
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
                timeframe="1Day"
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
                timeframe="1Day"
            />
        );
        fireEvent.click(screen.getByRole('button', { name: /재분석/ }));
        expect(trigger).toHaveBeenCalledTimes(1);
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
                timeframe="1Day"
                initialAnalysis={SEED_RESULT}
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
                timeframe="1Day"
            />,
            { wrapper: createQueryClientWrapper().wrapper }
        );

        expect(
            screen.getByRole('button', { name: /AI 종합 분석 받기/ })
        ).toBeInTheDocument();
    });
});

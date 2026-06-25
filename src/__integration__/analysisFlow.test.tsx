import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ModelSelector } from '@/widgets/analysis/ModelSelector';
import { AnalysisPanel } from '@/widgets/analysis';
import type {
    AnalysisResponse,
    ClusteredKeyLevels,
    ModelId,
} from '@y0ngha/siglens-core';

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
    usePathname: () => '/AAPL',
    useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {}, sql: () => null })),
}));

vi.mock('@y0ngha/siglens-core', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@y0ngha/siglens-core')>();
    return {
        ...actual,
        isFreeModel: vi.fn(() => true),
    };
});

// usePopoverToggle는 mock하지 않고 실제 구현을 통과시킨다 — 드롭다운이
// 실제로 열려야 옵션 클릭이 onModelChange를 트리거할 수 있기 때문이다.

// AnalysisPanel을 실제로 렌더하기 위한 인프라 mock. trendUtils·
// buildExpertAnalysisReport·MarkdownText·@/shared/lib/trendline 등 핵심
// 렌더·계약 경로는 mock하지 않고 실제 구현을 통과시킨다.
vi.mock('@/shared/config/time', () => ({
    MS_PER_SECOND: 1000,
    SECONDS_PER_MINUTE: 60,
    MS_PER_MINUTE: 60000,
}));
vi.mock('@/shared/hooks/useCopyToClipboard', () => ({
    DEFAULT_RESET_MS: 2000,
}));
vi.mock('@/shared/lib/formatAnalyzedAt', () => ({
    formatAnalyzedAt: () => '1시간 전',
}));
vi.mock('@/entities/analysis', () => ({
    isAnalysisStale: () => false,
}));
vi.mock('@/widgets/analysis/AnalysisProgress', () => ({
    AnalysisProgress: () => <div data-testid="analysis-progress" />,
}));
vi.mock('@/widgets/analysis/AnalysisToast', () => ({
    AnalysisToast: () => null,
}));
vi.mock('@/widgets/analysis/AdBanner', () => ({
    AdBanner: () => null,
}));
vi.mock('@/widgets/analysis/StaleAnalysisBanner', () => ({
    StaleAnalysisBanner: () => null,
}));

// @y0ngha/siglens-core의 AnalysisResponse 타입에서 구성한 완전한 응답.
function makeFullAnalysis(): AnalysisResponse {
    return {
        summary: '중기 상승 추세가 유지되는 구간입니다.',
        trend: 'bullish',
        riskLevel: 'medium',
        indicatorResults: [
            {
                indicatorName: 'RSI',
                signals: [
                    {
                        type: 'skill',
                        trend: 'neutral',
                        strength: 'moderate',
                        description: 'RSI 58 — 중립 영역입니다.',
                    },
                ],
            },
        ],
        keyLevels: {
            support: [{ price: 200, reason: '20일선' }],
            resistance: [{ price: 220, reason: '직전 고점' }],
        },
        priceTargets: {
            bullish: {
                condition: '220 돌파 시',
                targets: [{ price: 235, basis: '측정 이동' }],
            },
            bearish: null,
        },
        patternSummaries: [
            {
                id: 'pattern-1',
                patternName: 'ascending_triangle',
                skillName: '상승 삼각형',
                detected: true,
                trend: 'bullish',
                summary: '돌파 가능성이 유지됩니다.',
                confidenceWeight: 0.92,
            },
        ],
        strategyResults: [],
        candlePatterns: [],
        trendlines: [
            {
                direction: 'ascending',
                start: { time: 1000, price: 180 },
                end: { time: 2000, price: 205 },
            },
        ],
        actionRecommendation: {
            positionAnalysis: '지지와 저항 사이에 위치합니다.',
            entry: '200 확인 후 분할 매수.',
            exit: '235 분할 청산.',
            riskReward: '손익비 1:2.5.',
            entryRecommendation: 'wait',
        },
        analyzedAt: '2025-01-01T00:00:00Z',
    };
}

function makeFullKeyLevels(): ClusteredKeyLevels {
    return {
        support: [
            {
                price: 200,
                reason: '20일선',
                count: 1,
                sources: [{ price: 200, reason: '20일선' }],
            },
        ],
        resistance: [
            {
                price: 220,
                reason: '직전 고점',
                count: 1,
                sources: [{ price: 220, reason: '직전 고점' }],
            },
        ],
    };
}

describe('Analysis Flow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders model selector in analysis panel', () => {
        render(
            <ModelSelector
                selectedModel={'gemini-2.5-flash-lite' as ModelId}
                onModelChange={vi.fn()}
                allowedModels={['gemini-2.5-flash-lite' as ModelId]}
            />
        );
        expect(screen.getByLabelText('AI 분석 모델 선택')).toBeInTheDocument();
    });

    it('calls onModelChange when the model selector is used', async () => {
        const onModelChange = vi.fn();
        render(
            <ModelSelector
                selectedModel={'gemini-2.5-flash-lite' as ModelId}
                onModelChange={onModelChange}
                allowedModels={[
                    'gemini-2.5-flash-lite' as ModelId,
                    'gemini-2.5-flash' as ModelId,
                ]}
            />
        );
        const user = userEvent.setup();
        await user.click(screen.getByLabelText('AI 분석 모델 선택'));

        const flashOption = screen
            .getAllByRole('option')
            .find(
                o =>
                    o.textContent?.includes('Flash') &&
                    !o.textContent?.includes('Lite')
            );
        await user.click(flashOption!);

        expect(onModelChange).toHaveBeenCalledTimes(1);
        expect(onModelChange).toHaveBeenCalledWith('gemini-2.5-flash');
    });

    // 실제 AnalysisPanel을 완전한 응답으로 렌더해 코어 출력 계약을
    // end-to-end로 단언한다(mock-theater 제거).
    it('renders the real AnalysisPanel with a full response (contract)', () => {
        render(
            <AnalysisPanel
                symbol="AAPL"
                analysis={makeFullAnalysis()}
                keyLevels={makeFullKeyLevels()}
                timeframe="1Day"
            />
        );

        expect(screen.getByText('AI 분석')).toBeInTheDocument();
        expect(
            screen.getByText('중기 상승 추세가 유지되는 구간입니다.')
        ).toBeInTheDocument();
        // 실제 라벨 맵을 통과한 추세선 라벨.
        expect(screen.getByText('추세선')).toBeInTheDocument();
        expect(screen.getByText('상승 추세선')).toBeInTheDocument();
        // 키레벨 가격(toLocaleString 포맷).
        expect(screen.getByText('220.00')).toBeInTheDocument();
        expect(screen.getByText('200.00')).toBeInTheDocument();
        // 패턴 아코디언.
        expect(screen.getByText('차트 패턴')).toBeInTheDocument();
        expect(screen.getByText('상승 삼각형')).toBeInTheDocument();
        // 보조지표.
        expect(screen.getByText('보조지표')).toBeInTheDocument();
        expect(screen.getByText('RSI')).toBeInTheDocument();
    });

    it('shows the loading indicator while analyzing', () => {
        render(
            <AnalysisPanel
                symbol="AAPL"
                analysis={makeFullAnalysis()}
                keyLevels={makeFullKeyLevels()}
                timeframe="1Day"
                showProgress={true}
            />
        );

        expect(screen.getByTestId('analysis-progress')).toBeInTheDocument();
        // 진행 중에는 본문 섹션이 숨겨진다.
        expect(screen.queryByText('추세선')).not.toBeInTheDocument();
    });

    it('expands a pattern accordion in the real panel', () => {
        render(
            <AnalysisPanel
                symbol="AAPL"
                analysis={makeFullAnalysis()}
                keyLevels={makeFullKeyLevels()}
                timeframe="1Day"
            />
        );

        fireEvent.click(screen.getByText('상승 삼각형'));
        expect(
            screen.getByText('돌파 가능성이 유지됩니다.')
        ).toBeInTheDocument();
    });
});

import { render, screen } from '@testing-library/react';
import { ShareableAnalysisProvider, useShareable } from '@/features/share';
import { OptionsAiAnalysis } from '@/widgets/options/OptionsAiAnalysis';
import type { OptionsAnalysisResponse } from '@y0ngha/siglens-core';

const mockState = vi.fn();

vi.mock('@/widgets/options/hooks/useOptionsAnalysis', () => ({
    useOptionsAnalysis: () => mockState(),
}));

vi.mock('@/shared/ui/BotBlockedNotice', () => ({
    BotBlockedNotice: () => <div data-testid="bot-blocked">Bot blocked</div>,
}));

vi.mock('@/widgets/options/OptionsAiAnalysisSkeleton', () => ({
    OptionsAiAnalysisSkeleton: () => <div data-testid="skeleton">Loading</div>,
}));

vi.mock('@/widgets/options/OptionsAiAnalysisError', () => ({
    OptionsAiAnalysisError: () => <div data-testid="error">Error</div>,
}));

vi.mock('@/shared/lib/cn', () => ({
    cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

vi.mock('@/shared/lib/formatAnalyzedAt', () => ({
    formatAnalyzedAt: (d: string) => d,
}));

const RESULT: OptionsAnalysisResponse = {
    summary: 'Bullish options flow',
    perExpiration: [
        {
            expirationDate: '2025-06-20',
            tone: 'bullish' as const,
            commentary: 'Heavy call buying',
        },
    ],
    signals: [
        {
            kind: 'bullish' as const,
            message: 'Large call sweeps detected',
        },
    ],
    analyzedAt: '2025-01-15T10:00:00Z',
};

describe('OptionsAiAnalysis', () => {
    /**
     * 스냅샷 프로즈가 보이는 동안에도 위젯은 마운트된 채 `hideView`로 UI만 끈다.
     * 언마운트하면 `useRegisterShareable`이 돌지 않아 헤더 공유 버튼이 이 탭의
     * 분석 결과를 등록받지 못한다 (review round 2 fix).
     */
    describe('hideView', () => {
        it('UI를 렌더하지 않는다', () => {
            mockState.mockReturnValue({ status: 'loading', trigger: vi.fn() });

            const { container } = render(
                <OptionsAiAnalysis
                    symbol="AAPL"
                    companyName="Apple"
                    expirationDate="all"
                    modelId="deepseek-v4.1-flash"
                    hideView
                />
            );

            expect(container).toBeEmptyDOMElement();
        });

        it('UI를 숨겨도 공유 데이터 등록은 계속된다', () => {
            mockState.mockReturnValue({
                status: 'done',
                result: RESULT,
                trigger: vi.fn(),
            });

            function Probe() {
                const reg = useShareable();
                return (
                    <div data-testid="probe">
                        {reg === null ? 'NULL' : reg.kind}
                    </div>
                );
            }

            render(
                <ShareableAnalysisProvider>
                    <OptionsAiAnalysis
                        symbol="AAPL"
                        companyName="Apple"
                        expirationDate="all"
                        modelId="deepseek-v4.1-flash"
                        hideView
                    />
                    <Probe />
                </ShareableAnalysisProvider>
            );

            expect(screen.getByTestId('probe').textContent).toBe('options');
        });
    });

    afterEach(() => {
        mockState.mockReset();
    });

    it('renders skeleton during loading', () => {
        mockState.mockReturnValue({ status: 'loading', trigger: vi.fn() });
        render(
            <OptionsAiAnalysis
                symbol="AAPL"
                companyName="Apple"
                expirationDate="2025-06-20"
                modelId={'gemini-3.5-flash-lite'}
            />
        );
        expect(screen.getByTestId('skeleton')).toBeInTheDocument();
    });

    it('renders bot blocked notice', () => {
        mockState.mockReturnValue({ status: 'bot_blocked', trigger: vi.fn() });
        render(
            <OptionsAiAnalysis
                symbol="AAPL"
                companyName="Apple"
                expirationDate="2025-06-20"
                modelId={'gemini-3.5-flash-lite'}
            />
        );
        expect(screen.getByTestId('bot-blocked')).toBeInTheDocument();
    });

    it('renders error state', () => {
        mockState.mockReturnValue({
            status: 'error',
            error: new Error('fail'),
            retry: vi.fn(),
            trigger: vi.fn(),
        });
        render(
            <OptionsAiAnalysis
                symbol="AAPL"
                companyName="Apple"
                expirationDate="2025-06-20"
                modelId={'gemini-3.5-flash-lite'}
            />
        );
        expect(screen.getByTestId('error')).toBeInTheDocument();
    });

    it('renders analysis result with summary and signals', () => {
        mockState.mockReturnValue({
            status: 'done',
            result: RESULT,
            trigger: vi.fn(),
        });
        render(
            <OptionsAiAnalysis
                symbol="AAPL"
                companyName="Apple"
                expirationDate="2025-06-20"
                modelId={'gemini-3.5-flash-lite'}
            />
        );
        expect(screen.getByText('Bullish options flow')).toBeInTheDocument();
        expect(screen.getByText('Heavy call buying')).toBeInTheDocument();
        expect(
            screen.getByText('Large call sweeps detected')
        ).toBeInTheDocument();
    });
});

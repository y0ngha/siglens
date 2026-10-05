import { render, screen } from '@testing-library/react';
import { OptionsAiAnalysis } from '@/widgets/options/OptionsAiAnalysis';
import type { OptionsAnalysisResponse } from '@y0ngha/siglens-core';
import {
    ShareableAnalysisProvider,
    useShareable,
} from '@/features/share/model/ShareableAnalysisContext';

const mockState = vi.fn();

const { mockUseAiAutoRunAllowed } = vi.hoisted(() => ({
    mockUseAiAutoRunAllowed: vi.fn(() => ({ allowed: true, grant: vi.fn() })),
}));
vi.mock('@/features/symbol-model/hooks/useAiAutoRunAllowed', () => ({
    useAiAutoRunAllowed: mockUseAiAutoRunAllowed,
}));
vi.mock('@/widgets/options/hooks/useOptionsAnalysis', () => ({
    useOptionsAnalysis: () => mockState(),
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

    it('renders nothing for cache_miss (cacheOnly cache miss)', () => {
        mockState.mockReturnValue({ status: 'cache_miss', trigger: vi.fn() });
        const { container } = render(
            <OptionsAiAnalysis
                symbol="AAPL"
                companyName="Apple"
                expirationDate="2025-06-20"
                modelId={'gemini-3.5-flash-lite'}
            />
        );
        expect(container).toBeEmptyDOMElement();
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

    describe('분석 기준(스냅샷 수집 시각) 캡션', () => {
        const renderDone = (
            extra: Partial<React.ComponentProps<typeof OptionsAiAnalysis>>
        ) => {
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
                    {...extra}
                />
            );
        };

        it('직전 정규장 스냅샷으로 분석했다면 수집 시각(KST)을 밝힌다', () => {
            // 20:00 UTC = 다음 날 05:00 KST.
            renderDone({
                snapshotCapturedAt: '2025-06-13T20:00:00.000Z',
                showSnapshotBasis: true,
            });
            expect(
                screen.getByText(
                    /분석 기준: 직전 정규장 옵션 데이터 · .*6월 14일.*05:00 KST 수집/
                )
            ).toBeInTheDocument();
        });

        it('showSnapshotBasis가 꺼져 있으면(정규장 중·서버 렌더) 캡션이 없다', () => {
            renderDone({
                snapshotCapturedAt: '2025-06-13T20:00:00.000Z',
                showSnapshotBasis: false,
            });
            expect(screen.queryByText(/분석 기준/)).toBeNull();
        });

        it('수집 시각이 잘못된 값이면 캡션 없이 결과만 그린다', () => {
            renderDone({
                snapshotCapturedAt: 'not-a-date',
                showSnapshotBasis: true,
            });
            expect(screen.queryByText(/분석 기준/)).toBeNull();
            expect(
                screen.getByText('Bullish options flow')
            ).toBeInTheDocument();
        });
    });
});

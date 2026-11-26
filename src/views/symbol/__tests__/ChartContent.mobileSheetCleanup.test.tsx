import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { memo, StrictMode, useCallback, type ReactNode } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import type { AnalysisResponse } from '@y0ngha/siglens-core';
import { buildFallbackAnalysis } from '@/entities/analysis/lib/fallbackAnalysis';
import { catalogTranslator } from '@/shared/test-utils/catalogTranslator';
import { ChartContent } from '../ChartContent';
import type { UseAnalysisResult } from '../hooks/useAnalysis';
import { useMobileSheet } from '../hooks/useMobileSheet';

// 시트 콘텐츠를 만들 수 있는 최소 분석 응답의 바탕.
const FALLBACK_ANALYSIS = buildFallbackAnalysis(
    catalogTranslator('entities.analysis.fallback', 'ko')('unavailable')
);

// 훅 stub은 호출마다 같은 참조를 돌려준다 — 새 객체를 만들면 콘텐츠 memo가 매 렌더 깨져 시트 갱신이 무한히 이어진다.
const stable = vi.hoisted(() => <T,>(make: () => T) => {
    let made = false;
    let value: T;
    return () => {
        if (!made) {
            value = make();
            made = true;
        }
        return value;
    };
});

// ChartContent를 DOM에서 돌리기 위한 최소 stub — 이 파일은 시트 등록·정리만 본다.
vi.mock('next/dynamic', () => ({
    default: () => () => null,
}));
vi.mock('@/widgets/chart/hooks/useChartSync', () => ({
    useChartSync: stable(() => ({
        handleStockChartReady: vi.fn(),
        handleStockChartRemove: vi.fn(),
        handleVolumeChartReady: vi.fn(),
        handleVolumeChartRemove: vi.fn(),
    })),
}));
vi.mock('@/entities/extended-bars/hooks/useExtendedBars', () => ({
    useExtendedBars: () => null,
}));
vi.mock('@/entities/bars/hooks/useBars', () => ({
    useBars: stable(() => ({
        bars: [
            { time: 0, open: 100, high: 120, low: 90, close: 100, volume: 1 },
            { time: 1, open: 100, high: 115, low: 100, close: 110, volume: 1 },
        ],
        indicators: { rsi: [null, 55], macd: [] },
    })),
}));
const baseAnalysis = vi.fn();
const shouldThrow = { current: false };
vi.mock('../hooks/useAnalysis', () => ({
    useAnalysis: () => {
        if (shouldThrow.current) throw new Error('boom');
        return baseAnalysis();
    },
}));
// 그 외 ChartContent가 의존하는 훅들 — 시트 콘텐츠와 무관한 값으로 고정
vi.mock('../hooks/usePanelResize', () => ({
    usePanelResize: stable(() => ({
        panelWidth: 360,
        isDragging: false,
        handleDragStart: vi.fn(),
        handleKeyDown: vi.fn(),
    })),
    PANEL_MIN_WIDTH: 280,
    PANEL_MAX_WIDTH: 600,
}));
vi.mock('@/features/symbol-model/model/SymbolModelContext', () => ({
    useSymbolModel: stable(() => ({
        modelId: 'gemini-3.6-flash',
        isHydrated: true,
        reasoning: false,
        isReasoningHydrated: true,
        openSignupNudgeAs: vi.fn(),
    })),
}));
vi.mock('@/features/analysis-nudge/hooks/useAnonAnalysisNudge', () => ({
    useAnonAnalysisNudge: stable(() => ({
        isLoginResolved: false,
        onSymbolAnalyzed: vi.fn(),
    })),
}));
vi.mock('../SymbolPageContext', () => ({
    useSymbolPageContext: stable(() => ({ indicatorCount: 25 })),
}));
vi.mock('../hooks/useAnalysisDerivedData', () => ({
    useAnalysisDerivedData: stable(() => ({
        clusteredKeyLevels: { support: [], resistance: [] },
        validatedActionPrices: [],
        reconciledActionLines: [],
    })),
}));
vi.mock('../hooks/useAnalysisDisplay', () => ({
    useAnalysisDisplay: stable(() => ({
        displayAnalyzing: false,
        handleProgressFinished: vi.fn(),
    })),
}));
vi.mock('@/widgets/analysis/hooks/useAnalysisProgress', () => ({
    useAnalysisProgress: stable(() => ({ phaseIndex: 0, tipIndex: 0 })),
}));
vi.mock('@/widgets/analysis/AnalysisPanel', () => ({
    AnalysisPanel: () => <div data-testid="analysis-panel" />,
}));
// "내 포지션" 요약의 소스 — react-query 기반이라 QueryClientProvider 없는 이
// 트리에서 그대로 렌더하면 크래시한다. "홀딩 없음"으로 고정한다.
vi.mock('@/features/portfolio-holding/hooks/useSymbolHolding', () => ({
    useSymbolHolding: stable(() => ({
        holding: null,
        isHydrated: true,
        isLoading: false,
        isError: false,
        save: {} as never,
    })),
}));

const REAL = { ...FALLBACK_ANALYSIS, summary: 'AAPL 상승' };

function analysisReturn(analysis: AnalysisResponse): UseAnalysisResult {
    return {
        analysis,
        analysisResult: analysis,
        lockedInfoDepth: [],
        isAnalyzing: false,
        analysisError: null,
        handleReanalyze: vi.fn(),
        reanalyzeCooldownUntil: 0,
        cooldownNotice: null,
        isPersonalized: false,
        meter: null,
        isAwaitingInteraction: false,
        isInstantResponse: false,
        syncReanalyzeCooldown: vi.fn(),
        plain: null,
    };
}

// 안정된 참조 — 렌더마다 새 요소면 콘텐츠가 매번 바뀌어 시트 갱신이 무한히 이어진다.
const LINK_SLOT = <span data-testid="slot-marker">링크</span>;
const setSheetSpy = vi.fn();

// 프로덕션은 React Compiler가 `ChartContent`의 파생 객체(analysisStatus 등)를 메모해 부모의
// 시트 state 갱신이 자식 재렌더 → 새 콘텐츠 → 또 갱신으로 이어지지 않는다. 테스트 변환에는
// 컴파일러가 없으므로 memo 경계로 같은 격리를 만든다. `tick`은 이 경계를 넘어 ChartContent만
// 다시 렌더시키는 신호다.
const ChartSlot = memo(function ChartSlot({
    tick,
    withLink,
    onContent,
}: {
    tick: number;
    withLink: boolean;
    onContent: (content: ReactNode) => void;
}) {
    return (
        <ChartContent
            symbol="AAPL"
            companyName="Apple"
            timeframe="1Day"
            timeframeChangeCount={tick}
            onMobileSheetContent={onContent}
            fmpSymbol="AAPL"
            initialAnalysis={REAL}
            initialAnalysisFailed={false}
            panelTopSlot={withLink ? LINK_SLOT : undefined}
        />
    );
});

// SymbolPageClient와 같은 배치: 시트(진짜 useMobileSheet)는 에러 경계 밖에 있다.
function Host({
    tick = 0,
    withLink = true,
    mount = true,
}: {
    tick?: number;
    withLink?: boolean;
    mount?: boolean;
}) {
    const { mobileSheetContent, setMobileSheetContent } = useMobileSheet();
    const onContent = useCallback(
        (content: ReactNode) => {
            setSheetSpy(content);
            setMobileSheetContent(content);
        },
        [setMobileSheetContent]
    );
    return (
        <div>
            <div data-testid="sheet">{mobileSheetContent}</div>
            <ErrorBoundary fallback={<p data-testid="fallback">error</p>}>
                {mount && (
                    <ChartSlot
                        tick={tick}
                        withLink={withLink}
                        onContent={onContent}
                    />
                )}
            </ErrorBoundary>
        </div>
    );
}

const hasMarker = () =>
    screen.getByTestId('sheet').querySelector('[data-testid="slot-marker"]') !==
    null;

describe('ChartContent 모바일 시트 정리', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    beforeEach(() => {
        vi.clearAllMocks();
        shouldThrow.current = false;
        baseAnalysis.mockReturnValue(analysisReturn(REAL));
    });

    it('마운트하면 시트에 콘텐츠를 올린다', () => {
        render(<Host />);
        expect(hasMarker()).toBe(true);
    });

    it('언마운트하면 시트 콘텐츠를 비운다', () => {
        const { rerender } = render(<Host />);
        rerender(<Host mount={false} />);
        expect(screen.getByTestId('sheet').textContent).toBe('');
        expect(setSheetSpy).toHaveBeenLastCalledWith(null);
    });

    it('에러 경계가 가로채면 시트의 옛 콘텐츠(링크 포함)가 남지 않는다', () => {
        // 에러 경계가 잡은 렌더 오류를 React가 console.error로 찍는다 — afterEach에서 복원.
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const { rerender } = render(<Host tick={0} />);
        expect(hasMarker()).toBe(true);

        shouldThrow.current = true;
        rerender(<Host tick={1} />);

        expect(screen.getByTestId('fallback')).toBeTruthy();
        expect(screen.getByTestId('sheet').textContent).toBe('');
    });

    it('콘텐츠가 바뀌는 재렌더에서도 시트를 비우지 않고 새 콘텐츠로 교체한다', () => {
        const { rerender } = render(<Host withLink />);
        expect(hasMarker()).toBe(true);
        setSheetSpy.mockClear();

        // panelTopSlot이 바뀌면 mobileContent가 새로 만들어진다.
        rerender(<Host withLink={false} />);
        expect(hasMarker()).toBe(false);
        expect(setSheetSpy).toHaveBeenCalled();

        rerender(<Host withLink />);
        expect(hasMarker()).toBe(true);

        expect(setSheetSpy).not.toHaveBeenCalledWith(null);
    });

    it('StrictMode의 마운트·정리·재마운트 뒤에도 시트에 콘텐츠가 등록돼 있다', () => {
        render(
            <StrictMode>
                <Host />
            </StrictMode>
        );
        expect(hasMarker()).toBe(true);
    });
});

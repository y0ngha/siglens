import { render, screen } from '@testing-library/react';
import type { AnalysisResponse, Timeframe } from '@y0ngha/siglens-core';
import { ChartContent } from '@/widgets/symbol-page/ChartContent';

vi.mock('next/dynamic', () => ({
    default: (_loader: () => Promise<{ default: React.FC }>) => {
        const Component = (_props: Record<string, unknown>) => (
            <div data-testid="dynamic-component" />
        );
        Component.displayName = 'DynamicMock';
        return Component;
    },
}));

vi.mock('@/shared/lib/cn', () => ({
    cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

vi.mock('@/widgets/chart', () => ({
    ChartSkeleton: () => <div data-testid="chart-skeleton" />,
    useChartSync: () => ({
        handleStockChartReady: vi.fn(),
        handleStockChartRemove: vi.fn(),
        handleVolumeChartReady: vi.fn(),
        handleVolumeChartRemove: vi.fn(),
    }),
}));

vi.mock('@/widgets/analysis', () => ({
    AnalysisPanel: (_props: Record<string, unknown>) => (
        <div data-testid="analysis-panel" />
    ),
}));

vi.mock('@/shared/ui/BotBlockedNotice', () => ({
    BotBlockedNotice: () => <div data-testid="bot-blocked-notice" />,
}));

vi.mock('@/widgets/symbol-page/hooks/useBars', () => ({
    useBars: vi.fn(() => ({
        bars: [
            { time: 1, open: 100, high: 110, low: 90, close: 105, volume: 500 },
        ],
        indicators: { buySellVolume: [] },
    })),
}));

vi.mock('@/widgets/symbol-page/hooks/useAnalysis', () => ({
    useAnalysis: vi.fn(() => ({
        analysis: {} as AnalysisResponse,
        analysisResult: null,
        isAnalyzing: false,
        analysisError: null,
        isBotBlocked: false,
        handleReanalyze: vi.fn(),
        reanalyzeCooldownMs: 0,
        cooldownNotice: null,
    })),
}));

vi.mock('@/widgets/symbol-page/hooks/useAnalysisDerivedData', () => ({
    useAnalysisDerivedData: vi.fn(() => ({
        clusteredKeyLevels: { support: [], resistance: [], poc: undefined },
        validatedActionPrices: undefined,
        reconciledActionLines: undefined,
    })),
}));

vi.mock('@/widgets/symbol-page/hooks/useAnalysisDisplay', () => ({
    useAnalysisDisplay: vi.fn(() => ({
        displayAnalyzing: false,
        handleProgressFinished: vi.fn(),
    })),
}));

vi.mock('@/widgets/symbol-page/hooks/useActionPricesVisibility', () => ({
    useActionPricesVisibility: vi.fn(() => ({
        actionPricesVisible: true,
        setActionPricesVisible: vi.fn(),
    })),
}));

vi.mock('@/widgets/symbol-page/SymbolModelContext', () => ({
    useSymbolModel: vi.fn(() => ({
        modelId: 'gemini-2.5-flash-lite',
        isHydrated: true,
    })),
}));

vi.mock('@/widgets/symbol-page/hooks/usePanelResize', () => ({
    usePanelResize: vi.fn(() => ({
        panelWidth: 640,
        isDragging: false,
        handleDragStart: vi.fn(),
        handleKeyDown: vi.fn(),
    })),
    PANEL_MIN_WIDTH: 240,
    PANEL_MAX_WIDTH: 640,
}));

vi.mock('@/widgets/symbol-page/hooks/useAnalysisProgress', () => ({
    useAnalysisProgress: vi.fn(() => ({
        phaseIndex: 0,
        tipIndex: 0,
    })),
}));

vi.mock('@/features/symbol-chat', () => ({
    usePublishSymbolChat: vi.fn(),
}));

vi.mock('@/widgets/symbol-page/utils/buildChatState', () => ({
    buildChatState: vi.fn(() => ({
        context: null,
        timeframe: '1Day',
        isAnalysisReady: false,
    })),
}));

vi.mock('@/shared/lib/pwaEvents', () => ({
    PWA_TRIGGER_EVENT: 'pwa-trigger',
}));

vi.mock('@/widgets/symbol-page/FearGreedCardMounted', () => ({
    FearGreedCardMounted: () => <div data-testid="fear-greed-card" />,
}));

describe('ChartContent', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    const defaultProps = {
        symbol: 'AAPL',
        companyName: 'Apple Inc.',
        timeframe: '1Day' as Timeframe,
        timeframeChangeCount: 0,
        initialAnalysis: {} as AnalysisResponse,
        initialAnalysisFailed: false,
        onMobileSheetContent: vi.fn(),
    };

    it('renders without crashing', () => {
        const { container } = render(<ChartContent {...defaultProps} />);
        expect(container.firstElementChild).toBeDefined();
    });

    it('renders the drag handle separator', () => {
        render(<ChartContent {...defaultProps} />);
        const separator = screen.getByRole('separator');
        expect(separator.getAttribute('aria-label')).toBe('패널 너비 조절');
    });

    it('renders the disclaimer text', () => {
        render(<ChartContent {...defaultProps} />);
        expect(
            screen.getByText(
                /차트는 Pre-market, After-market 주가를 반영하지 않습니다/
            )
        ).toBeDefined();
    });

    it('renders analysis panel in aside', () => {
        render(<ChartContent {...defaultProps} />);
        expect(screen.getByTestId('analysis-panel')).toBeDefined();
    });

    it('renders bot blocked notice when bot is blocked', async () => {
        const { useAnalysis } =
            await import('@/widgets/symbol-page/hooks/useAnalysis');
        (useAnalysis as ReturnType<typeof vi.fn>).mockReturnValue({
            analysis: {} as AnalysisResponse,
            analysisResult: null,
            isAnalyzing: false,
            analysisError: null,
            isBotBlocked: true,
            handleReanalyze: vi.fn(),
            reanalyzeCooldownMs: 0,
            cooldownNotice: null,
        });

        render(<ChartContent {...defaultProps} />);
        expect(screen.getByTestId('bot-blocked-notice')).toBeDefined();

        (useAnalysis as ReturnType<typeof vi.fn>).mockReturnValue({
            analysis: {} as AnalysisResponse,
            analysisResult: null,
            isAnalyzing: false,
            analysisError: null,
            isBotBlocked: false,
            handleReanalyze: vi.fn(),
            reanalyzeCooldownMs: 0,
            cooldownNotice: null,
        });
    });
});

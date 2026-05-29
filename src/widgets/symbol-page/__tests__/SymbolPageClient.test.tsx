import { render, screen } from '@testing-library/react';
import type { AnalysisResponse, Timeframe } from '@y0ngha/siglens-core';
import { SymbolPageClient } from '@/widgets/symbol-page/SymbolPageClient';

vi.mock('next/dynamic', () => ({
    default: () => {
        const Stub = () => <div data-testid="mobile-sheet" />;
        Stub.displayName = 'MobileSheetStub';
        return Stub;
    },
}));

vi.mock('react-error-boundary', () => ({
    ErrorBoundary: ({
        children,
    }: {
        children: React.ReactNode;
        [key: string]: unknown;
    }) => <div data-testid="error-boundary">{children}</div>,
}));

vi.mock('@/widgets/chart', () => ({
    ChartErrorFallback: () => <div data-testid="chart-error" />,
    ChartSkeleton: () => <div data-testid="chart-skeleton" />,
    TimeframeSelector: ({
        value,
        onChange: _onChange,
    }: {
        value: string;
        onChange: (v: string) => void;
    }) => <div data-testid="timeframe-selector">{value}</div>,
}));

vi.mock('@/shared/hooks/useHydrated', () => ({
    useHydrated: vi.fn(() => true),
}));

vi.mock('@/shared/hooks/useIsMobileViewport', () => ({
    useIsMobileViewport: vi.fn(() => false),
}));

vi.mock('@/widgets/symbol-page/ChartContent', () => ({
    ChartContent: (props: Record<string, unknown>) => (
        <div data-testid="chart-content">{props.symbol as string}</div>
    ),
}));

vi.mock('@/widgets/symbol-page/hooks/useAssetInfo', () => ({
    useAssetInfo: vi.fn(() => undefined),
}));

vi.mock('@/widgets/symbol-page/hooks/useMobileSheet', () => ({
    useMobileSheet: vi.fn(() => ({
        sheetSnap: 0.55,
        setSheetSnap: vi.fn(),
        mobileSheetContent: null,
        setMobileSheetContent: vi.fn(),
    })),
}));

vi.mock('@/widgets/symbol-page/hooks/useTimeframeChange', () => ({
    useTimeframeChange: vi.fn(() => ({
        timeframe: '1Day' as Timeframe,
        timeframeChangeCount: 0,
        handleTimeframeChange: vi.fn(),
    })),
}));

vi.mock('@/widgets/symbol-page/SymbolPageContext', () => ({
    SymbolPageProvider: ({ children }: { children: React.ReactNode }) => (
        <div data-testid="provider">{children}</div>
    ),
}));

describe('SymbolPageClient', () => {
    const defaultProps = {
        symbol: 'AAPL',
        companyName: 'Apple Inc.',
        displayName: '애플, Apple Inc. (AAPL)',
        initialAnalysis: {} as AnalysisResponse,
        initialAnalysisFailed: false,
        indicatorCount: 20,
    };

    it('renders without crashing', () => {
        const { container } = render(<SymbolPageClient {...defaultProps} />);
        expect(container.firstElementChild).toBeDefined();
    });

    it('wraps content in SymbolPageProvider', () => {
        render(<SymbolPageClient {...defaultProps} />);
        expect(screen.getByTestId('provider')).toBeDefined();
    });

    it('renders the timeframe selector with current value', () => {
        render(<SymbolPageClient {...defaultProps} />);
        expect(screen.getByTestId('timeframe-selector').textContent).toBe(
            '1Day'
        );
    });

    it('renders ChartContent inside the error boundary', () => {
        render(<SymbolPageClient {...defaultProps} />);
        expect(screen.getByTestId('chart-content')).toBeDefined();
    });

    it('passes symbol to ChartContent', () => {
        render(<SymbolPageClient {...defaultProps} />);
        expect(screen.getByTestId('chart-content').textContent).toBe('AAPL');
    });
});

import { render, screen } from '@testing-library/react';
import type { ComponentType } from 'react';
import type { AnalysisResponse, Timeframe } from '@y0ngha/siglens-core';
import { SymbolPageClient } from '@/widgets/symbol-page/SymbolPageClient';
import { useHydrated } from '@/shared/hooks/useHydrated';
import { useIsMobileViewport } from '@/shared/hooks/useIsMobileViewport';

// Mock MobileAnalysisSheet so the dynamic() factory's import resolves cheaply.
vi.mock('@/widgets/symbol-page/MobileAnalysisSheet', () => ({
    MobileAnalysisSheet: () => <div data-testid="mobile-analysis-sheet" />,
}));

vi.mock('next/dynamic', () => ({
    /**
     * Invoke the loader factory synchronously so the dynamic-import loader
     * (`() => import('./MobileAnalysisSheet')`) and its `.then` mapper actually
     * execute (and are thus covered). The returned component is a simple stub
     * renderable in tests.
     */
    default: (loader: () => Promise<{ default: ComponentType }>) => {
        // Fire-and-forget: coverage only needs the factory to be called once.
        // .catch swallows any rejection so a failed import can't destabilize the run.
        void loader().catch(() => {});
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

    it('does not render MobileAnalysisSheet when isMobileViewport is false', () => {
        vi.mocked(useIsMobileViewport).mockReturnValue(false);
        vi.mocked(useHydrated).mockReturnValue(true);
        render(<SymbolPageClient {...defaultProps} />);
        expect(screen.queryByTestId('mobile-sheet')).toBeNull();
    });

    it('renders MobileAnalysisSheet when hydrated and isMobileViewport is true', () => {
        vi.mocked(useHydrated).mockReturnValue(true);
        vi.mocked(useIsMobileViewport).mockReturnValue(true);
        render(<SymbolPageClient {...defaultProps} />);
        expect(screen.getByTestId('mobile-sheet')).toBeInTheDocument();
    });

    it('does not render MobileAnalysisSheet when not hydrated even if mobile', () => {
        vi.mocked(useHydrated).mockReturnValue(false);
        vi.mocked(useIsMobileViewport).mockReturnValue(true);
        render(<SymbolPageClient {...defaultProps} />);
        expect(screen.queryByTestId('mobile-sheet')).toBeNull();
    });
});

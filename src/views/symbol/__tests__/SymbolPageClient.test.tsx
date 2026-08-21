import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentType } from 'react';
import { useMobileSheet } from '@/views/symbol/hooks/useMobileSheet';
import { SNAP_FULL, SNAP_PEEK } from '@/views/symbol/constants/mobileSheet';
import type { AnalysisResponse, Timeframe } from '@y0ngha/siglens-core';
import { SymbolPageClient } from '@/views/symbol/SymbolPageClient';
import { useHydrated } from '@/shared/hooks/useHydrated';
import { useIsMobileViewport } from '@/shared/hooks/useIsMobileViewport';

// Mock MobileAnalysisSheet so the dynamic() factory's import resolves cheaply.
vi.mock('@/views/symbol/MobileAnalysisSheet', () => ({
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

vi.mock('@/views/symbol/ChartContent', () => ({
    ChartContent: (props: Record<string, unknown>) => (
        <div data-testid="chart-content">{props.symbol as string}</div>
    ),
}));

vi.mock('@/entities/ticker/hooks/useAssetInfo', () => ({
    useAssetInfo: vi.fn(() => undefined),
}));

vi.mock('@/views/symbol/hooks/useMobileSheet', () => ({
    useMobileSheet: vi.fn(() => ({
        sheetSnap: 0.2,
        setSheetSnap: vi.fn(),
        mobileSheetContent: null,
        setMobileSheetContent: vi.fn(),
    })),
}));

vi.mock('@/views/symbol/hooks/useTimeframeChange', () => ({
    useTimeframeChange: vi.fn(() => ({
        timeframe: '1Day' as Timeframe,
        timeframeChangeCount: 0,
        handleTimeframeChange: vi.fn(),
    })),
}));

vi.mock('@/features/symbol-model', () => ({
    useSymbolModel: vi.fn(() => ({ tier: 'free', isTierHydrated: true })),
}));

vi.mock('@/views/symbol/SymbolPageContext', () => ({
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
        skillCount: 30,
    };

    it('renders without crashing', () => {
        const { container } = render(<SymbolPageClient {...defaultProps} />);
        expect(container.firstElementChild).toBeDefined();
    });

    /*
     * 시트를 여는 유일한 방법이 PEEK 띠 드래그뿐이면, 툴바 접힘으로 띠가 얇아졌을 때
     * AI 분석 패널에 접근할 수 없게 된다(띠 = snap − PEEK_VISIBLE_OFFSET이고 vaul은 innerHeight,
     * 시트는 svh 기준이라 두 단위가 벌어지면 띠가 줄어든다). 그래서 시트 **밖**에
     * 항상 살아 있는 버튼을 둔다. 이 버튼이 사라지면 그 안전장치가 사라진다.
     */
    it('시트를 여는 버튼이 시트 밖에 있고, 누르면 전체 스냅으로 연다', async () => {
        const setSheetSnap = vi.fn();
        vi.mocked(useMobileSheet).mockReturnValue({
            sheetSnap: SNAP_PEEK,
            setSheetSnap,
            mobileSheetContent: null,
            setMobileSheetContent: vi.fn(),
        });
        // 시트가 실제로 렌더링되는 조건(모바일 + hydrated)이어야 "시트 밖"이라는
        // closest() 단언이 의미를 갖는다. 데스크탑 모킹(모듈 기본값 false)으로 두면
        // 시트 자체가 렌더링되지 않아 두 closest() 호출이 공허하게 null을 반환한다.
        vi.mocked(useIsMobileViewport).mockReturnValue(true);
        vi.mocked(useHydrated).mockReturnValue(true);

        render(<SymbolPageClient {...defaultProps} />);

        // 시트가 실제로 존재함을 먼저 확인 — 이게 없으면 아래 closest() 단언이
        // 다시 공허해질 수 있다(시트가 렌더링을 멈춰도 테스트는 그린으로 남는다).
        expect(screen.getByTestId('mobile-sheet')).toBeInTheDocument();

        const openButton = screen.getByRole('button', { name: 'AI 분석 보기' });
        // 시트 밖이어야 한다 — 시트 안에 있으면 띠가 사라질 때 같이 사라진다.
        expect(openButton.closest('[data-testid="mobile-sheet"]')).toBeNull();
        expect(
            openButton.closest('[data-testid="mobile-analysis-sheet"]')
        ).toBeNull();

        await userEvent.click(openButton);

        expect(setSheetSnap).toHaveBeenCalledWith(SNAP_FULL);
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

import { render, screen } from '@testing-library/react';
import type { ComponentType } from 'react';
import type { AnalysisResponse, Timeframe } from '@y0ngha/siglens-core';
import { SymbolPageClient } from '@/views/symbol/SymbolPageClient';
import { useAssetInfo } from '@/entities/ticker/hooks/useAssetInfo';

vi.mock('@/widgets/extended-hours/ui/ExtendedHoursQuoteLine', () => ({
    ExtendedHoursQuoteLine: ({ symbol }: { symbol: string }) => (
        <div data-testid="extended-hours-line">{symbol}</div>
    ),
}));

vi.mock('@/views/symbol/MobileAnalysisSheet', () => ({
    MobileAnalysisSheet: () => <div />,
}));
vi.mock('next/dynamic', () => ({
    default: (loader: () => Promise<{ default: ComponentType }>) => {
        void loader().catch(() => {});
        return () => <div />;
    },
}));
vi.mock('react-error-boundary', () => ({
    ErrorBoundary: ({ children }: { children: React.ReactNode }) => (
        <div>{children}</div>
    ),
}));
vi.mock('@/widgets/chart/ChartErrorFallback', () => ({
    ChartErrorFallback: () => <div />,
}));
vi.mock('@/widgets/chart/ChartSkeleton', () => ({
    ChartSkeleton: () => <div />,
}));
vi.mock('@/widgets/chart/TimeframeSelector', () => ({
    TimeframeSelector: () => <div />,
}));
vi.mock('@/shared/hooks/useHydrated', () => ({ useHydrated: () => true }));
vi.mock('@/shared/hooks/useIsMobileViewport', () => ({
    useIsMobileViewport: () => false,
}));
vi.mock('@/views/symbol/ChartContent', () => ({
    ChartContent: ({
        chartCornerSlot,
    }: {
        chartCornerSlot?: React.ReactNode;
    }) => <div data-testid="chart-content">{chartCornerSlot}</div>,
}));
vi.mock('@/entities/ticker/hooks/useAssetInfo', () => ({
    useAssetInfo: vi.fn(() => undefined),
}));
vi.mock('@/views/symbol/hooks/useMobileSheet', () => ({
    useMobileSheet: () => ({
        sheetSnap: 0.2,
        setSheetSnap: vi.fn(),
        mobileSheetContent: null,
        setMobileSheetContent: vi.fn(),
    }),
}));
vi.mock('@/views/symbol/hooks/useTimeframeChange', () => ({
    useTimeframeChange: () => ({
        timeframe: '1Day' as Timeframe,
        displayTimeframe: '1Day' as Timeframe,
        isTimeframeSwitching: false,
        timeframeChangeCount: 0,
        handleTimeframeChange: vi.fn(),
    }),
}));
vi.mock('@/features/symbol-model/model/SymbolModelContext', () => ({
    useSymbolModel: () => ({ tier: 'free', isTierHydrated: true }),
}));
vi.mock('@/views/symbol/SymbolPageContext', () => ({
    SymbolPageProvider: ({ children }: { children: React.ReactNode }) => (
        <div>{children}</div>
    ),
}));

const baseProps = {
    symbol: 'AAPL',
    companyName: 'Apple Inc.',
    displayName: '애플, Apple Inc. (AAPL)',
    initialAnalysis: {} as AnalysisResponse,
    initialAnalysisFailed: false,
    indicatorCount: 20,
    skillCount: 30,
};

describe('SymbolPageClient — 프리·애프터마켓 한 줄 배선', () => {
    beforeEach(() => {
        vi.mocked(useAssetInfo).mockReturnValue(undefined);
    });

    it('미국 주식 프로필이면 차트 영역의 코너 슬롯에 심볼과 함께 붙인다(제목 행이 아니다)', () => {
        render(<SymbolPageClient {...baseProps} marketProfile="us-equity" />);

        const line = screen.getByTestId('extended-hours-line');
        expect(line.closest('[data-testid="chart-content"]')).not.toBeNull();
        expect(line.closest('h1')).toBeNull();
        expect(
            screen.getByRole('heading', { level: 1 }).parentElement
        ).not.toContainElement(line);

        expect(screen.getByTestId('extended-hours-line')).toHaveTextContent(
            'AAPL'
        );
    });

    it.each(['crypto', 'kr-equity'] as const)(
        '%s 프로필에는 붙이지 않는다',
        marketProfile => {
            render(
                <SymbolPageClient
                    {...baseProps}
                    marketProfile={marketProfile}
                />
            );

            expect(screen.queryByTestId('extended-hours-line')).toBeNull();
        }
    );

    it('프로필을 확정할 수 없으면(prop·자산 정보 없음) 붙이지 않는다', () => {
        render(<SymbolPageClient {...baseProps} />);

        expect(screen.queryByTestId('extended-hours-line')).toBeNull();
    });

    it('prop이 없어도 자산 정보가 미국 주식이면 붙인다', () => {
        vi.mocked(useAssetInfo).mockReturnValue({
            symbol: 'AAPL',
            name: 'Apple Inc.',
        });

        render(<SymbolPageClient {...baseProps} />);

        expect(screen.getByTestId('extended-hours-line')).toBeInTheDocument();
    });

    it('prop이 없고 자산 정보가 크립토면 붙이지 않는다', () => {
        vi.mocked(useAssetInfo).mockReturnValue({
            symbol: 'BTCUSD',
            name: 'Bitcoin',
            marketProfile: 'crypto',
        });

        render(<SymbolPageClient {...baseProps} symbol="BTCUSD" />);

        expect(screen.queryByTestId('extended-hours-line')).toBeNull();
    });
});

import { render, screen } from '@testing-library/react';
import { SectorSignalPanel } from '@/widgets/dashboard/SectorSignalPanel';
import type { SectorSignalsResult } from '@y0ngha/siglens-core';
import { TEST_SCOPE } from './helpers/testScope';

/** KRX 티커는 읽어서 뜻이 통하지 않는다 — 실제 `KR_DASHBOARD_SCOPE`와 같은 값. */
const KR_SCOPE = {
    ...TEST_SCOPE,
    id: 'kr' as const,
    marketLabel: '한국 증시',
    currencySymbol: '₩',
    linkSectorCards: false,
    tickerIsReadable: false,
};

// spy로 두어 initialData/initialSector/initialTimeframe가 훅으로 전달되는지(panel 배선) 검증.
const { mockUseSectorSignalState } = vi.hoisted(() => ({
    mockUseSectorSignalState: vi.fn(),
}));

const mockReturn = {
    activeSector: 'XLK',
    activeTimeframe: '1Day' as const,
    quadrants: {
        bullishConfirmed: [],
        bullishExpected: [],
        bearishExpected: [],
        bearishConfirmed: [],
    },
    mixedStocks: [],
    handleSectorChange: vi.fn(),
    handleTimeframeChange: vi.fn(),
};

vi.mock('@/widgets/dashboard/hooks/useSectorSignalState', () => ({
    useSectorSignalState: mockUseSectorSignalState,
}));

vi.mock('@/widgets/dashboard/SectorTabs', () => ({
    SectorTabs: () => <div data-testid="sector-tabs" />,
}));

vi.mock('@/widgets/dashboard/TimeframeSelector', () => ({
    TimeframeSelector: () => <div data-testid="timeframe-selector" />,
}));

/*
 * 목이 `currencySymbol`·`tickerIsReadable`을 DOM으로 흘려보낸다. 삼키면 다섯 개
 * 호출부 중 어디를 리터럴로 되돌려도(=한국 신호 카드 제목이 다시 `005930.KS`가
 * 되는 회귀) 아무 테스트가 안 깨진다.
 */
vi.mock('@/widgets/dashboard/SignalSubsection', () => ({
    SignalSubsection: ({
        title,
        currencySymbol,
        tickerIsReadable,
    }: {
        title: string;
        currencySymbol: string;
        tickerIsReadable: boolean;
    }) => (
        <div
            data-testid={`subsection-${title}`}
            data-currency={currencySymbol}
            data-ticker-readable={String(tickerIsReadable)}
        >
            {title}
        </div>
    ),
}));

describe('SectorSignalPanel', () => {
    beforeEach(() => {
        mockUseSectorSignalState.mockReset();
        mockUseSectorSignalState.mockReturnValue(mockReturn);
    });

    it('renders the section heading', () => {
        render(
            <SectorSignalPanel
                scope={TEST_SCOPE}
                initialSector="XLK"
                initialTimeframe="1Day"
            />
        );
        expect(screen.getByText('섹터별 신호 모아보기')).toBeInTheDocument();
    });

    it('renders SectorTabs and TimeframeSelector', () => {
        render(
            <SectorSignalPanel
                scope={TEST_SCOPE}
                initialSector="XLK"
                initialTimeframe="1Day"
            />
        );
        expect(screen.getByTestId('sector-tabs')).toBeInTheDocument();
        expect(screen.getByTestId('timeframe-selector')).toBeInTheDocument();
    });

    it('renders all five signal subsections', () => {
        render(
            <SectorSignalPanel
                scope={TEST_SCOPE}
                initialSector="XLK"
                initialTimeframe="1Day"
            />
        );
        expect(screen.getByText('상승 신호')).toBeInTheDocument();
        expect(screen.getByText('상승 조짐')).toBeInTheDocument();
        expect(screen.getByText('혼재')).toBeInTheDocument();
        expect(screen.getByText('하락 조짐')).toBeInTheDocument();
        expect(screen.getByText('하락 신호')).toBeInTheDocument();
    });

    it('renders tabpanel with correct aria attributes', () => {
        render(
            <SectorSignalPanel
                scope={TEST_SCOPE}
                initialSector="XLK"
                initialTimeframe="1Day"
            />
        );
        const panel = screen.getByRole('tabpanel');
        expect(panel).toHaveAttribute('aria-labelledby', 'sector-tab-XLK');
    });

    /**
     * 다섯 개 SignalSubsection 호출부 중 하나라도 `tickerIsReadable`을 리터럴로
     * 박으면 한국 신호 카드 제목이 다시 `005930.KS` 같은 숫자로 돌아간다.
     * scope 값이 끝까지 흐르는지 모든 subsection에서 확인한다.
     */
    it('scope의 tickerIsReadable을 모든 subsection에 그대로 넘긴다', () => {
        const { rerender } = render(
            <SectorSignalPanel
                scope={KR_SCOPE}
                initialSector="XLK"
                initialTimeframe="1Day"
            />
        );

        const krSubsections = document.querySelectorAll(
            '[data-testid^="subsection-"]'
        );
        expect(krSubsections.length).toBeGreaterThan(0);
        for (const el of krSubsections) {
            expect(el).toHaveAttribute('data-ticker-readable', 'false');
            expect(el).toHaveAttribute('data-currency', '₩');
        }

        rerender(
            <SectorSignalPanel
                scope={TEST_SCOPE}
                initialSector="XLK"
                initialTimeframe="1Day"
            />
        );

        const usSubsections = document.querySelectorAll(
            '[data-testid^="subsection-"]'
        );
        expect(usSubsections.length).toBeGreaterThan(0);
        for (const el of usSubsections) {
            expect(el).toHaveAttribute('data-ticker-readable', 'true');
        }
    });

    it('initialData/initialSector/initialTimeframe를 useSectorSignalState로 전달한다', () => {
        const initialData: SectorSignalsResult = {
            computedAt: '2026-06-04T00:00:00Z',
            stocks: [],
        };
        render(
            <SectorSignalPanel
                scope={TEST_SCOPE}
                initialSector="XLF"
                initialTimeframe="1Hour"
                initialData={initialData}
            />
        );
        expect(mockUseSectorSignalState).toHaveBeenCalledWith({
            scope: TEST_SCOPE,
            initialSector: 'XLF',
            initialTimeframe: '1Hour',
            initialData,
        });
    });
});

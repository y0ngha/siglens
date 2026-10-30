import { fireEvent, render, screen } from '@testing-library/react';
import { SectorSignalPanel } from '@/widgets/dashboard/SectorSignalPanel';
import type {
    SectorSignalsResult,
    StockWithConflict,
} from '@y0ngha/siglens-core';
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

const STOCK: StockWithConflict = {
    symbol: 'AAPL',
    koreanName: '애플',
    sectorSymbol: 'XLK',
    price: 180,
    changePercent: 1,
    trend: 'uptrend',
    signals: [],
};

const EMPTY_QUADRANTS = {
    bullishConfirmed: [],
    bullishExpected: [],
    bearishExpected: [],
    bearishConfirmed: [],
};

const mockRetry = vi.fn();

// 기본 픽스처는 신호가 하나 있는 섹터 — 다섯 구획이 모두 그려지는 정상 경로.
const mockReturn = {
    activeSector: 'XLK',
    activeTimeframe: '1Day' as const,
    status: 'ready' as const,
    retry: mockRetry,
    view: {
        quadrants: { ...EMPTY_QUADRANTS, bullishConfirmed: [STOCK] },
        mixedStocks: [],
    },
    handleSectorChange: vi.fn(),
    handleTimeframeChange: vi.fn(),
};

vi.mock('@/widgets/dashboard/hooks/useSectorSignalState', () => ({
    useSectorSignalState: mockUseSectorSignalState,
}));

vi.mock('@/widgets/dashboard/ui/sector-signal/SectorTabs', () => ({
    SectorTabs: () => <div data-testid="sector-tabs" />,
}));

vi.mock('@/widgets/dashboard/ui/sector-signal/TimeframeSelector', () => ({
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

    describe('빈 섹터', () => {
        const renderPanel = () =>
            render(
                <SectorSignalPanel
                    scope={TEST_SCOPE}
                    initialSector="XLK"
                    initialTimeframe="1Day"
                />
            );

        it('다섯 구획과 mixed가 모두 비면 구획 대신 안내 한 줄만 렌더한다', () => {
            mockUseSectorSignalState.mockReturnValue({
                ...mockReturn,
                view: { quadrants: EMPTY_QUADRANTS, mixedStocks: [] },
            });
            renderPanel();
            expect(
                screen.getAllByText(
                    '이 섹터에는 지금 잡힌 신호가 없어요. 다른 섹터를 살펴보세요.'
                ).length
            ).toBeGreaterThan(0);
            expect(
                document.querySelectorAll('[data-testid^="subsection-"]')
            ).toHaveLength(0);
            // 탭 패널 자체는 유지된다 — 섹터 탭의 aria-controls 대상이다.
            expect(screen.getByRole('tabpanel')).toBeInTheDocument();
        });

        it('mixed 구획에만 종목이 있어도 빈 섹터로 취급하지 않는다', () => {
            mockUseSectorSignalState.mockReturnValue({
                ...mockReturn,
                view: { quadrants: EMPTY_QUADRANTS, mixedStocks: [STOCK] },
            });
            renderPanel();
            expect(
                document.querySelectorAll('[data-testid^="subsection-"]')
            ).toHaveLength(5);
        });

        it('구획 하나만 비어 있지 않아도 다섯 구획을 모두 렌더한다', () => {
            renderPanel();
            expect(
                document.querySelectorAll('[data-testid^="subsection-"]')
            ).toHaveLength(5);
        });
    });

    /**
     * 조회가 끝나지 않았거나 실패했을 때 화면을 "이 섹터에는 신호가 없어요"로 그리면
     * 사용자는 신호가 없다고 읽는다.
     */
    describe('조회 상태', () => {
        const EMPTY_VIEW = { quadrants: EMPTY_QUADRANTS, mixedStocks: [] };
        const NO_SIGNAL_MESSAGE =
            '이 섹터에는 지금 잡힌 신호가 없어요. 다른 섹터를 살펴보세요.';
        const renderPanel = () =>
            render(
                <SectorSignalPanel
                    scope={TEST_SCOPE}
                    initialSector="XLK"
                    initialTimeframe="1Day"
                />
            );

        it('조회 중에는 빈 섹터 안내 없이 로딩 자리를 그린다', () => {
            mockUseSectorSignalState.mockReturnValue({
                ...mockReturn,
                status: 'loading',
                view: EMPTY_VIEW,
            });
            renderPanel();
            expect(
                screen.queryByText(NO_SIGNAL_MESSAGE)
            ).not.toBeInTheDocument();
            expect(
                screen.getByRole('tabpanel').querySelector('[aria-busy="true"]')
            ).not.toBeNull();
            expect(
                screen.getByText('섹터 신호를 불러오는 중이에요.')
            ).toBeInTheDocument();
        });

        it('조회가 실패하면 빈 섹터 안내 없이 오류 알림을 그린다', () => {
            mockUseSectorSignalState.mockReturnValue({
                ...mockReturn,
                status: 'error',
                view: EMPTY_VIEW,
            });
            renderPanel();
            expect(
                screen.queryByText(NO_SIGNAL_MESSAGE)
            ).not.toBeInTheDocument();
            expect(screen.getByRole('alert')).toHaveTextContent(
                '섹터 신호를 불러오지 못했어요'
            );
        });

        it('다시 시도 버튼이 retry를 부른다', () => {
            mockRetry.mockClear();
            mockUseSectorSignalState.mockReturnValue({
                ...mockReturn,
                status: 'error',
                view: EMPTY_VIEW,
            });
            renderPanel();
            fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
            expect(mockRetry).toHaveBeenCalledTimes(1);
        });
    });

    /**
     * 섹션 전체가 live region이면 탭·타임프레임을 바꿀 때마다 카드 수십 개가 낭독된다.
     * 낭독되는 영역은 짧은 상태 줄 하나뿐이어야 한다.
     */
    describe('스크린리더 낭독 범위', () => {
        const renderPanel = () =>
            render(
                <SectorSignalPanel
                    scope={TEST_SCOPE}
                    initialSector="XLK"
                    initialTimeframe="1Day"
                />
            );

        it('섹션 자체는 live region이 아니다', () => {
            renderPanel();
            expect(
                screen.getByRole('region', { name: '섹터별 신호 모아보기' })
            ).not.toHaveAttribute('aria-live');
        });

        it('탭 패널도 live region이 아니다', () => {
            renderPanel();
            expect(screen.getByRole('tabpanel')).not.toHaveAttribute(
                'aria-live'
            );
        });

        it('낭독되는 영역은 소절별 종목 수를 알리는 상태 줄 하나다', () => {
            renderPanel();
            const status = screen.getByRole('status');
            expect(status).toHaveClass('sr-only');
            expect(status).toHaveTextContent(
                '종목 수: 상승 신호 1개, 상승 조짐 0개, 혼재 0개, 하락 조짐 0개, 하락 신호 0개'
            );
        });
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

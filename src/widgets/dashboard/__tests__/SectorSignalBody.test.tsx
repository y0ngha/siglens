import { fireEvent, render, screen } from '@testing-library/react';
import type { StockWithConflict } from '@y0ngha/siglens-core';
import { SectorSignalBody } from '@/widgets/dashboard/SectorSignalBody';
import type { SectorSignalView } from '@/widgets/dashboard/utils/sectorSignalStocks';
import { TEST_SCOPE } from './helpers/testScope';

/*
 * 목이 소절에 넘어간 값을 DOM으로 흘려보낸다. 삼키면 소절 순서·변형·scope 전달이
 * 바뀌어도 아무 테스트가 안 깨진다.
 */
vi.mock('@/widgets/dashboard/SignalSubsection', () => ({
    SignalSubsection: ({
        title,
        marker,
        variant,
        stocks,
        currencySymbol,
        tickerIsReadable,
        infoMessage,
    }: {
        title: string;
        marker: string;
        variant: string;
        stocks: readonly { symbol: string }[];
        currencySymbol: string;
        tickerIsReadable: boolean;
        infoMessage?: React.ReactNode;
    }) => (
        <div
            data-testid="subsection"
            data-title={title}
            data-marker={marker}
            data-variant={variant}
            data-symbols={stocks.map(s => s.symbol).join(',')}
            data-currency={currencySymbol}
            data-ticker-readable={String(tickerIsReadable)}
            data-has-info={String(infoMessage !== undefined)}
        />
    ),
}));

function stock(symbol: string): StockWithConflict {
    return {
        symbol,
        koreanName: symbol,
        sectorSymbol: 'XLK',
        price: 1,
        changePercent: 1,
        trend: 'uptrend',
        signals: [],
    };
}

const EMPTY_VIEW: SectorSignalView = {
    quadrants: {
        bullishConfirmed: [],
        bullishExpected: [],
        bearishExpected: [],
        bearishConfirmed: [],
    },
    mixedStocks: [],
};

const FULL_VIEW: SectorSignalView = {
    quadrants: {
        bullishConfirmed: [stock('BC')],
        bullishExpected: [stock('BE')],
        bearishExpected: [stock('RE')],
        bearishConfirmed: [stock('RC')],
    },
    mixedStocks: [stock('MX')],
};

const NO_SIGNAL_MESSAGE =
    '이 섹터에는 지금 잡힌 신호가 없어요. 다른 섹터를 살펴보세요.';

function renderBody(
    status: 'loading' | 'error' | 'ready',
    view: SectorSignalView,
    onRetry = vi.fn()
) {
    return render(
        <SectorSignalBody
            scope={TEST_SCOPE}
            status={status}
            view={view}
            onRetry={onRetry}
        />
    );
}

describe('SectorSignalBody', () => {
    it('조회 중에는 로딩 자리만 그리고 빈 섹터 안내를 그리지 않는다', () => {
        const { container } = renderBody('loading', EMPTY_VIEW);
        expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
        expect(screen.queryByText(NO_SIGNAL_MESSAGE)).not.toBeInTheDocument();
        expect(screen.queryAllByTestId('subsection')).toHaveLength(0);
    });

    it('실패하면 오류 알림만 그리고 빈 섹터 안내를 그리지 않는다', () => {
        renderBody('error', EMPTY_VIEW);
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.queryByText(NO_SIGNAL_MESSAGE)).not.toBeInTheDocument();
    });

    it('오류 알림의 다시 시도가 onRetry를 부른다', () => {
        const onRetry = vi.fn();
        renderBody('error', EMPTY_VIEW, onRetry);
        fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
        expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('준비됐는데 모든 구획이 비면 안내 한 줄만 그린다', () => {
        renderBody('ready', EMPTY_VIEW);
        expect(screen.getByText(NO_SIGNAL_MESSAGE)).toBeInTheDocument();
        expect(screen.queryAllByTestId('subsection')).toHaveLength(0);
    });

    it('다섯 소절을 상승 신호·상승 조짐·혼재·하락 조짐·하락 신호 순서로 그린다', () => {
        renderBody('ready', FULL_VIEW);
        const rows = screen
            .getAllByTestId('subsection')
            .map(el => [
                el.dataset.title,
                el.dataset.marker,
                el.dataset.variant,
                el.dataset.symbols,
            ]);
        expect(rows).toEqual([
            ['상승 신호', '▲', 'confirmed', 'BC'],
            ['상승 조짐', '△', 'expected', 'BE'],
            ['혼재', '◈', 'mixed', 'MX'],
            ['하락 조짐', '▽', 'expected', 'RE'],
            ['하락 신호', '▼', 'confirmed', 'RC'],
        ]);
    });

    it('혼재 소절에만 안내 메시지를 붙인다', () => {
        renderBody('ready', FULL_VIEW);
        const withInfo = screen
            .getAllByTestId('subsection')
            .filter(el => el.dataset.hasInfo === 'true')
            .map(el => el.dataset.title);
        expect(withInfo).toEqual(['혼재']);
    });

    it('혼재 구획에만 종목이 있어도 빈 섹터로 취급하지 않는다', () => {
        renderBody('ready', { ...EMPTY_VIEW, mixedStocks: [stock('MX')] });
        expect(screen.getAllByTestId('subsection')).toHaveLength(5);
    });

    it('scope의 통화 기호와 tickerIsReadable을 모든 소절에 넘긴다', () => {
        render(
            <SectorSignalBody
                scope={{
                    ...TEST_SCOPE,
                    currencySymbol: '₩',
                    tickerIsReadable: false,
                }}
                status="ready"
                view={FULL_VIEW}
                onRetry={vi.fn()}
            />
        );
        for (const el of screen.getAllByTestId('subsection')) {
            expect(el).toHaveAttribute('data-currency', '₩');
            expect(el).toHaveAttribute('data-ticker-readable', 'false');
        }
    });
});

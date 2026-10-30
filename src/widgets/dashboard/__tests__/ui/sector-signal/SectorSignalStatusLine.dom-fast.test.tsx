import { screen } from '@testing-library/react';
import type { StockWithConflict } from '@y0ngha/siglens-core';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';
import { SectorSignalStatusLine } from '@/widgets/dashboard/ui/sector-signal/SectorSignalStatusLine';
import type { SectorSignalView } from '@/widgets/dashboard/utils/sectorSignalStocks';

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

const VIEW: SectorSignalView = {
    quadrants: {
        bullishConfirmed: [stock('A'), stock('B')],
        bullishExpected: [stock('C')],
        bearishExpected: [],
        bearishConfirmed: [stock('D'), stock('E'), stock('F')],
    },
    mixedStocks: [stock('G')],
};

describe('SectorSignalStatusLine', () => {
    it('화면에는 보이지 않는 상태 줄(live region)이다', () => {
        renderWithIntl(<SectorSignalStatusLine status="ready" view={VIEW} />);
        expect(screen.getByRole('status')).toHaveClass('sr-only');
    });

    it('준비되면 소절별 종목 수를 알린다', () => {
        renderWithIntl(<SectorSignalStatusLine status="ready" view={VIEW} />);
        expect(screen.getByRole('status')).toHaveTextContent(
            '종목 수: 상승 신호 2개, 상승 조짐 1개, 혼재 1개, 하락 조짐 0개, 하락 신호 3개'
        );
    });

    it('준비됐지만 종목이 없으면 빈 섹터 문구를 알린다', () => {
        renderWithIntl(
            <SectorSignalStatusLine status="ready" view={EMPTY_VIEW} />
        );
        expect(screen.getByRole('status')).toHaveTextContent(
            '이 섹터에는 지금 잡힌 신호가 없어요. 다른 섹터를 살펴보세요.'
        );
    });

    it('조회 중에는 불러오는 중이라고 알린다', () => {
        renderWithIntl(
            <SectorSignalStatusLine status="loading" view={EMPTY_VIEW} />
        );
        expect(screen.getByRole('status')).toHaveTextContent(
            '섹터 신호를 불러오는 중이에요.'
        );
    });

    it('실패하면 비워 둔다 — 실패는 알림 역할이 따로 알린다', () => {
        renderWithIntl(
            <SectorSignalStatusLine status="error" view={EMPTY_VIEW} />
        );
        expect(screen.getByRole('status')).toBeEmptyDOMElement();
    });

    it.each([
        [
            'en',
            'Stocks by group: uptrend signals 2, bullish signs 1, mixed 1, bearish signs 0, downtrend signals 3',
        ],
        [
            'ja',
            '銘柄数：上昇シグナル2、上昇の兆し1、混在1、下落の兆し0、下落シグナル3',
        ],
        [
            'zh',
            '股票数量：上涨信号 2 只，上涨迹象 1 只，混合 1 只，下跌迹象 0 只，下跌信号 3 只',
        ],
    ] as const)('%s: 요약 문구가 그 로케일이다', (locale, text) => {
        renderWithIntl(<SectorSignalStatusLine status="ready" view={VIEW} />, {
            locale,
        });
        expect(screen.getByRole('status')).toHaveTextContent(text);
    });
});

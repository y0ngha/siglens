import type { HomeTodayMarketData } from '../loadHomeTodayMarket';
import { toTodayMarketView } from '../todayMarketView';

const EMPTY: HomeTodayMarketData = {
    fearGreed: { us: null, kr: null, crypto: null },
    signals: {
        us: { rows: [], computedAt: null },
        kr: { rows: [], computedAt: null },
    },
};

const ROW = {
    symbol: 'NVDA',
    koreanName: '엔비디아',
    changePercent: 1,
    signalType: 'golden_cross',
    expected: false,
} as const;

describe('toTodayMarketView', () => {
    it('그릴 것이 하나도 없으면 null — 페이지가 섹션과 여백을 함께 뺀다', () => {
        expect(toTodayMarketView(EMPTY)).toBeNull();
    });

    it('웜업(점수 null) 시장만 있으면 null이다', () => {
        const data: HomeTodayMarketData = {
            ...EMPTY,
            fearGreed: {
                ...EMPTY.fearGreed,
                us: { date: '2026-11-13', score: null, label: null },
            },
        };

        expect(toTodayMarketView(data)).toBeNull();
    });

    it('점수는 반올림하고 시장 순서(미국·한국·코인)와 허브 경로를 지킨다', () => {
        const view = toTodayMarketView({
            ...EMPTY,
            fearGreed: {
                crypto: { date: '2026-11-15', score: 70.4, label: 'GREED' },
                us: { date: '2026-11-13', score: 45.5, label: 'NEUTRAL' },
                kr: null,
            },
        });

        expect(view?.tiles).toEqual([
            {
                id: 'us',
                href: '/fear-greed',
                labelKey: 'marketUs',
                date: '2026-11-13',
                score: 46,
                sentiment: 'NEUTRAL',
            },
            {
                id: 'crypto',
                href: '/fear-greed/crypto',
                labelKey: 'marketCrypto',
                date: '2026-11-15',
                score: 70,
                sentiment: 'GREED',
            },
        ]);
    });

    it('신호가 있는 시장만 묶음으로 내고 전체 보기 경로와 스캔 시각을 붙인다', () => {
        const view = toTodayMarketView({
            ...EMPTY,
            signals: {
                us: { rows: [], computedAt: '2026-11-14T21:00:00.000Z' },
                kr: { rows: [ROW], computedAt: '2026-11-15T06:00:00.000Z' },
            },
        });

        expect(view?.tiles).toEqual([]);
        expect(view?.signalGroups).toEqual([
            {
                id: 'kr',
                href: '/market/kr',
                labelKey: 'signalsKr',
                rows: [ROW],
                computedAt: '2026-11-15T06:00:00.000Z',
            },
        ]);
    });
});

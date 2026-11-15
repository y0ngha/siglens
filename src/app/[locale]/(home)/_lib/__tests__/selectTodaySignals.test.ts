import type { Signal, StockSignalResult } from '@y0ngha/siglens-core';
import { selectTodaySignals } from '../selectTodaySignals';

function signal(
    type: Signal['type'],
    phase: Signal['phase'] = 'confirmed'
): Signal {
    return { type, phase, direction: 'bullish', detectedAt: 0 };
}

function stock(
    symbol: string,
    signals: readonly Signal[],
    changePercent = 1,
    koreanName = `${symbol}이름`
): StockSignalResult {
    return {
        symbol,
        koreanName,
        sectorSymbol: 'XLK',
        price: 100,
        changePercent,
        trend: 'uptrend',
        signals,
    };
}

describe('selectTodaySignals', () => {
    it('수요 큰 신호(골든크로스)를 흔한 신호(CCI 교차)보다 앞에 둔다', () => {
        const rows = selectTodaySignals(
            [
                stock('CCI', [signal('cci_bullish_cross')], 9),
                stock('GOLD', [signal('golden_cross')], 0.5),
            ],
            5
        );

        expect(rows.map(row => row.symbol)).toEqual(['GOLD', 'CCI']);
    });

    it('종목마다 가장 높은 우선순위 신호 하나를 대표로 고른다', () => {
        const [row] = selectTodaySignals(
            [
                stock('AAPL', [
                    signal('cci_bullish_cross'),
                    signal('new_52w_high'),
                ]),
            ],
            5
        );

        expect(row?.signalType).toBe('new_52w_high');
    });

    it('같은 우선순위면 등락률 크기(부호 무관)가 큰 종목이 앞이다', () => {
        const rows = selectTodaySignals(
            [
                stock('SMALL', [signal('golden_cross')], 0.3),
                stock('DROP', [signal('golden_cross')], -4),
                stock('MID', [signal('golden_cross')], 2),
            ],
            5
        );

        expect(rows.map(row => row.symbol)).toEqual(['DROP', 'MID', 'SMALL']);
    });

    it('우선순위 목록 밖의 예상(expected) 신호만 가진 종목은 뺀다', () => {
        const rows = selectTodaySignals(
            [
                stock('EXP', [signal('bollinger_squeeze_bullish', 'expected')]),
                stock('CONF', [signal('cmf_bullish_flip', 'confirmed')]),
            ],
            5
        );

        expect(rows.map(row => row.symbol)).toEqual(['CONF']);
    });

    it('우선순위 목록 안의 신호는 예상 단계여도 받는다', () => {
        const rows = selectTodaySignals(
            [stock('DIV', [signal('rsi_bullish_divergence', 'expected')])],
            5
        );

        expect(rows.map(row => [row.signalType, row.expected])).toEqual([
            ['rsi_bullish_divergence', true],
        ]);
    });

    it('확정 신호를 예상 신호보다 앞에 둔다 — 우선순위가 더 높은 예상 신호보다도', () => {
        const rows = selectTodaySignals(
            [
                stock('EXPGOLD', [signal('golden_cross', 'expected')], 9),
                stock('HIGH', [signal('new_52w_high', 'confirmed')], 0.1),
            ],
            5
        );

        expect(rows.map(row => [row.symbol, row.expected])).toEqual([
            ['HIGH', false],
            ['EXPGOLD', true],
        ]);
    });

    it('한 종목 안에서도 확정 신호를 대표로 고른다', () => {
        const [row] = selectTodaySignals(
            [
                stock('X', [
                    signal('golden_cross', 'expected'),
                    signal('macd_bullish_cross', 'confirmed'),
                ]),
            ],
            5
        );

        expect(row).toMatchObject({
            signalType: 'macd_bullish_cross',
            expected: false,
        });
    });

    it('스캐너가 같은 종목을 두 번 실어도 한 번만 낸다', () => {
        const rows = selectTodaySignals(
            [
                stock('NVDA', [signal('golden_cross')]),
                stock('NVDA', [signal('golden_cross')]),
            ],
            5
        );

        expect(rows).toHaveLength(1);
    });

    it('limit개에서 자른다', () => {
        const rows = selectTodaySignals(
            ['A', 'B', 'C'].map(symbol => stock(symbol, [signal('gap_up')])),
            2
        );

        expect(rows).toHaveLength(2);
    });

    it('한글 이름이 빈 문자열이면 null로 둔다', () => {
        const [row] = selectTodaySignals(
            [stock('X', [signal('gap_up')], 1, '')],
            5
        );

        expect(row?.koreanName).toBeNull();
    });

    it('신호가 없으면 빈 목록이다', () => {
        expect(selectTodaySignals([stock('NONE', [])], 5)).toEqual([]);
    });
});

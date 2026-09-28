import {
    CCI_OVERBOUGHT_LEVEL,
    CCI_OVERSOLD_LEVEL,
    CCI_ZERO_LEVEL,
    RSI_OVERBOUGHT_LEVEL,
    RSI_OVERSOLD_LEVEL,
    type IndicatorResult,
} from '@y0ngha/siglens-core';
import { CHART_COLORS } from '@/shared/lib/chartColors';
import { LINE_PANE_SPECS } from '@/widgets/chart/model/linePaneSpecs';

describe('LINE_PANE_SPECS', () => {
    it('names only colour keys that exist in CHART_COLORS', () => {
        for (const [key, spec] of Object.entries(LINE_PANE_SPECS)) {
            const colours = [
                spec.lineColor,
                ...spec.referenceLines.map(l => l.color),
            ];
            for (const colour of colours) {
                expect(CHART_COLORS[colour], `${key}.${colour}`).toEqual(
                    expect.any(String)
                );
            }
        }
    });

    it('keeps the reference levels the oscillators are read against', () => {
        expect(LINE_PANE_SPECS.rsi.referenceLines).toEqual([
            { price: RSI_OVERBOUGHT_LEVEL, color: 'rsiOverbought' },
            { price: RSI_OVERSOLD_LEVEL, color: 'rsiOversold' },
        ]);
        expect(LINE_PANE_SPECS.cci.referenceLines).toEqual([
            { price: CCI_OVERBOUGHT_LEVEL, color: 'cciOverbought' },
            { price: CCI_OVERSOLD_LEVEL, color: 'cciOversold' },
            { price: CCI_ZERO_LEVEL, color: 'cciZero' },
        ]);
        expect(
            LINE_PANE_SPECS.williamsR.referenceLines.map(l => l.price)
        ).toEqual([-20, -80]);
        expect(
            LINE_PANE_SPECS.bollingerPercentB.referenceLines.map(l => l.price)
        ).toEqual([1, 0]);
        for (const key of [
            'obv',
            'atr',
            'yangZhang',
            'ewmaVolatility',
        ] as const) {
            expect(LINE_PANE_SPECS[key].referenceLines).toEqual([]);
        }
    });

    it('selects each indicator series by its own key', () => {
        const indicators = new Proxy(
            {},
            { get: (_, prop) => [String(prop)] }
        ) as unknown as IndicatorResult;
        for (const [key, spec] of Object.entries(LINE_PANE_SPECS)) {
            if (key === 'bollingerPercentB') continue;
            expect(spec.values(indicators), key).toEqual([key]);
        }
    });

    it('derives %B from the bollingerDerived rows', () => {
        const indicators = {
            bollingerDerived: [{ pctB: 0.4 }, { pctB: null }],
        } as unknown as IndicatorResult;
        expect(LINE_PANE_SPECS.bollingerPercentB.values(indicators)).toEqual([
            0.4,
            null,
        ]);
    });
});

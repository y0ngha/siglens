import { buildPaneLabels } from '@/widgets/chart/utils/paneLabelUtils';
import { CHART_COLORS } from '@/shared/lib/chartColors';
import {
    CCI_DEFAULT_PERIOD,
    DMI_DEFAULT_PERIOD,
    MACD_FAST_PERIOD,
    MACD_SIGNAL_PERIOD,
    MACD_SLOW_PERIOD,
    RSI_DEFAULT_PERIOD,
    STOCH_RSI_D_PERIOD,
    STOCH_RSI_K_PERIOD,
    STOCH_RSI_RSI_PERIOD,
    STOCH_RSI_STOCH_PERIOD,
    STOCHASTIC_D_PERIOD,
    STOCHASTIC_K_PERIOD,
    STOCHASTIC_SMOOTHING,
} from '@y0ngha/siglens-core';
import type { PaneIndices } from '@/widgets/chart/types';
import { INACTIVE_PANE_INDEX } from '@/widgets/chart/constants';

// PaneIndices는 모든 IndicatorKey(24개)를 가진 Record다. buildPaneLabels가
// 읽는 건 13개 pane 키뿐이므로, 나머지 overlay 키(ma·ema·ichimoku·bollinger·volumeProfile)와
// 아직 렌더되지 않는 group-C pane 키를 INACTIVE로 채운 base에 해당 pane 키만 덮어쓴다.
function makePaneIndices(overrides: Partial<PaneIndices> = {}): PaneIndices {
    const base = {
        ma: INACTIVE_PANE_INDEX,
        ema: INACTIVE_PANE_INDEX,
        ichimoku: INACTIVE_PANE_INDEX,
        rsi: INACTIVE_PANE_INDEX,
        macd: INACTIVE_PANE_INDEX,
        dmi: INACTIVE_PANE_INDEX,
        stochastic: INACTIVE_PANE_INDEX,
        stochRsi: INACTIVE_PANE_INDEX,
        cci: INACTIVE_PANE_INDEX,
        bollinger: INACTIVE_PANE_INDEX,
        volumeProfile: INACTIVE_PANE_INDEX,
        mfi: INACTIVE_PANE_INDEX,
        williamsR: INACTIVE_PANE_INDEX,
        connorsRsi: INACTIVE_PANE_INDEX,
        cmf: INACTIVE_PANE_INDEX,
        bollingerPercentB: INACTIVE_PANE_INDEX,
        hurst: INACTIVE_PANE_INDEX,
        varianceRatio: INACTIVE_PANE_INDEX,
        macdV: INACTIVE_PANE_INDEX,
        forceIndex: INACTIVE_PANE_INDEX,
        obv: INACTIVE_PANE_INDEX,
        atr: INACTIVE_PANE_INDEX,
        yangZhang: INACTIVE_PANE_INDEX,
        ewmaVolatility: INACTIVE_PANE_INDEX,
    } satisfies PaneIndices;
    return { ...base, ...overrides };
}

const ALL_INACTIVE: PaneIndices = makePaneIndices();

describe('buildPaneLabels', () => {
    describe('모든 지표가 비활성일 때', () => {
        it('빈 배열을 반환한다', () => {
            const result = buildPaneLabels(ALL_INACTIVE);

            expect(result).toEqual([]);
        });
    });

    describe('RSI만 활성일 때', () => {
        const RSI_PANE_INDEX = 1;
        const paneIndices = makePaneIndices({ rsi: RSI_PANE_INDEX });

        it('RSI pane 라벨 1개와 서브 라벨 1개를 반환한다', () => {
            const result = buildPaneLabels(paneIndices);

            expect(result).toHaveLength(1);
            expect(result[0].paneIndex).toBe(RSI_PANE_INDEX);
            expect(result[0].subLabels).toHaveLength(1);
            expect(result[0].subLabels[0].name).toBe(
                `RSI(${RSI_DEFAULT_PERIOD})`
            );
            expect(result[0].subLabels[0].color).toBe(CHART_COLORS.rsiLine);
        });
    });

    describe('MACD만 활성일 때', () => {
        const MACD_PANE_INDEX = 1;
        const paneIndices = makePaneIndices({ macd: MACD_PANE_INDEX });

        it('MACD pane 라벨 1개와 서브 라벨 3개를 반환한다', () => {
            const result = buildPaneLabels(paneIndices);

            expect(result).toHaveLength(1);
            expect(result[0].paneIndex).toBe(MACD_PANE_INDEX);
            expect(result[0].subLabels).toHaveLength(3);
        });

        it('MACD Line, Signal, Histogram 순서로 서브 라벨이 구성된다', () => {
            const result = buildPaneLabels(paneIndices);

            const [macdLine, signal, histogram] = result[0].subLabels;

            expect(macdLine.name).toBe(
                `MACD(${MACD_FAST_PERIOD},${MACD_SLOW_PERIOD},${MACD_SIGNAL_PERIOD})`
            );
            expect(macdLine.color).toBe(CHART_COLORS.macdLine);

            expect(signal.name).toBe('Signal');
            expect(signal.color).toBe(CHART_COLORS.macdSignal);

            expect(histogram.name).toBe('Histogram');
            expect(histogram.color).toBe(CHART_COLORS.macdHistogramBullish);
        });
    });

    describe('DMI만 활성일 때', () => {
        const DMI_PANE_INDEX = 1;
        const paneIndices = makePaneIndices({ dmi: DMI_PANE_INDEX });

        it('DMI pane 라벨 1개와 서브 라벨 3개를 반환한다', () => {
            const result = buildPaneLabels(paneIndices);

            expect(result).toHaveLength(1);
            expect(result[0].paneIndex).toBe(DMI_PANE_INDEX);
            expect(result[0].subLabels).toHaveLength(3);
        });

        it('+DI, -DI, ADX 순서로 서브 라벨이 구성된다', () => {
            const result = buildPaneLabels(paneIndices);

            const [diPlus, diMinus, adx] = result[0].subLabels;

            expect(diPlus.name).toBe(`+DI(${DMI_DEFAULT_PERIOD})`);
            expect(diPlus.color).toBe(CHART_COLORS.dmiPlus);

            expect(diMinus.name).toBe(`-DI(${DMI_DEFAULT_PERIOD})`);
            expect(diMinus.color).toBe(CHART_COLORS.dmiMinus);

            expect(adx.name).toBe(`ADX(${DMI_DEFAULT_PERIOD})`);
            expect(adx.color).toBe(CHART_COLORS.dmiAdx);
        });
    });

    describe('RSI+MACD+DMI 활성일 때', () => {
        const paneIndices = makePaneIndices({ rsi: 1, macd: 2, dmi: 3 });

        it('RSI, MACD, DMI 순서로 3개의 pane 라벨을 반환한다', () => {
            const result = buildPaneLabels(paneIndices);

            expect(result).toHaveLength(3);
            expect(result[0].paneIndex).toBe(1);
            expect(result[1].paneIndex).toBe(2);
            expect(result[2].paneIndex).toBe(3);
        });

        it('각 pane의 서브 라벨 개수가 올바르다 (RSI:1, MACD:3, DMI:3)', () => {
            const result = buildPaneLabels(paneIndices);

            expect(result[0].subLabels).toHaveLength(1);
            expect(result[1].subLabels).toHaveLength(3);
            expect(result[2].subLabels).toHaveLength(3);
        });
    });

    describe('모든 지표가 활성일 때', () => {
        const paneIndices = makePaneIndices({
            rsi: 1,
            macd: 2,
            dmi: 3,
            stochastic: 4,
            stochRsi: 5,
            cci: 6,
            mfi: 7,
            williamsR: 8,
            connorsRsi: 9,
            cmf: 10,
            bollingerPercentB: 11,
            hurst: 12,
            varianceRatio: 13,
        });

        it('등록 순서대로 13개의 pane 라벨을 1~13 index로 반환한다', () => {
            const result = buildPaneLabels(paneIndices);

            // pane 키 13개 → PaneLabelConfig 13개 (subLabel 수와 무관하게 pane당 1 entry).
            expect(result).toHaveLength(13);
            expect(result.map(label => label.paneIndex)).toEqual([
                1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13,
            ]);
        });

        it('각 pane의 서브 라벨 개수가 올바르다 (RSI:1, MACD:3, DMI:3, Stochastic:2, StochRSI:2, CCI:1, group-B 각 1)', () => {
            const result = buildPaneLabels(paneIndices);

            // rsi macd dmi stoch stochRsi cci | mfi wR cRsi cmf %B hurst vr
            expect(result.map(label => label.subLabels.length)).toEqual([
                1, 3, 3, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1,
            ]);
        });
    });

    describe('Stochastic만 활성일 때', () => {
        const STOCHASTIC_PANE_INDEX = 1;
        const paneIndices = makePaneIndices({
            stochastic: STOCHASTIC_PANE_INDEX,
        });

        it('Stochastic pane 라벨 1개와 서브 라벨 2개를 반환한다', () => {
            const result = buildPaneLabels(paneIndices);

            expect(result).toHaveLength(1);
            expect(result[0].paneIndex).toBe(STOCHASTIC_PANE_INDEX);
            expect(result[0].subLabels).toHaveLength(2);
        });

        it('%K, %D 순서로 서브 라벨이 구성된다', () => {
            const result = buildPaneLabels(paneIndices);

            const [percentK, percentD] = result[0].subLabels;

            expect(percentK.name).toBe(
                `%K(${STOCHASTIC_K_PERIOD},${STOCHASTIC_D_PERIOD},${STOCHASTIC_SMOOTHING})`
            );
            expect(percentK.color).toBe(CHART_COLORS.stochasticK);

            expect(percentD.name).toBe('%D');
            expect(percentD.color).toBe(CHART_COLORS.stochasticD);
        });
    });

    describe('StochRSI만 활성일 때', () => {
        const STOCH_RSI_PANE_INDEX = 1;
        const paneIndices = makePaneIndices({
            stochRsi: STOCH_RSI_PANE_INDEX,
        });

        it('StochRSI pane 라벨 1개와 서브 라벨 2개를 반환한다', () => {
            const result = buildPaneLabels(paneIndices);

            expect(result).toHaveLength(1);
            expect(result[0].paneIndex).toBe(STOCH_RSI_PANE_INDEX);
            expect(result[0].subLabels).toHaveLength(2);
        });

        it('StochRSI, %D 순서로 서브 라벨이 구성된다', () => {
            const result = buildPaneLabels(paneIndices);

            const [stochRsiK, stochRsiD] = result[0].subLabels;

            expect(stochRsiK.name).toBe(
                `StochRSI(${STOCH_RSI_RSI_PERIOD},${STOCH_RSI_STOCH_PERIOD},${STOCH_RSI_K_PERIOD},${STOCH_RSI_D_PERIOD})`
            );
            expect(stochRsiK.color).toBe(CHART_COLORS.stochRsiK);

            expect(stochRsiD.name).toBe('%D');
            expect(stochRsiD.color).toBe(CHART_COLORS.stochRsiD);
        });
    });

    describe('각 서브 라벨의 색상이 CHART_COLORS와 일치하는지 확인', () => {
        it('모든 서브 라벨의 색상이 올바르다 (13개 pane 전부)', () => {
            const paneIndices = makePaneIndices({
                rsi: 1,
                macd: 2,
                dmi: 3,
                stochastic: 4,
                stochRsi: 5,
                cci: 6,
                mfi: 7,
                williamsR: 8,
                connorsRsi: 9,
                cmf: 10,
                bollingerPercentB: 11,
                hurst: 12,
                varianceRatio: 13,
            });
            const result = buildPaneLabels(paneIndices);

            const allColors = result.flatMap(label =>
                label.subLabels.map(sub => sub.color)
            );

            expect(allColors).toEqual([
                CHART_COLORS.rsiLine,
                CHART_COLORS.macdLine,
                CHART_COLORS.macdSignal,
                CHART_COLORS.macdHistogramBullish,
                CHART_COLORS.dmiPlus,
                CHART_COLORS.dmiMinus,
                CHART_COLORS.dmiAdx,
                CHART_COLORS.stochasticK,
                CHART_COLORS.stochasticD,
                CHART_COLORS.stochRsiK,
                CHART_COLORS.stochRsiD,
                CHART_COLORS.cciLine,
                CHART_COLORS.mfiLine,
                CHART_COLORS.williamsRLine,
                CHART_COLORS.connorsRsiLine,
                CHART_COLORS.cmfLine,
                CHART_COLORS.bollingerPercentBLine,
                CHART_COLORS.hurstLine,
                CHART_COLORS.varianceRatioLine,
            ]);
        });
    });

    describe('부분 활성 조합일 때', () => {
        it('RSI+DMI만 활성이면 연속적인 pane index를 사용한다', () => {
            const paneIndices = makePaneIndices({ rsi: 1, dmi: 2 });
            const result = buildPaneLabels(paneIndices);

            expect(result).toHaveLength(2);
            expect(result[0].paneIndex).toBe(1);
            expect(result[1].paneIndex).toBe(2);
        });

        it('MACD+DMI만 활성이면 pane 1, 2에 할당된다', () => {
            const paneIndices = makePaneIndices({ macd: 1, dmi: 2 });
            const result = buildPaneLabels(paneIndices);

            expect(result).toHaveLength(2);
            expect(result[0].paneIndex).toBe(1);
            expect(result[0].subLabels).toHaveLength(3);
            expect(result[1].paneIndex).toBe(2);
            expect(result[1].subLabels).toHaveLength(3);
        });

        it('RSI+MACD만 활성이면 pane 1, 2에 할당된다', () => {
            const paneIndices = makePaneIndices({ rsi: 1, macd: 2 });
            const result = buildPaneLabels(paneIndices);

            expect(result).toHaveLength(2);
            expect(result[0].paneIndex).toBe(1);
            expect(result[0].subLabels).toHaveLength(1);
            expect(result[1].paneIndex).toBe(2);
            expect(result[1].subLabels).toHaveLength(3);
        });
    });

    describe('group-B pane가 활성일 때', () => {
        it('builds labels for active group-B panes', () => {
            const labels = buildPaneLabels(
                makePaneIndices({ mfi: 1, hurst: 2 })
            );

            expect(labels).toHaveLength(2);
            const names = labels.flatMap(l => l.subLabels.map(s => s.name));
            expect(names).toEqual(['MFI', 'Hurst']);
            // MFI·Hurst 색상도 명시 검증 (group-B 색상 미검증 pane 없도록).
            expect(labels[0].subLabels[0].color).toBe(CHART_COLORS.mfiLine);
            expect(labels[1].subLabels[0].color).toBe(CHART_COLORS.hurstLine);
        });

        it('builds single-subLabel labels for each group-B pane', () => {
            const cases: Array<[keyof PaneIndices, string, string]> = [
                ['williamsR', 'Williams %R', CHART_COLORS.williamsRLine],
                ['connorsRsi', 'CRSI', CHART_COLORS.connorsRsiLine],
                ['cmf', 'CMF', CHART_COLORS.cmfLine],
                ['bollingerPercentB', '%B', CHART_COLORS.bollingerPercentBLine],
                ['varianceRatio', 'VR', CHART_COLORS.varianceRatioLine],
            ];

            for (const [key, name, color] of cases) {
                const labels = buildPaneLabels(makePaneIndices({ [key]: 1 }));

                expect(labels).toHaveLength(1);
                expect(labels[0].paneIndex).toBe(1);
                expect(labels[0].subLabels).toEqual([{ name, color }]);
            }
        });
    });

    describe('group-C-simple pane가 활성일 때', () => {
        it.each([
            ['macdV', 'MACD-V', CHART_COLORS.macdVLine],
            ['forceIndex', 'Force Index', CHART_COLORS.forceIndexLine],
            ['obv', 'OBV', CHART_COLORS.obvLine],
            ['atr', 'ATR', CHART_COLORS.atrLine],
            ['yangZhang', 'Yang-Zhang', CHART_COLORS.yangZhangLine],
            ['ewmaVolatility', 'EWMA Vol', CHART_COLORS.ewmaVolatilityLine],
        ] as const satisfies ReadonlyArray<
            [keyof PaneIndices, string, string]
        >)('builds %s pane label', (key, name, color) => {
            const labels = buildPaneLabels(makePaneIndices({ [key]: 1 }));

            expect(labels).toHaveLength(1);
            expect(labels[0].subLabels).toEqual([{ name, color }]);
        });
    });

    describe('CCI만 활성일 때', () => {
        const CCI_PANE_INDEX = 1;
        const paneIndices = makePaneIndices({ cci: CCI_PANE_INDEX });

        it('CCI pane 라벨 1개와 서브 라벨 1개를 반환한다', () => {
            const result = buildPaneLabels(paneIndices);

            expect(result).toHaveLength(1);
            expect(result[0].paneIndex).toBe(CCI_PANE_INDEX);
            expect(result[0].subLabels).toHaveLength(1);
            expect(result[0].subLabels[0].name).toBe(
                `CCI(${CCI_DEFAULT_PERIOD})`
            );
            expect(result[0].subLabels[0].color).toBe(CHART_COLORS.cciLine);
        });
    });
});

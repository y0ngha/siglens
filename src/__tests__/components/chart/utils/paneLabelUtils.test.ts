import { buildPaneLabels } from '@/components/chart/utils/paneLabelUtils';
import { CHART_COLORS } from '@/domain/constants/colors';
import {
    RSI_DEFAULT_PERIOD,
    MACD_FAST_PERIOD,
    MACD_SLOW_PERIOD,
    MACD_SIGNAL_PERIOD,
    DMI_DEFAULT_PERIOD,
    STOCHASTIC_K_PERIOD,
    STOCHASTIC_D_PERIOD,
    STOCHASTIC_SMOOTHING,
} from '@/domain/indicators/constants';
import type { PaneIndices } from '@/components/chart/types';
import { INACTIVE_PANE_INDEX } from '@/components/chart/constants';

const ALL_INACTIVE: PaneIndices = {
    rsi: INACTIVE_PANE_INDEX,
    macd: INACTIVE_PANE_INDEX,
    dmi: INACTIVE_PANE_INDEX,
    stochastic: INACTIVE_PANE_INDEX,
};

describe('buildPaneLabels', () => {
    describe('모든 지표가 비활성일 때', () => {
        it('빈 배열을 반환한다', () => {
            const result = buildPaneLabels(ALL_INACTIVE);

            expect(result).toEqual([]);
        });
    });

    describe('RSI만 활성일 때', () => {
        const RSI_PANE_INDEX = 1;
        const paneIndices: PaneIndices = {
            rsi: RSI_PANE_INDEX,
            macd: INACTIVE_PANE_INDEX,
            dmi: INACTIVE_PANE_INDEX,
            stochastic: INACTIVE_PANE_INDEX,
        };

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
        const paneIndices: PaneIndices = {
            rsi: INACTIVE_PANE_INDEX,
            macd: MACD_PANE_INDEX,
            dmi: INACTIVE_PANE_INDEX,
            stochastic: INACTIVE_PANE_INDEX,
        };

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
        const paneIndices: PaneIndices = {
            rsi: INACTIVE_PANE_INDEX,
            macd: INACTIVE_PANE_INDEX,
            dmi: DMI_PANE_INDEX,
            stochastic: INACTIVE_PANE_INDEX,
        };

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
        const paneIndices: PaneIndices = {
            rsi: 1,
            macd: 2,
            dmi: 3,
            stochastic: INACTIVE_PANE_INDEX,
        };

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
        const paneIndices: PaneIndices = {
            rsi: 1,
            macd: 2,
            dmi: 3,
            stochastic: 4,
        };

        it('RSI, MACD, DMI, Stochastic 순서로 4개의 pane 라벨을 반환한다', () => {
            const result = buildPaneLabels(paneIndices);

            expect(result).toHaveLength(4);
            expect(result[0].paneIndex).toBe(1);
            expect(result[1].paneIndex).toBe(2);
            expect(result[2].paneIndex).toBe(3);
            expect(result[3].paneIndex).toBe(4);
        });

        it('각 pane의 서브 라벨 개수가 올바르다 (RSI:1, MACD:3, DMI:3, Stochastic:2)', () => {
            const result = buildPaneLabels(paneIndices);

            expect(result[0].subLabels).toHaveLength(1);
            expect(result[1].subLabels).toHaveLength(3);
            expect(result[2].subLabels).toHaveLength(3);
            expect(result[3].subLabels).toHaveLength(2);
        });
    });

    describe('Stochastic만 활성일 때', () => {
        const STOCHASTIC_PANE_INDEX = 1;
        const paneIndices: PaneIndices = {
            rsi: INACTIVE_PANE_INDEX,
            macd: INACTIVE_PANE_INDEX,
            dmi: INACTIVE_PANE_INDEX,
            stochastic: STOCHASTIC_PANE_INDEX,
        };

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

    describe('각 서브 라벨의 색상이 CHART_COLORS와 일치하는지 확인', () => {
        it('모든 서브 라벨의 색상이 올바르다', () => {
            const paneIndices: PaneIndices = {
                rsi: 1,
                macd: 2,
                dmi: 3,
                stochastic: 4,
            };
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
            ]);
        });
    });

    describe('부분 활성 조합일 때', () => {
        it('RSI+DMI만 활성이면 연속적인 pane index를 사용한다', () => {
            const paneIndices: PaneIndices = {
                rsi: 1,
                macd: INACTIVE_PANE_INDEX,
                dmi: 2,
                stochastic: INACTIVE_PANE_INDEX,
            };
            const result = buildPaneLabels(paneIndices);

            expect(result).toHaveLength(2);
            expect(result[0].paneIndex).toBe(1);
            expect(result[1].paneIndex).toBe(2);
        });

        it('MACD+DMI만 활성이면 pane 1, 2에 할당된다', () => {
            const paneIndices: PaneIndices = {
                rsi: INACTIVE_PANE_INDEX,
                macd: 1,
                dmi: 2,
                stochastic: INACTIVE_PANE_INDEX,
            };
            const result = buildPaneLabels(paneIndices);

            expect(result).toHaveLength(2);
            expect(result[0].paneIndex).toBe(1);
            expect(result[0].subLabels).toHaveLength(3);
            expect(result[1].paneIndex).toBe(2);
            expect(result[1].subLabels).toHaveLength(3);
        });

        it('RSI+MACD만 활성이면 pane 1, 2에 할당된다', () => {
            const paneIndices: PaneIndices = {
                rsi: 1,
                macd: 2,
                dmi: INACTIVE_PANE_INDEX,
                stochastic: INACTIVE_PANE_INDEX,
            };
            const result = buildPaneLabels(paneIndices);

            expect(result).toHaveLength(2);
            expect(result[0].paneIndex).toBe(1);
            expect(result[0].subLabels).toHaveLength(1);
            expect(result[1].paneIndex).toBe(2);
            expect(result[1].subLabels).toHaveLength(3);
        });
    });
});

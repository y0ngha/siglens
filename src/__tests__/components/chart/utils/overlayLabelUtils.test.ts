import {
    buildOverlayLabelConfigs,
    findBarIndex,
    resolveOverlayValues,
} from '@/components/chart/utils/overlayLabelUtils';
import { CHART_COLORS, getPeriodColor } from '@/lib/chartColors';
import type { Bar, IndicatorResult } from '@/domain/types';

const mockBars: Bar[] = [
    { time: 100, open: 10, high: 15, low: 9, close: 12, volume: 1000 },
    { time: 200, open: 12, high: 18, low: 11, close: 15, volume: 1200 },
    { time: 300, open: 15, high: 20, low: 14, close: 18, volume: 1100 },
    { time: 400, open: 18, high: 22, low: 17, close: 20, volume: 900 },
    { time: 500, open: 20, high: 25, low: 19, close: 23, volume: 1300 },
];

const mockIndicators: IndicatorResult = {
    ma: { 5: [100, 101, 102] },
    ema: {},
    macd: [],
    bollinger: [{ upper: 105, middle: 100, lower: 95 }],
    rsi: [],
    cci: [],
    dmi: [],
    stochastic: [],
    stochRsi: [],
    vwap: [],
    volumeProfile: { poc: 100, vah: 110, val: 90, profile: [] },
    ichimoku: [
        { tenkan: 101, kijun: 102, senkouA: 103, senkouB: 104, chikou: 100 },
    ],
};

describe('buildOverlayLabelConfigs', () => {
    describe('모든 파라미터가 비활성일 때', () => {
        it('빈 배열을 반환한다', () => {
            const result = buildOverlayLabelConfigs({
                maVisiblePeriods: [],
                emaVisiblePeriods: [],
                bollingerVisible: false,
                ichimokuVisible: false,
                vpVisible: false,
            });

            expect(result).toEqual([]);
        });
    });

    describe('MA 기간이 [5, 20]일 때', () => {
        it('MA(5), MA(20) 이름의 config 2개를 반환한다', () => {
            const result = buildOverlayLabelConfigs({
                maVisiblePeriods: [5, 20],
                emaVisiblePeriods: [],
                bollingerVisible: false,
                ichimokuVisible: false,
                vpVisible: false,
            });

            expect(result).toHaveLength(2);
            expect(result[0].name).toBe('MA(5)');
            expect(result[1].name).toBe('MA(20)');
        });
    });

    describe('EMA 기간이 [9]일 때', () => {
        it('EMA(9) 이름의 config 1개를 반환한다', () => {
            const result = buildOverlayLabelConfigs({
                maVisiblePeriods: [],
                emaVisiblePeriods: [9],
                bollingerVisible: false,
                ichimokuVisible: false,
                vpVisible: false,
            });

            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('EMA(9)');
        });
    });

    describe('bollingerVisible가 true일 때', () => {
        it('BB Upper, BB Middle, BB Lower 3개의 config를 반환한다', () => {
            const result = buildOverlayLabelConfigs({
                maVisiblePeriods: [],
                emaVisiblePeriods: [],
                bollingerVisible: true,
                ichimokuVisible: false,
                vpVisible: false,
            });

            expect(result).toHaveLength(3);
            expect(result[0].name).toBe('BB Upper');
            expect(result[1].name).toBe('BB Middle');
            expect(result[2].name).toBe('BB Lower');
        });
    });

    describe('ichimokuVisible가 true일 때', () => {
        it('Tenkan, Kijun, Chikou, Senkou A, Senkou B 5개의 config를 반환한다', () => {
            const result = buildOverlayLabelConfigs({
                maVisiblePeriods: [],
                emaVisiblePeriods: [],
                bollingerVisible: false,
                ichimokuVisible: true,
                vpVisible: false,
            });

            expect(result).toHaveLength(5);
            expect(result[0].name).toBe('Tenkan');
            expect(result[1].name).toBe('Kijun');
            expect(result[2].name).toBe('Chikou');
            expect(result[3].name).toBe('Senkou A');
            expect(result[4].name).toBe('Senkou B');
        });
    });

    describe('vpVisible가 true일 때', () => {
        it('POC, VAH, VAL 3개의 config를 반환한다', () => {
            const result = buildOverlayLabelConfigs({
                maVisiblePeriods: [],
                emaVisiblePeriods: [],
                bollingerVisible: false,
                ichimokuVisible: false,
                vpVisible: true,
            });

            expect(result).toHaveLength(3);
            expect(result[0].name).toBe('POC');
            expect(result[1].name).toBe('VAH');
            expect(result[2].name).toBe('VAL');
        });
    });

    describe('MA [5] + bollingerVisible 복합 조합일 때', () => {
        it('4개의 config를 MA → BB 순서로 반환한다', () => {
            const result = buildOverlayLabelConfigs({
                maVisiblePeriods: [5],
                emaVisiblePeriods: [],
                bollingerVisible: true,
                ichimokuVisible: false,
                vpVisible: false,
            });

            expect(result).toHaveLength(4);
            expect(result[0].name).toBe('MA(5)');
            expect(result[1].name).toBe('BB Upper');
            expect(result[2].name).toBe('BB Middle');
            expect(result[3].name).toBe('BB Lower');
        });
    });

    describe('색상 검증', () => {
        it('MA(5)의 color는 getPeriodColor(5)와 일치한다', () => {
            const result = buildOverlayLabelConfigs({
                maVisiblePeriods: [5],
                emaVisiblePeriods: [],
                bollingerVisible: false,
                ichimokuVisible: false,
                vpVisible: false,
            });

            expect(result[0].color).toBe(getPeriodColor(5));
        });

        it('BB Upper의 color는 CHART_COLORS.bollingerUpper와 일치한다', () => {
            const result = buildOverlayLabelConfigs({
                maVisiblePeriods: [],
                emaVisiblePeriods: [],
                bollingerVisible: true,
                ichimokuVisible: false,
                vpVisible: false,
            });

            expect(result[0].color).toBe(CHART_COLORS.bollingerUpper);
        });
    });
});

describe('findBarIndex', () => {
    describe('빈 bars 배열일 때', () => {
        it('-1을 반환한다', () => {
            expect(findBarIndex([], 100)).toBe(-1);
        });
    });

    describe('정확한 시간 매칭일 때', () => {
        it('해당 index를 반환한다', () => {
            expect(findBarIndex(mockBars, 300)).toBe(2);
        });
    });

    describe('bars보다 이른 시간일 때', () => {
        it('0을 반환한다', () => {
            expect(findBarIndex(mockBars, 50)).toBe(0);
        });
    });

    describe('bars보다 늦은 시간일 때', () => {
        it('bars.length - 1을 반환한다', () => {
            expect(findBarIndex(mockBars, 600)).toBe(mockBars.length - 1);
        });
    });

    describe('중간값일 때', () => {
        it('가장 가까운 index를 반환한다', () => {
            // time 250 is between bars[1]=200 and bars[2]=300 — equally distant, lower wins (250-200=50, 300-250=50)
            // with lowDiff <= highDiff check, low (index 2) wins when equal
            const result = findBarIndex(mockBars, 260);
            // 260 is closer to 300 (diff=40) than 200 (diff=60), so index 2
            expect(result).toBe(2);
        });
    });
});

describe('resolveOverlayValues', () => {
    const configs = buildOverlayLabelConfigs({
        maVisiblePeriods: [5],
        emaVisiblePeriods: [],
        bollingerVisible: true,
        ichimokuVisible: false,
        vpVisible: false,
    });

    describe('barIndex가 -1일 때', () => {
        it('모든 value가 null인 OverlayLegendItem 배열을 반환한다', () => {
            const result = resolveOverlayValues(configs, mockIndicators, -1);

            expect(result).toHaveLength(configs.length);
            result.forEach(item => {
                expect(item.value).toBeNull();
            });
        });
    });

    describe('유효한 barIndex일 때', () => {
        it('config.getValue 결과를 value로 반환한다', () => {
            const result = resolveOverlayValues(configs, mockIndicators, 0);

            expect(result[0].name).toBe('MA(5)');
            expect(result[0].value).toBe(100);
        });

        it('name과 color를 올바르게 포함한다', () => {
            const result = resolveOverlayValues(configs, mockIndicators, 0);

            result.forEach((item, idx) => {
                expect(item.name).toBe(configs[idx].name);
                expect(item.color).toBe(configs[idx].color);
            });
        });
    });

    describe('빈 configs일 때', () => {
        it('빈 배열을 반환한다', () => {
            const result = resolveOverlayValues([], mockIndicators, 0);

            expect(result).toEqual([]);
        });
    });
});

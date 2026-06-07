import {
    buildOverlayLabelConfigs,
    findBarIndex,
    resolveBarIndex,
    resolveOverlayValues,
} from '@/widgets/chart/utils/overlayLabelUtils';
import { CHART_COLORS, getPeriodColor } from '@/shared/lib/chartColors';
import { EMPTY_SMC_RESULT } from '@y0ngha/siglens-core';
import type { Bar, IndicatorResult } from '@y0ngha/siglens-core';

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
    atr: [],
    obv: [],
    parabolicSar: [],
    williamsR: [],
    supertrend: [],
    mfi: [],
    keltnerChannel: [],
    cmf: [],
    donchianChannel: [],
    squeezeMomentum: [],
    macdV: [],
    connorsRsi: [],
    forceIndex: [],
    elderRay: [],
    elderImpulse: [],
    bollingerDerived: [],
    chandelierExit: [],
    yangZhang: [],
    ewmaVolatility: [],
    hurst: [],
    varianceRatio: [],
    regression: [],
    buySellVolume: [],
    smc: EMPTY_SMC_RESULT,
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
                keltnerVisible: false,
                donchianVisible: false,
                supertrendVisible: false,
                parabolicSarVisible: false,
                chandelierVisible: false,
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
                keltnerVisible: false,
                donchianVisible: false,
                supertrendVisible: false,
                parabolicSarVisible: false,
                chandelierVisible: false,
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
                keltnerVisible: false,
                donchianVisible: false,
                supertrendVisible: false,
                parabolicSarVisible: false,
                chandelierVisible: false,
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
                keltnerVisible: false,
                donchianVisible: false,
                supertrendVisible: false,
                parabolicSarVisible: false,
                chandelierVisible: false,
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
                keltnerVisible: false,
                donchianVisible: false,
                supertrendVisible: false,
                parabolicSarVisible: false,
                chandelierVisible: false,
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
                keltnerVisible: false,
                donchianVisible: false,
                supertrendVisible: false,
                parabolicSarVisible: false,
                chandelierVisible: false,
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
                keltnerVisible: false,
                donchianVisible: false,
                supertrendVisible: false,
                parabolicSarVisible: false,
                chandelierVisible: false,
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
                keltnerVisible: false,
                donchianVisible: false,
                supertrendVisible: false,
                parabolicSarVisible: false,
                chandelierVisible: false,
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
                keltnerVisible: false,
                donchianVisible: false,
                supertrendVisible: false,
                parabolicSarVisible: false,
                chandelierVisible: false,
            });

            expect(result[0].color).toBe(CHART_COLORS.bollingerUpper);
        });
    });

    it('builds Keltner/Donchian legend configs when visible', () => {
        const configs = buildOverlayLabelConfigs({
            maVisiblePeriods: [],
            emaVisiblePeriods: [],
            bollingerVisible: false,
            ichimokuVisible: false,
            vpVisible: false,
            keltnerVisible: true,
            donchianVisible: true,
            supertrendVisible: false,
            parabolicSarVisible: false,
            chandelierVisible: false,
        });
        const names = configs.map(c => c.name);
        expect(names).toEqual(
            expect.arrayContaining([
                'KC Upper',
                'KC Middle',
                'KC Lower',
                'DC Upper',
                'DC Middle',
                'DC Lower',
            ])
        );
        const ind = {
            keltnerChannel: [{ upper: 11, middle: 10, lower: 9 }],
            donchianChannel: [{ upper: 21, middle: 20, lower: 19 }],
        } as unknown as Parameters<(typeof configs)[number]['getValue']>[0];
        expect(configs.find(c => c.name === 'KC Upper')?.getValue(ind, 0)).toBe(
            11
        );
        expect(configs.find(c => c.name === 'DC Lower')?.getValue(ind, 0)).toBe(
            19
        );
    });

    it('includes a Supertrend config when supertrendVisible is true', () => {
        const configs = buildOverlayLabelConfigs({
            maVisiblePeriods: [],
            emaVisiblePeriods: [],
            bollingerVisible: false,
            ichimokuVisible: false,
            vpVisible: false,
            keltnerVisible: false,
            donchianVisible: false,
            supertrendVisible: true,
            parabolicSarVisible: false,
            chandelierVisible: false,
        });
        const st = configs.find(c => c.name === 'Supertrend');
        expect(st).toBeDefined();
        expect(st?.color).toBe(CHART_COLORS.supertrendUp);
        const ind = { supertrend: [{ supertrend: 42, trend: 'up' }] } as never;
        expect(st?.getValue(ind, 0)).toBe(42);
        expect(st?.getValue(ind, 5)).toBeNull();
    });

    it('Supertrend getColor follows the bar trend (up=green, down=red, null=neutral)', () => {
        const configs = buildOverlayLabelConfigs({
            maVisiblePeriods: [],
            emaVisiblePeriods: [],
            bollingerVisible: false,
            ichimokuVisible: false,
            vpVisible: false,
            keltnerVisible: false,
            donchianVisible: false,
            supertrendVisible: true,
            parabolicSarVisible: false,
            chandelierVisible: false,
        });
        const st = configs.find(c => c.name === 'Supertrend');
        expect(st?.getColor).toBeDefined();
        const ind = {
            supertrend: [
                { supertrend: 10, trend: 'up' },
                { supertrend: 11, trend: 'down' },
                { supertrend: null, trend: null },
            ],
        } as never;
        expect(st?.getColor?.(ind, 0)).toBe(CHART_COLORS.supertrendUp);
        expect(st?.getColor?.(ind, 1)).toBe(CHART_COLORS.supertrendDown);
        expect(st?.getColor?.(ind, 2)).toBe(CHART_COLORS.neutral);
        // 범위를 벗어난 인덱스(warm-up 이전)도 neutral로 안전 처리
        expect(st?.getColor?.(ind, 9)).toBe(CHART_COLORS.neutral);
    });

    it('omits Supertrend config when supertrendVisible is false', () => {
        const configs = buildOverlayLabelConfigs({
            maVisiblePeriods: [],
            emaVisiblePeriods: [],
            bollingerVisible: false,
            ichimokuVisible: false,
            vpVisible: false,
            keltnerVisible: false,
            donchianVisible: false,
            supertrendVisible: false,
            parabolicSarVisible: false,
            chandelierVisible: false,
        });
        expect(configs.find(c => c.name === 'Supertrend')).toBeUndefined();
    });

    it('includes a PSAR config (value + trend getColor) when parabolicSarVisible', () => {
        const configs = buildOverlayLabelConfigs({
            maVisiblePeriods: [],
            emaVisiblePeriods: [],
            bollingerVisible: false,
            ichimokuVisible: false,
            vpVisible: false,
            keltnerVisible: false,
            donchianVisible: false,
            supertrendVisible: false,
            parabolicSarVisible: true,
            chandelierVisible: false,
        });
        const psar = configs.find(c => c.name === 'PSAR');
        expect(psar).toBeDefined();
        const ind = {
            parabolicSar: [
                { sar: 99, trend: 'up' },
                { sar: 98, trend: 'down' },
                { sar: null, trend: null },
            ],
        } as never;
        expect(psar?.getValue(ind, 0)).toBe(99);
        expect(psar?.getValue(ind, 2)).toBeNull(); // warm-up 구간(sar null)
        expect(psar?.getValue(ind, 9)).toBeNull();
        expect(psar?.getColor?.(ind, 0)).toBe(CHART_COLORS.parabolicSarUp);
        expect(psar?.getColor?.(ind, 1)).toBe(CHART_COLORS.parabolicSarDown);
        expect(psar?.getColor?.(ind, 2)).toBe(CHART_COLORS.neutral);
        expect(psar?.getColor?.(ind, 9)).toBe(CHART_COLORS.neutral);
    });

    it('includes a Chandelier config (active stop by trend + trend getColor) when chandelierVisible', () => {
        const configs = buildOverlayLabelConfigs({
            maVisiblePeriods: [],
            emaVisiblePeriods: [],
            bollingerVisible: false,
            ichimokuVisible: false,
            vpVisible: false,
            keltnerVisible: false,
            donchianVisible: false,
            supertrendVisible: false,
            parabolicSarVisible: false,
            chandelierVisible: true,
        });
        const ch = configs.find(c => c.name === 'Chandelier');
        expect(ch).toBeDefined();
        const ind = {
            chandelierExit: [
                { longStop: 90, shortStop: 110, trend: 'long' },
                { longStop: 91, shortStop: 111, trend: 'short' },
                { longStop: null, shortStop: null, trend: null },
            ],
        } as never;
        expect(ch?.getValue(ind, 0)).toBe(90);
        expect(ch?.getValue(ind, 1)).toBe(111);
        expect(ch?.getValue(ind, 2)).toBeNull();
        expect(ch?.getColor?.(ind, 0)).toBe(CHART_COLORS.chandelierLong);
        expect(ch?.getColor?.(ind, 1)).toBe(CHART_COLORS.chandelierShort);
        expect(ch?.getColor?.(ind, 2)).toBe(CHART_COLORS.neutral);
    });

    it('omits PSAR and Chandelier configs when their flags are false', () => {
        const configs = buildOverlayLabelConfigs({
            maVisiblePeriods: [],
            emaVisiblePeriods: [],
            bollingerVisible: false,
            ichimokuVisible: false,
            vpVisible: false,
            keltnerVisible: false,
            donchianVisible: false,
            supertrendVisible: false,
            parabolicSarVisible: false,
            chandelierVisible: false,
        });
        expect(configs.find(c => c.name === 'PSAR')).toBeUndefined();
        expect(configs.find(c => c.name === 'Chandelier')).toBeUndefined();
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
            // 260은 bars[2]=300(diff=40)에 bars[1]=200(diff=60)보다 가깝다 → index 2
            const result = findBarIndex(mockBars, 260);
            expect(result).toBe(2);
        });
    });

    describe('두 후보와 거리가 동일할 때', () => {
        it('low 인덱스(더 높은 인덱스)를 반환한다', () => {
            // bars[1]=200, bars[2]=300, time=250 → lowDiff=50, highDiff=50 → low(=2) 반환
            expect(findBarIndex(mockBars, 250)).toBe(2);
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
        keltnerVisible: false,
        donchianVisible: false,
        supertrendVisible: false,
        parabolicSarVisible: false,
        chandelierVisible: false,
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

    describe('config.getColor가 있을 때', () => {
        it('정적 color 대신 getColor(indicators, barIndex) 결과를 색으로 사용한다', () => {
            const dynamicConfigs = [
                {
                    name: 'Dyn',
                    color: '#000000',
                    getValue: (): number | null => 1,
                    getColor: (_i: never, barIndex: number): string =>
                        barIndex === 0 ? '#111111' : '#222222',
                },
            ] as unknown as Parameters<typeof resolveOverlayValues>[0];

            expect(
                resolveOverlayValues(dynamicConfigs, mockIndicators, 0)[0].color
            ).toBe('#111111');
            expect(
                resolveOverlayValues(dynamicConfigs, mockIndicators, 1)[0].color
            ).toBe('#222222');
        });
    });
});

describe('resolveBarIndex', () => {
    describe('빈 bars 배열일 때', () => {
        it('-1을 반환한다', () => {
            expect(resolveBarIndex([], null)).toBe(-1);
        });
    });

    describe('crosshairIndex가 null일 때', () => {
        it('bars.length - 1을 반환한다 (마지막 bar)', () => {
            expect(resolveBarIndex(mockBars, null)).toBe(mockBars.length - 1);
        });
    });

    describe('crosshairIndex가 0보다 작을 때', () => {
        it('0을 반환한다', () => {
            expect(resolveBarIndex(mockBars, -1)).toBe(0);
            expect(resolveBarIndex(mockBars, -10)).toBe(0);
        });
    });

    describe('crosshairIndex가 bars.length 이상일 때', () => {
        it('bars.length - 1을 반환한다', () => {
            expect(resolveBarIndex(mockBars, mockBars.length)).toBe(
                mockBars.length - 1
            );
            expect(resolveBarIndex(mockBars, 100)).toBe(mockBars.length - 1);
        });
    });

    describe('유효한 crosshairIndex일 때', () => {
        it('해당 인덱스를 그대로 반환한다', () => {
            expect(resolveBarIndex(mockBars, 0)).toBe(0);
            expect(resolveBarIndex(mockBars, 2)).toBe(2);
            expect(resolveBarIndex(mockBars, 4)).toBe(4);
        });
    });
});

describe('buildOverlayLabelConfigs — getValue 콜백', () => {
    it('MA getValue가 indicator 데이터에서 올바른 값을 반환한다', () => {
        const configs = buildOverlayLabelConfigs({
            maVisiblePeriods: [5],
            emaVisiblePeriods: [],
            bollingerVisible: false,
            ichimokuVisible: false,
            vpVisible: false,
            keltnerVisible: false,
            donchianVisible: false,
            supertrendVisible: false,
            parabolicSarVisible: false,
            chandelierVisible: false,
        });

        expect(configs[0].getValue(mockIndicators, 0)).toBe(100);
        expect(configs[0].getValue(mockIndicators, 1)).toBe(101);
        expect(configs[0].getValue(mockIndicators, 10)).toBeNull();
    });

    it('EMA getValue가 데이터 없을 때 null을 반환한다', () => {
        const configs = buildOverlayLabelConfigs({
            maVisiblePeriods: [],
            emaVisiblePeriods: [9],
            bollingerVisible: false,
            ichimokuVisible: false,
            vpVisible: false,
            keltnerVisible: false,
            donchianVisible: false,
            supertrendVisible: false,
            parabolicSarVisible: false,
            chandelierVisible: false,
        });

        expect(configs[0].getValue(mockIndicators, 0)).toBeNull();
    });

    it('Bollinger getValue가 upper/middle/lower 값을 반환한다', () => {
        const configs = buildOverlayLabelConfigs({
            maVisiblePeriods: [],
            emaVisiblePeriods: [],
            bollingerVisible: true,
            ichimokuVisible: false,
            vpVisible: false,
            keltnerVisible: false,
            donchianVisible: false,
            supertrendVisible: false,
            parabolicSarVisible: false,
            chandelierVisible: false,
        });

        expect(configs[0].getValue(mockIndicators, 0)).toBe(105);
        expect(configs[1].getValue(mockIndicators, 0)).toBe(100);
        expect(configs[2].getValue(mockIndicators, 0)).toBe(95);
        expect(configs[0].getValue(mockIndicators, 10)).toBeNull();
    });

    it('Ichimoku getValue가 5개 컴포넌트 값을 반환한다', () => {
        const configs = buildOverlayLabelConfigs({
            maVisiblePeriods: [],
            emaVisiblePeriods: [],
            bollingerVisible: false,
            ichimokuVisible: true,
            vpVisible: false,
            keltnerVisible: false,
            donchianVisible: false,
            supertrendVisible: false,
            parabolicSarVisible: false,
            chandelierVisible: false,
        });

        expect(configs[0].getValue(mockIndicators, 0)).toBe(101); // tenkan
        expect(configs[1].getValue(mockIndicators, 0)).toBe(102); // kijun
        expect(configs[2].getValue(mockIndicators, 0)).toBe(100); // chikou
        expect(configs[3].getValue(mockIndicators, 0)).toBe(103); // senkouA
        expect(configs[4].getValue(mockIndicators, 0)).toBe(104); // senkouB
        expect(configs[0].getValue(mockIndicators, 10)).toBeNull();
    });

    it('Volume Profile getValue가 poc/vah/val 값을 반환한다', () => {
        const configs = buildOverlayLabelConfigs({
            maVisiblePeriods: [],
            emaVisiblePeriods: [],
            bollingerVisible: false,
            ichimokuVisible: false,
            vpVisible: true,
            keltnerVisible: false,
            donchianVisible: false,
            supertrendVisible: false,
            parabolicSarVisible: false,
            chandelierVisible: false,
        });

        expect(configs[0].getValue(mockIndicators, 0)).toBe(100); // poc
        expect(configs[1].getValue(mockIndicators, 0)).toBe(110); // vah
        expect(configs[2].getValue(mockIndicators, 0)).toBe(90); // val
    });

    it('Volume Profile getValue가 volumeProfile이 없으면 null을 반환한다', () => {
        const emptyIndicators = {
            ...mockIndicators,
            volumeProfile:
                null as unknown as typeof mockIndicators.volumeProfile,
        };
        const configs = buildOverlayLabelConfigs({
            maVisiblePeriods: [],
            emaVisiblePeriods: [],
            bollingerVisible: false,
            ichimokuVisible: false,
            vpVisible: true,
            keltnerVisible: false,
            donchianVisible: false,
            supertrendVisible: false,
            parabolicSarVisible: false,
            chandelierVisible: false,
        });

        expect(configs[0].getValue(emptyIndicators, 0)).toBeNull();
    });
});

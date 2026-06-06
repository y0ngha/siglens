import { CHART_COLORS, getPeriodColor } from '@/shared/lib/chartColors';
import type { Bar, IndicatorResult } from '@y0ngha/siglens-core';
import type { OverlayItemBase, OverlayLegendItem } from '../types';

export interface OverlayLabelConfig extends OverlayItemBase {
    getValue: (indicators: IndicatorResult, barIndex: number) => number | null;
    /**
     * 크로스헤어 막대마다 범례 점 색을 동적으로 결정한다(선택). 라인 색이 막대별로
     * 바뀌는 지표(예: Supertrend는 추세별 초록/빨강)에서, 범례 색이 실제 그려진
     * 라인 색과 어긋나지 않도록 한다. 미지정 시 정적 color를 사용한다.
     */
    getColor?: (indicators: IndicatorResult, barIndex: number) => string;
}

interface BuildOverlayLabelConfigsParams {
    maVisiblePeriods: number[];
    emaVisiblePeriods: number[];
    bollingerVisible: boolean;
    ichimokuVisible: boolean;
    vpVisible: boolean;
    keltnerVisible: boolean;
    donchianVisible: boolean;
    supertrendVisible: boolean;
}

export function buildOverlayLabelConfigs({
    maVisiblePeriods,
    emaVisiblePeriods,
    bollingerVisible,
    ichimokuVisible,
    vpVisible,
    keltnerVisible,
    donchianVisible,
    supertrendVisible,
}: BuildOverlayLabelConfigsParams): OverlayLabelConfig[] {
    const maConfigs: OverlayLabelConfig[] = maVisiblePeriods.map(period => ({
        name: `MA(${period})`,
        color: getPeriodColor(period),
        getValue: (ind: IndicatorResult, i: number): number | null =>
            ind.ma[period]?.[i] ?? null,
    }));

    const emaConfigs: OverlayLabelConfig[] = emaVisiblePeriods.map(period => ({
        name: `EMA(${period})`,
        color: getPeriodColor(period),
        getValue: (ind: IndicatorResult, i: number): number | null =>
            ind.ema[period]?.[i] ?? null,
    }));

    const bollingerConfigs: OverlayLabelConfig[] = bollingerVisible
        ? [
              {
                  name: 'BB Upper',
                  color: CHART_COLORS.bollingerUpper,
                  getValue: (ind: IndicatorResult, i: number): number | null =>
                      ind.bollinger[i]?.upper ?? null,
              },
              {
                  name: 'BB Middle',
                  color: CHART_COLORS.bollingerMiddle,
                  getValue: (ind: IndicatorResult, i: number): number | null =>
                      ind.bollinger[i]?.middle ?? null,
              },
              {
                  name: 'BB Lower',
                  color: CHART_COLORS.bollingerLower,
                  getValue: (ind: IndicatorResult, i: number): number | null =>
                      ind.bollinger[i]?.lower ?? null,
              },
          ]
        : [];

    const ichimokuConfigs: OverlayLabelConfig[] = ichimokuVisible
        ? [
              {
                  name: 'Tenkan',
                  color: CHART_COLORS.ichimokuTenkan,
                  getValue: (ind: IndicatorResult, i: number): number | null =>
                      ind.ichimoku[i]?.tenkan ?? null,
              },
              {
                  name: 'Kijun',
                  color: CHART_COLORS.ichimokuKijun,
                  getValue: (ind: IndicatorResult, i: number): number | null =>
                      ind.ichimoku[i]?.kijun ?? null,
              },
              {
                  name: 'Chikou',
                  color: CHART_COLORS.ichimokuChikou,
                  getValue: (ind: IndicatorResult, i: number): number | null =>
                      ind.ichimoku[i]?.chikou ?? null,
              },
              {
                  name: 'Senkou A',
                  color: CHART_COLORS.ichimokuSenkouA,
                  getValue: (ind: IndicatorResult, i: number): number | null =>
                      ind.ichimoku[i]?.senkouA ?? null,
              },
              {
                  name: 'Senkou B',
                  color: CHART_COLORS.ichimokuSenkouB,
                  getValue: (ind: IndicatorResult, i: number): number | null =>
                      ind.ichimoku[i]?.senkouB ?? null,
              },
          ]
        : [];

    const vpConfigs: OverlayLabelConfig[] = vpVisible
        ? [
              {
                  name: 'POC',
                  color: CHART_COLORS.vpPoc,
                  getValue: (ind: IndicatorResult): number | null =>
                      ind.volumeProfile?.poc ?? null,
              },
              {
                  name: 'VAH',
                  color: CHART_COLORS.vpVah,
                  getValue: (ind: IndicatorResult): number | null =>
                      ind.volumeProfile?.vah ?? null,
              },
              {
                  name: 'VAL',
                  color: CHART_COLORS.vpVal,
                  getValue: (ind: IndicatorResult): number | null =>
                      ind.volumeProfile?.val ?? null,
              },
          ]
        : [];

    const keltnerConfigs: OverlayLabelConfig[] = keltnerVisible
        ? [
              {
                  name: 'KC Upper',
                  color: CHART_COLORS.keltnerUpper,
                  getValue: (ind: IndicatorResult, i: number): number | null =>
                      ind.keltnerChannel[i]?.upper ?? null,
              },
              {
                  name: 'KC Middle',
                  color: CHART_COLORS.keltnerMiddle,
                  getValue: (ind: IndicatorResult, i: number): number | null =>
                      ind.keltnerChannel[i]?.middle ?? null,
              },
              {
                  name: 'KC Lower',
                  color: CHART_COLORS.keltnerLower,
                  getValue: (ind: IndicatorResult, i: number): number | null =>
                      ind.keltnerChannel[i]?.lower ?? null,
              },
          ]
        : [];

    const donchianConfigs: OverlayLabelConfig[] = donchianVisible
        ? [
              {
                  name: 'DC Upper',
                  color: CHART_COLORS.donchianUpper,
                  getValue: (ind: IndicatorResult, i: number): number | null =>
                      ind.donchianChannel[i]?.upper ?? null,
              },
              {
                  name: 'DC Middle',
                  color: CHART_COLORS.donchianMiddle,
                  getValue: (ind: IndicatorResult, i: number): number | null =>
                      ind.donchianChannel[i]?.middle ?? null,
              },
              {
                  name: 'DC Lower',
                  color: CHART_COLORS.donchianLower,
                  getValue: (ind: IndicatorResult, i: number): number | null =>
                      ind.donchianChannel[i]?.lower ?? null,
              },
          ]
        : [];

    const supertrendConfigs: OverlayLabelConfig[] = supertrendVisible
        ? [
              {
                  name: 'Supertrend',
                  color: CHART_COLORS.supertrendUp,
                  getValue: (ind: IndicatorResult, i: number): number | null =>
                      ind.supertrend[i]?.supertrend ?? null,
                  // 라인은 추세별 초록(up)/빨강(down) — 범례 점도 현재 막대 추세를 따라간다.
                  // 추세 미정(warm-up)은 neutral로, 라인과 어긋나지 않게 한다.
                  getColor: (ind: IndicatorResult, i: number): string => {
                      const trend = ind.supertrend[i]?.trend;
                      if (trend === 'down') return CHART_COLORS.supertrendDown;
                      if (trend === 'up') return CHART_COLORS.supertrendUp;
                      return CHART_COLORS.neutral;
                  },
              },
          ]
        : [];

    return [
        ...maConfigs,
        ...emaConfigs,
        ...bollingerConfigs,
        ...ichimokuConfigs,
        ...vpConfigs,
        ...keltnerConfigs,
        ...donchianConfigs,
        ...supertrendConfigs,
    ];
}

export function findBarIndex(bars: Bar[], time: number): number {
    if (bars.length === 0) return -1;
    if (time <= bars[0].time) return 0;
    if (time >= bars[bars.length - 1].time) return bars.length - 1;

    let low = 0;
    let high = bars.length - 1;

    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const midTime = bars[mid].time;

        if (midTime === time) return mid;
        if (midTime < time) low = mid + 1;
        else high = mid - 1;
    }

    // low and high crossed — find the closer one
    const lowDiff = Math.abs(bars[low]?.time - time);
    const highDiff = Math.abs(bars[high]?.time - time);
    return lowDiff <= highDiff ? low : high;
}

export function resolveOverlayValues(
    configs: OverlayLabelConfig[],
    indicators: IndicatorResult,
    barIndex: number
): OverlayLegendItem[] {
    if (barIndex === -1) {
        return configs.map(config => ({
            name: config.name,
            color: config.color,
            value: null,
        }));
    }

    return configs.map(config => ({
        name: config.name,
        color: config.getColor
            ? config.getColor(indicators, barIndex)
            : config.color,
        value: config.getValue(indicators, barIndex),
    }));
}

export function resolveBarIndex(
    bars: Bar[],
    crosshairIndex: number | null
): number {
    if (bars.length === 0) return -1;
    if (crosshairIndex === null) return bars.length - 1;
    if (crosshairIndex < 0) return 0;
    if (crosshairIndex >= bars.length) return bars.length - 1;

    return crosshairIndex;
}

import { CHART_COLORS, getPeriodColor } from '@/lib/chartColors';
import type { Bar, IndicatorResult } from '@y0ngha/siglens-core';
import type {
    OverlayItemBase,
    OverlayLegendItem,
} from '@/components/chart/types';

export interface OverlayLabelConfig extends OverlayItemBase {
    getValue: (indicators: IndicatorResult, barIndex: number) => number | null;
}

interface BuildOverlayLabelConfigsParams {
    maVisiblePeriods: number[];
    emaVisiblePeriods: number[];
    bollingerVisible: boolean;
    ichimokuVisible: boolean;
    vpVisible: boolean;
}

export function buildOverlayLabelConfigs({
    maVisiblePeriods,
    emaVisiblePeriods,
    bollingerVisible,
    ichimokuVisible,
    vpVisible,
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

    return [
        ...maConfigs,
        ...emaConfigs,
        ...bollingerConfigs,
        ...ichimokuConfigs,
        ...vpConfigs,
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
        color: config.color,
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

import type { CandlestickData, UTCTimestamp } from 'lightweight-charts';
import type { Bar, ImpulseColor } from '@y0ngha/siglens-core';
import { CHART_COLORS } from '@/shared/lib/chartColors';

/** Elder Impulse 색 매핑: green=강세(teal), red=약세(red), blue=혼조(blue). */
export function impulseColor(c: ImpulseColor): string {
    if (c === 'green') return CHART_COLORS.impulseBullish;
    if (c === 'red') return CHART_COLORS.impulseBearish;
    return CHART_COLORS.impulseNeutral;
}

/**
 * 메인 캔들스틱 시리즈 데이터를 만든다. Elder Impulse가 활성이고 해당 bar의 색이
 * 있으면 per-bar color/borderColor/wickColor를 주입해 시리즈 기본 bull/bear 색을
 * override한다. 비활성이거나 warm-up(null)·배열 범위 밖이면 plain OHLC를 반환해
 * 시리즈 기본 색이 그대로 적용되게 한다.
 */
export function buildCandlestickData(
    bars: Bar[],
    elderImpulse: (ImpulseColor | null)[],
    isImpulseActive: boolean
): CandlestickData<UTCTimestamp>[] {
    return bars
        .map(bar => {
            const base: CandlestickData<UTCTimestamp> = {
                // Bar.time은 epoch seconds 정수 — LWC UTCTimestamp(branded number)와 런타임 형태 동일.
                time: bar.time as UTCTimestamp,
                open: bar.open,
                high: bar.high,
                low: bar.low,
                close: bar.close,
            };
            return base;
        })
        .map((base, i) => {
            if (!isImpulseActive) return base;
            const impulse = elderImpulse[i];
            if (impulse == null) return base;
            const color = impulseColor(impulse);
            return { ...base, color, borderColor: color, wickColor: color };
        });
}

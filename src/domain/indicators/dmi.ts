import type { Bar, DMIResult } from '@/domain/types';
import { DMI_DEFAULT_PERIOD } from '@y0ngha/siglens-core';

// RawDM과 SmoothedDM은 구조가 같지만 의미가 다르다.
// RawDM은 한 봉의 원시 TR/DM 값이고,
// SmoothedDM은 Wilder Smoothing이 누적 적용된 값이다.
// 하나로 합치면 reduce 콜백 안에서 raw와 smoothed를 타입으로 구분할 수 없어 가독성이 떨어진다.
interface RawDM {
    tr: number;
    dmPlus: number;
    dmMinus: number;
}

interface SmoothedDM {
    tr: number;
    dmPlus: number;
    dmMinus: number;
}

function calcRaw(bar: Bar, prev: Bar): RawDM {
    const tr = Math.max(
        bar.high - bar.low,
        Math.abs(bar.high - prev.close),
        Math.abs(bar.low - prev.close)
    );
    const upMove = bar.high - prev.high;
    const downMove = prev.low - bar.low;
    const dmPlus = upMove > 0 && upMove > downMove ? upMove : 0;
    const dmMinus = downMove > 0 && downMove > upMove ? downMove : 0;
    return { tr, dmPlus, dmMinus };
}

export function calculateDMI(
    bars: Bar[],
    period = DMI_DEFAULT_PERIOD
): DMIResult[] {
    const nullResult: DMIResult = { diPlus: null, diMinus: null, adx: null };

    if (bars.length < period * 2) return bars.map(() => nullResult);

    // raw TR/+DM/-DM for bars[1..n-1], index i → bars[i+1] vs bars[i]
    const raws = bars.slice(1).map((bar, i) => calcRaw(bar, bars[i]));

    // First Wilder smoothed: sum of first `period` raws
    const firstSmoothed: SmoothedDM = raws.slice(0, period).reduce(
        (acc, r) => ({
            tr: acc.tr + r.tr,
            dmPlus: acc.dmPlus + r.dmPlus,
            dmMinus: acc.dmMinus + r.dmMinus,
        }),
        { tr: 0, dmPlus: 0, dmMinus: 0 }
    );

    // smoothedValues[k] corresponds to bars[k + period]
    const tailRaws = raws.slice(period);
    const smoothedValues: SmoothedDM[] = new Array(tailRaws.length + 1);
    smoothedValues[0] = firstSmoothed;
    for (let i = 0; i < tailRaws.length; i++) {
        const prev = smoothedValues[i];
        const r = tailRaws[i];
        smoothedValues[i + 1] = {
            tr: prev.tr - prev.tr / period + r.tr,
            dmPlus: prev.dmPlus - prev.dmPlus / period + r.dmPlus,
            dmMinus: prev.dmMinus - prev.dmMinus / period + r.dmMinus,
        };
    }

    // Compute +DI, -DI, DX for each smoothed value
    const diValues = smoothedValues.map(s => {
        const diPlus = s.tr === 0 ? 0 : (100 * s.dmPlus) / s.tr;
        const diMinus = s.tr === 0 ? 0 : (100 * s.dmMinus) / s.tr;
        const diSum = diPlus + diMinus;
        const dx = diSum === 0 ? 0 : (100 * Math.abs(diPlus - diMinus)) / diSum;
        return { diPlus, diMinus, dx };
    });

    // ADX: Wilder smoothing of DX with period
    // First ADX = average of first `period` DX values (diValues[0..period-1])
    // adxValues[j] corresponds to bars[2 * period - 1 + j]
    const firstADX =
        diValues.slice(0, period).reduce((sum, v) => sum + v.dx, 0) / period;

    const tailDiValues = diValues.slice(period);
    const adxValues: number[] = new Array(tailDiValues.length + 1);
    adxValues[0] = firstADX;
    for (let i = 0; i < tailDiValues.length; i++) {
        adxValues[i + 1] =
            (adxValues[i] * (period - 1) + tailDiValues[i].dx) / period;
    }

    return bars.map((_, i) => {
        if (i < 2 * period - 1) return nullResult;
        const j = i - (2 * period - 1);
        const diIdx = period - 1 + j;
        return {
            diPlus: diValues[diIdx].diPlus,
            diMinus: diValues[diIdx].diMinus,
            adx: adxValues[j],
        };
    });
}

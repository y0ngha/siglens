import type {
    CandlestickData,
    HistogramData,
    UTCTimestamp,
} from 'lightweight-charts';
import type { Bar, ImpulseColor } from '@y0ngha/siglens-core';
import { CHART_COLORS } from '@/shared/lib/chartColors';
import { TRANSPARENT_COLOR } from '../constants';
import { buildCandlestickData } from './candlestickDataUtils';

/**
 * 프리·애프터마켓 봉을 차트 시리즈 데이터로 얹는 헬퍼.
 *
 * 지표 오버레이는 **정규장 봉에만** 짝지어진다(`seriesDataUtils`의 tail 정렬은 정규장 봉 배열과
 * 지표 배열의 관계다). 확장 봉은 그 배열에 들어가지 않고, 캔들·거래량 시리즈의 시간외 구간에만
 * **시각으로** 얹힌다 — lightweight-charts는 시리즈마다 다른 시각 집합을 하나의 시간축(합집합)으로
 * 합치므로 정규장 시각에만 점이 있는 지표 시리즈가 그대로 맞는다.
 */

/** 몸통을 비운다(알파 0) — 밴드가 비치는 속 빈 캔들. */
const HOLLOW_BODY = TRANSPARENT_COLOR;

/**
 * 시간외 캔들 — **속 빈 몸통 + 방향색 테두리·심지**. 방향은 종가 ≥ 시가(상승)로 정하고, 정규장 캔들과
 * 한눈에 구분되되 방향색은 알파 없이 그대로라 밴드 위에서 3:1 이상으로 또렷하다(DESIGN.md "시간외 구간").
 */
function extendedCandle(bar: Bar): CandlestickData<UTCTimestamp> {
    const color =
        bar.close >= bar.open
            ? CHART_COLORS.extendedBullish
            : CHART_COLORS.extendedBearish;
    return {
        // Bar.time은 epoch seconds 정수 — LWC UTCTimestamp(브랜드 number)와 런타임 형태가 같다.
        time: bar.time as UTCTimestamp,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        color: HOLLOW_BODY,
        borderColor: color,
        wickColor: color,
    };
}

/**
 * 캔들 시리즈 데이터 = 정규장 캔들(Elder Impulse 색 포함, `buildCandlestickData` **그대로**) +
 * 속 빈 시간외 캔들. 임펄스 색은 정규장 봉 인덱스에 tail 정렬되므로 반드시 **정규장 봉 배열**로 만든
 * 뒤에 시간외 캔들을 합친다(합친 배열로 만들면 인덱스가 밀려 색이 엉뚱한 봉에 찍힌다).
 *
 * 시간외 봉이 없으면 기존 결과 그대로다.
 */
export function buildCandlestickDataWithExtended(
    regularBars: Bar[],
    extendedBars: readonly Bar[],
    elderImpulse: (ImpulseColor | null)[],
    isImpulseActive: boolean
): CandlestickData<UTCTimestamp>[] {
    const regular = buildCandlestickData(
        regularBars,
        elderImpulse,
        isImpulseActive
    );
    if (extendedBars.length === 0) return regular;
    return [...regular, ...extendedBars.map(extendedCandle)].toSorted(
        (a, b) => a.time - b.time
    );
}

/**
 * 총 거래량 히스토그램 데이터. 시간외 막대는 매수/매도 분해(`buySellVolume`)가 없어 정규장 색으로
 * 칠하면 "전부 매도"로 읽히므로 중립 색을 준다(정규장 막대는 시리즈 기본색 그대로).
 */
export function buildTotalVolumeData(
    regularBars: readonly Bar[],
    extendedBars: readonly Bar[]
): HistogramData<UTCTimestamp>[] {
    // Bar.time은 epoch seconds 정수 — UTCTimestamp 브랜드와 런타임 형태가 같다(아래 두 곳도 같다).
    const regular = regularBars.map(({ time, volume }) => ({
        time: time as UTCTimestamp,
        value: volume,
    }));
    if (extendedBars.length === 0) return regular;
    const color = CHART_COLORS.extendedVolume;
    return [
        ...regular,
        ...extendedBars.map(({ time, volume }) => ({
            time: time as UTCTimestamp,
            value: volume,
            color,
        })),
    ].toSorted((a, b) => a.time - b.time);
}

import type { CandlestickData, UTCTimestamp } from 'lightweight-charts';
import { tailOffset } from './seriesDataUtils';
import type { Bar, ImpulseColor } from '@y0ngha/siglens-core';
import { CHART_COLORS } from '@/shared/lib/chartColors';
import { reportClientError } from '@/shared/lib/reportClientError';

/**
 * Elder Impulse 색 매핑: green=강세(teal), red=약세(red), blue=혼조(blue).
 * switch로 exhaustive하게 둬, core가 ImpulseColor 유니온을 확장하면 컴파일타임에
 * "not all paths return"으로 잡히게 한다(조용한 neutral fallthrough 방지).
 */
export function impulseColor(c: ImpulseColor): string {
    switch (c) {
        case 'green':
            return CHART_COLORS.impulseBullish;
        case 'red':
            return CHART_COLORS.impulseBearish;
        case 'blue':
            return CHART_COLORS.impulseNeutral;
    }
}

/**
 * `bar.time`이 epoch **초**인지 한 번만 확인한다.
 *
 * 왜 필요한가: 아래 `bar.time as UTCTimestamp`는 검증 없는 캐스트다. 어댑터가 밀리초를
 * 흘리면 lightweight-charts는 예외 없이 서기 5만년에 캔들을 그리고 HTTP 200이 나간다 —
 * 화면을 직접 보는 사람 말고는 아무도 모르는 부류의 결함(2026-08 감사에서 6건이 전부
 * 이 방식으로만 발견됐다). 새로 붙은 yahoo-finance2 KR 어댑터가 실제 노출 지점이다.
 *
 * 첫 봉만 본다. 한 배열의 봉은 모두 같은 어댑터에서 오므로 O(1)이면 충분하다.
 * 1e11초 = 서기 5138년 — 정상 시세가 도달할 수 없고, 밀리초(≈1.7e12)는 반드시 넘는다.
 */
const MAX_PLAUSIBLE_EPOCH_SECONDS = 1e11;

function assertEpochSeconds(bars: Bar[]): void {
    const first = bars[0];
    if (first === undefined || first.time <= MAX_PLAUSIBLE_EPOCH_SECONDS)
        return;
    reportClientError(
        new Error(`bar.time out of range: ${first.time}`),
        'buildCandlestickData'
    );
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
    // 정렬 규약은 `tailOffset`이 소유한다 — 여기서 다시 계산하면 "지표가 봉보다 길면
    // 좌측 정렬" 같은 분기가 한쪽에만 반영돼 어긋난다(실제로 그럴 뻔했다).
    // 캔들은 **모든 봉**을 그려야 하므로 `tailAligned`(부분집합)가 아니라 offset을 쓴다.
    //
    // 타입은 필수 배열이지만 실제 호출부가 `undefined`를 흘린다(StockChart 경로,
    // worst-case 테스트가 잡았다). 비활성일 때는 배열을 아예 건드리지 않는다 —
    // 예전 구현이 `isImpulseActive ? elderImpulse[i] : null`로 단락 평가하던 것과 같다.
    const impulseOffset =
        isImpulseActive && Array.isArray(elderImpulse)
            ? tailOffset(bars.length, elderImpulse.length)
            : 0;
    assertEpochSeconds(bars);
    return bars.map((bar, i) => {
        const base: CandlestickData<UTCTimestamp> = {
            // Bar.time은 epoch seconds 정수 — LWC UTCTimestamp(branded number)와 런타임 형태 동일.
            time: bar.time as UTCTimestamp,
            open: bar.open,
            high: bar.high,
            low: bar.low,
            close: bar.close,
        };
        const impulse = isImpulseActive
            ? (elderImpulse?.[impulseOffset + i] ?? null)
            : null;
        if (impulse == null) return base; // 비활성·warm-up·범위 밖 → 시리즈 기본 bull/bear 색
        const color = impulseColor(impulse);
        return { ...base, color, borderColor: color, wickColor: color };
    });
}

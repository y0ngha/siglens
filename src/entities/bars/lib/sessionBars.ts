import {
    EMPTY_INDICATOR_RESULT,
    type Bar,
    type BarsData,
} from '@y0ngha/siglens-core';
import { MS_PER_DAY, MS_PER_SECOND } from '@/shared/config/time';
import { toUtcIsoDate } from '@/shared/lib/isoDate';

/** 세션 날짜 `YYYY-MM-DD`의 일봉 `Bar.time`(그 날 UTC 자정, 초). */
function sessionBarTimeSeconds(sessionDate: string): number {
    return Date.parse(`${sessionDate}T00:00:00Z`) / MS_PER_SECOND;
}

/** 오름차순 `bars`에서 `endExclusiveSec` 미만인 앞부분만 남긴다(뒤쪽 접미사를 떼는 것뿐이다). */
function barsBefore(bars: readonly Bar[], endExclusiveSec: number): Bar[] {
    return bars.slice(0, bars.findLastIndex(b => b.time < endExclusiveSec) + 1);
}

/**
 * 일봉 `BarsData`를 **세션 날짜 `sessionDate`까지**로 자르고, 서버 계산이 실제로 읽는 필드만 남긴
 * 축소판을 만든다. 세션 키 정적 캐시(`sessionBarsStaticCache`)가 저장하는 값이다.
 *
 * ## 왜 세션 날짜로 자르는가 — 값이 키의 순수 함수가 되게
 *
 * 캐시 키에 `lastClosedSessionDate`(마감 + EOD 발행 버퍼 4h가 지나야 롤)를 넣는다. 자르지 않으면
 * 같은 키 안에서도 **언제 채웠는지**에 따라 값이 갈린다 — 장 마감 직후~버퍼 사이에 채운 엔트리에는
 * 아직 발행이 덜 끝난 당일 봉이 붙고, 장중에 채운 엔트리에는 없다. 자르면 키가 같은 한 값도 같다
 * (provider의 과거 봉 수정만 예외). 장중에는 형성 중 봉이 세션 날짜 뒤에 있으므로 이 자르기가
 * `quantizeBarsDataToLastClosed`(형성 중 봉 제거)를 포함한다 — ISR HTML 결정성도 그대로다.
 *
 * 대가: 장 마감 뒤 버퍼(4h) 동안은 당일 봉 대신 직전 세션 값을 보인다. 공포·탐욕은 일봉 지표이고
 * 이 값을 쓰는 탭(헤더 칩·공포·탐욕·포지션)의 ISR 자체가 12~24h라 그 지연은 관측 범위 밖이다.
 *
 * ## 무엇을 남기는가
 *
 * - `bars` — 포지션 탭(52주 범위·종가)과 공포·탐욕 seed의 `updatedAt`(마지막 봉 시각)이 읽는다.
 * - `fearGreedBars` — 공포·탐욕 점수의 5년 일봉(`symbolFearGreedInputs`).
 * - `indicators.buySellVolume` — `fearGreedBars`가 없을 때 `fearGreedInputs`가 폴백으로 읽는다.
 *   `bars`와 꼬리 정렬(index-aligned)이라 뗀 봉 수만큼 뒤에서 함께 뗀다.
 *
 * 나머지 지표는 `EMPTY_INDICATOR_RESULT`의 빈 값이다 — 원본 엔트리(~700KB)의 대부분이 지표라,
 * 이 축소판은 그 일부 크기다. ⚠️ 지표(rsi·macd 등)를 읽는 소비자는 이 값을 쓰면 안 된다
 * (`getQuantizedBarsStatic`을 쓴다).
 */
export function toSessionBarsData(
    data: BarsData,
    sessionDate: string
): BarsData {
    const endExclusiveSec =
        sessionBarTimeSeconds(sessionDate) + MS_PER_DAY / MS_PER_SECOND;
    const bars = barsBefore(data.bars, endExclusiveSec);
    const removed = data.bars.length - bars.length;
    const buySellVolume = data.indicators.buySellVolume ?? [];
    return {
        bars,
        indicators: {
            ...EMPTY_INDICATOR_RESULT,
            buySellVolume: buySellVolume.slice(
                0,
                Math.max(0, buySellVolume.length - removed)
            ),
        },
        ...(data.fearGreedBars !== undefined
            ? { fearGreedBars: barsBefore(data.fearGreedBars, endExclusiveSec) }
            : {}),
    };
}

/**
 * 마지막 봉의 세션 날짜(`YYYY-MM-DD`, 일봉 `Bar.time` = 그 날 UTC 자정). 봉이 없으면 `null`.
 * 세션 키 캐시가 `sessionCoverage`로 "저장해도 되는 값인가"를 가를 때 쓴다.
 */
export function lastBarSessionDate(data: BarsData): string | null {
    const last = data.bars.at(-1);
    return last === undefined
        ? null
        : toUtcIsoDate(new Date(last.time * MS_PER_SECOND));
}

import type { Bar } from '@y0ngha/siglens-core';

/**
 * 시가·종가가 고가~저가 범위 안에 들도록 고가·저가를 넓힌다 — `high = max(H,O,C)`,
 * `low = min(L,O,C)`. 이미 범위 안인 봉은 같은 객체를 그대로 돌려준다(멱등).
 *
 * yahoo 한국 일봉(.KS/.KQ)에는 종가가 그날 고저 밖인 봉이 있다(리플레이 세트 v1: 10종목 중
 * 8종목 14개 — 예: 005930.KS 2024-10-14 O/H/L/C = 59500/61200/59400/59300). 같은 날짜를
 * yahoo `chart`에 직접 물어도 원본 `close`가 `low`보다 낮게 오고 `adjclose`와도 다른 값이라
 * 수정주가 혼용이 아니라 yahoo 쪽 고저 집계가 종가(동시호가 체결)를 빠뜨린 것이다.
 * 그대로 두면 꼬리 밖 종가 캔들이 그려지고 ATR·스토캐스틱·윌리엄스 %R이 어긋난다.
 * 값을 지어내지 않고 관측된 가격 셋을 포함하도록만 넓힌다.
 */
export function withConsistentRange(bar: Bar): Bar {
    const high = Math.max(bar.high, bar.open, bar.close);
    const low = Math.min(bar.low, bar.open, bar.close);
    return high === bar.high && low === bar.low ? bar : { ...bar, high, low };
}

/**
 * {@link withConsistentRange}를 배열에 적용한다. 한 번 훑으며 첫 불일치 봉을 만났을 때에야
 * 복사하므로, 깨끗한 입력은 할당 없이 입력 배열을 그대로(같은 참조) 돌려주고 `fixed`는 0이다.
 */
export function clampBarsRange(bars: readonly Bar[]): {
    bars: readonly Bar[];
    fixed: number;
} {
    const firstBad = bars.findIndex(bar => withConsistentRange(bar) !== bar);
    if (firstBad === -1) return { bars, fixed: 0 };
    const clamped = [
        ...bars.slice(0, firstBad),
        ...bars.slice(firstBad).map(withConsistentRange),
    ];
    const fixed = clamped.filter((bar, i) => bar !== bars[i]).length;
    return { bars: clamped, fixed };
}

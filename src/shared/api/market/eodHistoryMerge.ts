import type { Bar } from '@y0ngha/siglens-core';
import { mergeBarsByTime } from './mergeBarsByTime';

/**
 * 종목당 하나 쓰는 EOD 히스토리 캐시 값(`bars:eodhist:v3:<SYM>`).
 *
 * 최상위에 `data` 키를 두지 않는다 — `getOrSetCache`가 값을 `{ data }`로 감싸 저장하고
 * 읽을 때 `'data' in value`로 envelope을 판별하므로, 값 자체에 `data` 필드가 있으면
 * 레거시 raw 엔트리와 헷갈린다.
 */
export interface EodHistoryEntry {
    /** 이 엔트리를 만든 시점의 마지막 마감 세션 날짜(`lastClosed`, YYYY-MM-DD). */
    asOf: string;
    /** `bars`가 덮는 창의 시작 날짜(YYYY-MM-DD). 그 앞에 봉이 없다는 뜻일 뿐 첫 봉 날짜가 아니다. */
    from: string;
    /** 업스트림을 마지막으로 확인한 시각(epoch ms). 불완전 히스토리의 쿨다운 기준이다. */
    checkedAt: number;
    /**
     * 마지막 **전체 창** fetch 시각(epoch ms). 증분 갱신은 이 값을 그대로 이어받는다.
     * 증분은 겹침 봉 하나만 검증하므로, 그보다 앞선 구간의 늦은 분할 조정·조용한 정정은
     * 전체 재조회 전까지 못 잡는다 — `EOD_HISTORY_FULL_REFRESH_MS`가 그 기간의 상한이다.
     */
    fullAt: number;
    bars: Bar[];
}

/**
 * 증분 갱신을 이어 가는 최대 기간. 지나면 다음 롤에서 전체 창을 다시 받아 `fullAt`을 갱신한다.
 *
 * 겹침 봉 비교는 그 봉 앞쪽 전체가 같은 조정 상태라는 가정에 기댄다. 업스트림이 분할 조정을
 * 분할 직후 봉보다 늦게 과거에 반영하거나, 겹침보다 먼 과거를 조용히 정정하면 그 오류가 매
 * 롤마다 다시 쓰이는 활성 종목에 영구히 남는다(엔트리가 만료되지 않는다). 예전에는 세션마다
 * 전체를 받아 하루 안에 치유됐다. 7일이면 종목당 주 1회만 전체를 받아 증분 절감의 ~6/7을
 * 유지하고, 업스트림 소급 정정이 남는 최악의 기간은 하루에서 일주일이 된다.
 */
export const EOD_HISTORY_FULL_REFRESH_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * 겹치는 봉을 비교할 때 부동소수 잡음을 흡수하는 상대 허용오차. 분할 조정은 가격을
 * 분할 비율만큼(최소 수 %) 바꾸므로 이 값보다 훨씬 크게 어긋난다.
 */
const OVERLAP_RELATIVE_TOLERANCE = 1e-6;

function closeEnough(a: number, b: number): boolean {
    return (
        Math.abs(a - b) <=
        OVERLAP_RELATIVE_TOLERANCE * Math.max(Math.abs(a), Math.abs(b))
    );
}

/**
 * 캐시의 마지막 봉(`cachedLast`)이 새로 받은 `fetched` 안의 같은 날짜 봉과 OHLC가 같은지.
 *
 * FMP·Yahoo 일봉은 분할 조정값이라 분할이 나면 **과거 봉이 소급해서 바뀐다**(NVDA 10:1:
 * 분할 전 봉이 ~1209가 아니라 120.89로 온다). 마지막 캐시 봉부터 겹쳐 받아 이 봉이 그대로인지
 * 보면, 그 앞 봉 전체가 같은 조정 상태라는 것을 한 봉으로 확인할 수 있다 — 분할은 분할일 이전
 * 모든 봉에 같은 비율을 곱하기 때문이다. 겹친 봉이 응답에 없어도 확인할 수 없으므로 `false`다.
 * 거래량은 비교하지 않는다: 늦게 정정되는 일이 흔해 불필요한 전체 재조회만 늘린다.
 */
export function overlapMatches(cachedLast: Bar, fetched: Bar[]): boolean {
    return overlapStatus(cachedLast, fetched) === 'match';
}

export type OverlapStatus = 'match' | 'missing' | 'different';

/** {@link overlapMatches}와 같은 판정이되, 실패 사유(응답에 없음 / 값이 다름)를 구분해 돌려준다. */
export function overlapStatus(cachedLast: Bar, fetched: Bar[]): OverlapStatus {
    const same = fetched.find(b => b.time === cachedLast.time);
    if (same === undefined) return 'missing';
    const equal =
        closeEnough(cachedLast.open, same.open) &&
        closeEnough(cachedLast.high, same.high) &&
        closeEnough(cachedLast.low, same.low) &&
        closeEnough(cachedLast.close, same.close);
    return equal ? 'match' : 'different';
}

/**
 * 캐시된 봉 뒤에 겹쳐 받은 봉을 이어 붙인다. `overlapTime`보다 이른 응답 봉은 버리고
 * (겹침 이전 구간은 캐시 값이 정본이다), 같은 시각은 새로 받은 값이 이긴다.
 */
export function mergeIncremental(
    cached: Bar[],
    fetched: Bar[],
    overlapTime: number
): Bar[] {
    return mergeBarsByTime(
        cached,
        fetched.filter(b => b.time >= overlapTime)
    );
}

/** `fromThreshold`(UTC 자정 unix초)보다 이른 봉을 앞에서 버린다. */
export function trimToWindow(bars: Bar[], fromThreshold: number): Bar[] {
    return bars.filter(b => b.time >= fromThreshold);
}

/** 히스토리가 마지막 마감 세션 봉까지 도달했는지(FMP 발행 지연·상장폐지·휴장 라벨 키는 `false`). */
export function reachesLastClosed(
    bars: Bar[],
    lastClosedThreshold: number
): boolean {
    const newest = bars.at(-1);
    return newest !== undefined && newest.time >= lastClosedThreshold;
}

export interface EodServeContext {
    /** 요청 시점의 마지막 마감 세션 날짜. */
    lastClosed: string;
    lastClosedThreshold: number;
    /** 요청이 필요로 하는 창 시작(YYYY-MM-DD) — 보통 고정 창 시작, 창보다 이른 `from`이면 그 `from`. */
    fetchFrom: string;
    nowMs: number;
    /** 불완전 히스토리를 다시 확인하기 전까지 그대로 내주는 시간. */
    cooldownMs: number;
}

/**
 * 엔트리를 업스트림 호출 없이 그대로 내줄 수 있는지.
 * - `asOf`가 지금 세션이어야 한다(지나간 세션이면 증분 갱신 대상).
 * - 요청 창을 덮어야 한다(`entry.from <= fetchFrom`).
 * - 마지막 마감 봉까지 도달했으면 세션이 바뀔 때까지 유효하고, 못 미쳤으면(지연·상장폐지)
 *   `checkedAt`부터 쿨다운 동안만 유효하다 — 그 뒤 첫 요청이 증분 재확인을 한다.
 */
export function isEntryServable(
    entry: EodHistoryEntry,
    ctx: EodServeContext
): boolean {
    if (entry.asOf !== ctx.lastClosed) return false;
    if (entry.from > ctx.fetchFrom) return false;
    if (reachesLastClosed(entry.bars, ctx.lastClosedThreshold)) return true;
    return ctx.nowMs - entry.checkedAt < ctx.cooldownMs;
}

/**
 * 만료된 엔트리 위에 증분 갱신(겹쳐 받아 이어 붙이기)을 시도해도 되는지.
 * 겹침 봉이 있어야 하고, 엔트리가 요청 창을 덮어야 하고, 겹침 봉이 새 창 안·마감 세션 이전이어야
 * 하고, 마지막 전체 fetch가 `EOD_HISTORY_FULL_REFRESH_MS`보다 오래되지 않아야 한다. 하나라도
 * 어긋나면 전체 창을 다시 받는 쪽이 정답이다.
 */
export function canExtendIncrementally(
    entry: EodHistoryEntry,
    ctx: Pick<
        EodServeContext,
        'lastClosed' | 'lastClosedThreshold' | 'fetchFrom' | 'nowMs'
    >,
    fromThreshold: number
): boolean {
    const last = entry.bars.at(-1);
    return (
        last !== undefined &&
        entry.asOf <= ctx.lastClosed &&
        entry.from <= ctx.fetchFrom &&
        last.time >= fromThreshold &&
        last.time <= ctx.lastClosedThreshold &&
        ctx.nowMs - entry.fullAt < EOD_HISTORY_FULL_REFRESH_MS
    );
}

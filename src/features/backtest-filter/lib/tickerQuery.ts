/**
 * 백테스트 종목 필터의 `?ticker=` 쿼리 규약 — 탭 값 검증과 주소 조립(순수 함수).
 */

/**
 * "전체" 탭의 **값**. 표시 라벨과 분리한다 — 값은 쿼리 파라미터 비교와
 * 상태 식별에 쓰이므로 로케일에 따라 바뀌면 `/en/backtesting?ticker=…`의
 * 왕복이 깨진다. 라벨만 `shared.ui.misc.filterAll`로 번역한다.
 */
export const BACKTEST_ALL_TAB = 'all';

/** 고른 종목을 담는 쿼리 파라미터 이름. "전체"일 때는 주소에서 뺀다. */
export const TICKER_QUERY_PARAM = 'ticker';

/**
 * 후보 값을 실제 탭 값으로 정한다. 목록에 없는 값(오래된 링크·오타)이나
 * `null`(파라미터 없음)은 "전체"로 떨어진다.
 */
export function resolveTickerTab(
    tickers: readonly string[],
    candidate: string | null
): string {
    return candidate !== null && tickers.includes(candidate)
        ? candidate
        : BACKTEST_ALL_TAB;
}

/** `buildTickerHref`가 읽는 현재 주소의 부분 — `window.location`이 그대로 맞는다. */
interface LocationParts {
    readonly pathname: string;
    readonly search: string;
    readonly hash: string;
}

/**
 * `tab`을 반영한 새 주소(경로+쿼리+해시). 경로는 현재 값을 그대로 쓰므로 로케일
 * 접두사(`/en/backtesting`)가 유지되고, `?ticker=` 밖의 쿼리(utm 등)와 해시도 보존된다.
 */
export function buildTickerHref(
    { pathname, search, hash }: LocationParts,
    tab: string
): string {
    const params = new URLSearchParams(search);
    if (tab === BACKTEST_ALL_TAB) params.delete(TICKER_QUERY_PARAM);
    else params.set(TICKER_QUERY_PARAM, tab);
    const qs = params.toString();
    return `${pathname}${qs === '' ? '' : `?${qs}`}${hash}`;
}

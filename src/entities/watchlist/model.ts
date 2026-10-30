import type { WatchlistSource as FunnelWatchlistSource } from '@/shared/lib/funnel/funnelEvents';

/**
 * `watchlist_added` 퍼널 이벤트의 `source`. 1편 카탈로그(`shared/lib/funnel/funnelEvents.ts`의
 * `WATCHLIST_SOURCES`)가 **정본**이고 여기서는 별칭만 둔다 — 두 곳에 유니언을 따로 적으면 한쪽만
 * 고쳤을 때 `trackFunnelEvent('watchlist_added', { source })` 호출부가 깨진다. 값을 늘리려면
 * 1편 카탈로그를 고친다.
 */
export type WatchlistSource = FunnelWatchlistSource;

/** 액션 오류 분류. 화면은 `message`가 아니라 이 코드로 분기한다. */
export type WatchlistActionErrorCode =
    | 'unauthenticated'
    | 'invalid_symbol'
    | 'symbol_not_found'
    | 'limit_reached'
    | 'storage_unavailable';

/** 화면·훅이 쓰는 관심종목 한 건. 회원(서버)과 비회원(로컬) 양쪽이 이 모양으로 수렴한다. */
export interface WatchlistItemView {
    symbol: string;
    /** 담을 때의 표시명. null이면 심볼로 표시. */
    companyName: string | null;
    /** ISO 8601. 목록은 이 값 내림차순(최근 담은 순). */
    addedAt: string;
}

/** 담기 입력. `label`은 호출부가 아는 표시명(회사명)이며 서버가 `getAssetInfo`로 덮을 수 있다. */
export interface RawWatchlistInput {
    symbol: string;
    label: string;
}

/** `validateWatchlistSymbol`의 결과 — 통과하면 정규화된 심볼. */
export type ValidateWatchlistSymbolResult =
    | { ok: true; symbol: string }
    | { ok: false; code: 'invalid_symbol' };

/** 액션이 던지지 않고 돌려주는 실패. `message`는 사용자에게 보여줄 현지화 문구. */
export interface WatchlistActionError {
    status: 'error';
    code: WatchlistActionErrorCode;
    message: string;
}

/** `created`: 새로 담겼는지. 다른 탭에서 먼저 담긴 심볼이면 false(멱등 성공) — 퍼널 이벤트는 true일 때만. */
export type AddWatchlistResult =
    | { status: 'ok'; item: WatchlistItemView; created: boolean }
    | WatchlistActionError;

/** `removeWatchlistItemAction`의 결과. */
export type RemoveWatchlistResult = { status: 'ok' } | WatchlistActionError;

/** `skipped`는 상한 때문에 버린 새 심볼 수. 이미 계정에 있던 심볼은 added에도 skipped에도 들지 않는다. */
export type MergeWatchlistResult =
    | { status: 'ok'; added: number; skipped: number }
    | WatchlistActionError;

/**
 * 낙관적 변이 시작 시점에 그 심볼에 대해 알던 것. 목록 전체 스냅샷이 아니라 **심볼 단위**로
 * 되돌려야 동시에 진행 중인 다른 심볼의 낙관적 행을 지우지 않는다.
 */
export interface WatchlistMutationContext {
    symbol: string;
    /** 변이 직전 캐시에 있던 그 심볼의 행(없으면 null). */
    prior: WatchlistItemView | null;
    /** `prior`가 있던 자리. */
    index: number;
}

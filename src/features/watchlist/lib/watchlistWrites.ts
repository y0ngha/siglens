/**
 * `useWatchlist`의 담기·빼기 절차. 회원(서버 액션)·비회원(로컬 저장) 분기, 상한, 실패 토스트,
 * `watchlist_added` 이벤트를 여기서 정한다. 저장·서버·토스트·이벤트는 모두 `WatchlistWriteContext`로
 * 받는다 — 훅은 최신 렌더 값으로 컨텍스트를 만들어 넘기기만 하고, 절차는 React 없이 테스트한다.
 */
import type {
    AddWatchlistResult,
    RawWatchlistInput,
    RemoveWatchlistResult,
    WatchlistSource,
} from '@/entities/watchlist/model';

/** `toggle`의 결과. 상한·실패는 이미 토스트로 알린 뒤다. */
export type WatchlistToggleOutcome =
    | 'added'
    | 'removed'
    | 'at_limit'
    | 'failed';

/** `add`의 결과 — `add`는 빼지 않으므로 `removed`가 없다. */
export type WatchlistAddOutcome = Exclude<WatchlistToggleOutcome, 'removed'>;

/** 담기·빼기 한 번이 읽는 값과 부수효과. 호출 시점의 렌더 값으로 만든다. */
export interface WatchlistWriteContext {
    /** 회원일 가능성 — 참이면 서버, 거짓이면 로컬로 쓴다. */
    isMember: boolean;
    has: (symbol: string) => boolean;
    isAtLimit: boolean;
    /** 번역을 마친 토스트 문구(일반 실패·상한). */
    failedMessage: string;
    limitMessage: string;
    showMessage: (message: string) => void;
    track: (source: WatchlistSource) => void;
    /** 로컬 쓰기. 실제로 저장됐을 때만 true. */
    addLocal: (entry: RawWatchlistInput) => boolean;
    removeLocal: (symbol: string) => boolean;
    addServer: (entry: RawWatchlistInput) => Promise<AddWatchlistResult>;
    removeServer: (symbol: string) => Promise<RemoveWatchlistResult>;
}

/** 명시적 삭제. 실패하면 토스트를 띄우고 false. 이벤트는 없다. */
export async function removeFromWatchlist(
    ctx: WatchlistWriteContext,
    symbol: string
): Promise<boolean> {
    if (!ctx.isMember) {
        if (ctx.removeLocal(symbol)) return true;
        ctx.showMessage(ctx.failedMessage);
        return false;
    }
    try {
        const result = await ctx.removeServer(symbol);
        if (result.status === 'ok') return true;
        ctx.showMessage(result.message);
        return false;
    } catch {
        ctx.showMessage(ctx.failedMessage);
        return false;
    }
}

/**
 * 담기 전용. 이미 담겨 있으면 아무것도 하지 않고 `added`. 이벤트는 실제로 새로 담겼을 때만 —
 * 다른 탭에서 먼저 담겨 서버가 멱등 성공(`created: false`)만 한 경우엔 보내지 않는다.
 */
export async function addToWatchlist(
    ctx: WatchlistWriteContext,
    entry: RawWatchlistInput,
    source: WatchlistSource
): Promise<WatchlistAddOutcome> {
    if (ctx.has(entry.symbol)) return 'added';
    if (ctx.isAtLimit) {
        ctx.showMessage(ctx.limitMessage);
        return 'at_limit';
    }
    if (!ctx.isMember) {
        if (!ctx.addLocal(entry)) {
            ctx.showMessage(ctx.failedMessage);
            return 'failed';
        }
        ctx.track(source);
        return 'added';
    }
    try {
        const result = await ctx.addServer(entry);
        if (result.status !== 'ok') {
            ctx.showMessage(result.message);
            return 'failed';
        }
        if (result.created) ctx.track(source);
        return 'added';
    } catch {
        ctx.showMessage(ctx.failedMessage);
        return 'failed';
    }
}

/** 있으면 빼고 없으면 담는다. */
export async function toggleWatchlist(
    ctx: WatchlistWriteContext,
    entry: RawWatchlistInput,
    source: WatchlistSource
): Promise<WatchlistToggleOutcome> {
    if (ctx.has(entry.symbol)) {
        return (await removeFromWatchlist(ctx, entry.symbol))
            ? 'removed'
            : 'failed';
    }
    return addToWatchlist(ctx, entry, source);
}

import type { WaitUntil } from '@y0ngha/siglens-core';

/** Runtime hooks for background tasks started by the ticker use-cases. */
export interface BackgroundTaskOptions {
    /**
     * Optional graceful-drain hook injected by the runtime. A future AWS
     * integration may supply a `waitUntil` implementation here so the runtime
     * can keep the process alive until background work (cache writes, translation
     * jobs) completes before shutdown. When absent, `fireAndForget` owns the
     * floating promise with a `console.error` logging catch-net to prevent
     * unhandled rejection crashes.
     */
    waitUntil?: WaitUntil;
}

/** Subset of an FMP search result needed when persisting a translation. */
export interface AssetInfoMatch {
    symbol: string;
    name: string;
    exchange: string;
    exchangeFullName: string;
}

/**
 * 백그라운드 promise를 await 없이 실행한다.
 *
 * - `options.waitUntil`이 제공된 경우: 런타임 훅(예: AWS graceful-drain 어댑터)에
 *   promise를 위임해 런타임이 종료 전 완료를 추적할 수 있도록 한다.
 * - `options.waitUntil`이 없는 경우: promise를 떠 있는 채로 두되,
 *   거부(rejection)는 `console.error`로 로깅해 unhandledRejection을 방지한다.
 *
 * @요구사항 호출자는 컨텍스트에 맞는 로깅을 위해 promise를 넘기기 전에
 * 자체 `.catch()`를 붙여야 한다(SHOULD). 이 함수의 catch-net은 호출자가
 * `.catch()`를 빠뜨렸을 때의 최후 안전망이다.
 */
export function fireAndForget(
    promise: Promise<unknown>,
    options?: BackgroundTaskOptions
): void {
    if (options?.waitUntil) {
        options.waitUntil(promise);
        return;
    }
    void promise.catch(err => {
        console.error('[fireAndForget] background task error:', err);
    });
}

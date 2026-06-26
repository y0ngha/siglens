import type { WaitUntil } from '@y0ngha/siglens-core';

/** Runtime hooks for background tasks started by the ticker use-cases. */
export interface BackgroundTaskOptions {
    /**
     * Optional graceful-drain hook injected by the runtime. A caller may supply
     * a `waitUntil` implementation here so the runtime can keep the process
     * alive until background work (cache writes, translation jobs) completes
     * before shutdown.
     *
     * When absent, `fireAndForget` tracks the promise in a module-level registry
     * (so {@link drainBackgroundTasks} can await it on SIGTERM) and attaches a
     * `console.error` catch-net to prevent unhandled rejection crashes. The
     * production path uses the registry — the SIGTERM handler wired in
     * `src/instrumentation.ts` calls `drainBackgroundTasks` on shutdown.
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
 * 추적 중인 백그라운드 promise 레지스트리.
 *
 * `fireAndForget`이 registry 경로로 실행한 promise를 settle될 때까지 보관한다.
 * {@link drainBackgroundTasks}가 SIGTERM/SIGINT 시 이 집합을 await해 배포 롤
 * 중 in-flight 작업(캐시 쓰기, 번역 잡)이 유실되지 않도록 한다.
 *
 * 모듈 레벨 싱글톤이라 Next 서버 프로세스 수명 동안 공유된다.
 */
const pendingTasks = new Set<Promise<unknown>>();

/**
 * 신규 백그라운드 작업 수락 중단 여부.
 *
 * SIGTERM 핸들러가 drain을 시작하면 `false`로 전환된다. 이후 도착하는
 * `fireAndForget` 호출은 registry에 추가하지 않고 catch-net만 붙인다
 * (drain deadline을 넘기는 새 작업으로 종료가 무한 지연되는 것을 방지).
 */
let acceptingNewTasks = true;

/** SIGTERM 핸들러가 호출: 이후 신규 백그라운드 작업을 registry에서 추적하지 않는다. */
export function stopAcceptingBackgroundTasks(): void {
    acceptingNewTasks = false;
}

/** @internal 테스트 간 모듈 상태를 초기화한다. */
export function __resetBackgroundTasksForTests(): void {
    pendingTasks.clear();
    acceptingNewTasks = true;
}

/** @internal 현재 추적 중인 백그라운드 작업 수(테스트/진단용). */
export function __pendingBackgroundTaskCount(): number {
    return pendingTasks.size;
}

/**
 * 추적 중인 모든 백그라운드 promise가 settle될 때까지 최대 `deadlineMs`만큼 await한다.
 *
 * - deadline 내에 전부 끝나면 즉시 반환한다.
 * - deadline을 넘기면 남은 작업을 버리고 반환한다(컨테이너 stop timeout보다
 *   짧게 잡아 SIGKILL 전에 정상 종료할 시간을 확보).
 *
 * 개별 promise의 rejection은 무시한다(`Promise.allSettled` 사용) — 이미
 * `fireAndForget`의 catch-net이 로깅을 담당하므로 drain은 완료 여부만 본다.
 *
 * @param deadlineMs 최대 대기 시간(ms).
 */
export async function drainBackgroundTasks(deadlineMs: number): Promise<void> {
    if (pendingTasks.size === 0) return;
    const all = Promise.allSettled([...pendingTasks]);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<void>(resolve => {
        timer = setTimeout(resolve, deadlineMs);
    });
    await Promise.race([all.then(() => undefined), deadline]);
    // race 종료 후 타이머를 정리해 프로세스가 매달리지 않도록 한다.
    if (timer) clearTimeout(timer);
}

/**
 * 백그라운드 promise를 await 없이 실행한다.
 *
 * - `options.waitUntil`이 제공된 경우: 런타임 훅에 promise를 위임해 런타임이
 *   종료 전 완료를 추적하도록 한다. registry에는 추가하지 않는다(훅이 추적 책임).
 * - `options.waitUntil`이 없는 경우(production 기본 경로): promise를 registry에
 *   추가해 SIGTERM drain이 추적할 수 있게 하고, settle 시 제거한다. rejection은
 *   `console.error`로 로깅해 unhandledRejection을 방지한다.
 * - 단, drain이 시작된(`acceptingNewTasks === false`) 뒤 도착한 작업은 registry에
 *   추가하지 않고 catch-net만 붙인다.
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

    const guarded = promise.catch(err => {
        console.error('[fireAndForget] background task error:', err);
    });

    if (!acceptingNewTasks) {
        // drain 진행 중 — 추적하지 않고 floating으로 둔다(catch-net이 보호).
        void guarded;
        return;
    }

    pendingTasks.add(guarded);
    // settle되면(성공/실패 모두 guarded가 resolve) registry에서 제거.
    void guarded.finally(() => {
        pendingTasks.delete(guarded);
    });
}

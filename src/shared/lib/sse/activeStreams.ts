/**
 * In-flight SSE 스트림 graceful-shutdown drain 카운터.
 *
 * `heartbeatStream`이 스트림을 시작할 때 {@link incrementActiveStreams}를 호출해 카운터를
 * 증가시키고, 모든 종료 경로(done/error/cancel)에서 정확히 한 번 {@link decrementActiveStreams}를
 * 호출해 감소시킨다.
 *
 * SIGTERM 핸들러(`instrumentation.node.ts`)가 {@link waitForActiveStreams}를 통해 카운터가
 * 0에 도달할 때까지 대기해, 배포 롤링 중 진행 중인 LLM 분석이 완주하거나
 * `SHUTDOWN_DRAIN_DEADLINE_MS`(180s)가 지날 때까지 프로세스가 살아있도록 한다.
 *
 * 모듈 레벨 싱글톤 — Next 서버 프로세스 수명 동안 공유된다. JavaScript 단일 스레드이므로
 * 뮤텍스 없이 안전하다.
 */

let count = 0;

/**
 * count가 0에 도달했을 때 깨울 리스너 집합.
 *
 * `waitForActiveStreams`가 등록하고, `decrementActiveStreams`가 0 도달 시 전부 호출·비운다.
 * 정상 운용에서는 shutdown 시 최대 1개의 waiter만 등록되므로 Set 오버헤드는 무시 가능.
 */
const zeroListeners = new Set<() => void>();

/** in-flight SSE 스트림이 시작될 때 호출. `heartbeatStream` 전용 — 직접 호출 금지. */
export function incrementActiveStreams(): void {
    count++;
}

/**
 * in-flight SSE 스트림이 종료될 때 호출(done/error/cancel 모든 경로).
 *
 * count가 0에 도달하면 등록된 리스너를 모두 즉시 호출하고 집합을 비운다.
 * count가 이미 0인 경우(이중 decrement 방어)에는 0 미만으로 떨어지지 않도록 보호한다.
 * `heartbeatStream` 전용 — 직접 호출 금지.
 */
export function decrementActiveStreams(): void {
    if (count > 0) count--;
    if (count === 0) {
        for (const fn of zeroListeners) fn();
        zeroListeners.clear();
    }
}

/**
 * in-flight 스트림이 0에 도달하거나 `deadlineMs`가 지날 때까지 대기한다.
 *
 * SIGTERM 핸들러가 `drainBackgroundTasks`와 병렬로 호출한다(같은 deadline 공유).
 * count가 이미 0이면 즉시 resolve한다.
 *
 * @param deadlineMs 최대 대기 시간(ms). `SHUTDOWN_DRAIN_DEADLINE_MS`와 동일 값.
 */
export function waitForActiveStreams(deadlineMs: number): Promise<void> {
    if (count === 0) return Promise.resolve();
    return new Promise<void>(resolve => {
        const done = (): void => {
            clearTimeout(timer);
            resolve();
        };
        zeroListeners.add(done);
        const timer = setTimeout(() => {
            zeroListeners.delete(done);
            resolve();
        }, deadlineMs);
    });
}

/** 테스트 간 모듈 상태를 초기화한다. */
export function __resetActiveStreamsForTests(): void {
    count = 0;
    zeroListeners.clear();
}

/** 현재 in-flight 스트림 수(테스트/진단용). */
export function __activeStreamCount(): number {
    return count;
}

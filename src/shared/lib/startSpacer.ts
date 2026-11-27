/** 시각과 대기를 갈아 끼우는 자리 — 테스트가 가짜 시계를 넣는다. */
export interface StartSpacerClock {
    now(): number;
    sleep(ms: number): Promise<void>;
}

/**
 * 호출 시작 간격을 일정하게 벌리는 자리표. `next()`는 **앞선 시작 이후 최소 `minIntervalMs`가 지난 뒤**
 * 풀리고, 부른 순서대로 풀린다(FIFO). 동시 호출이 몰려도 업스트림이 받는 시작 속도는
 * `1000 / minIntervalMs` 건/초를 넘지 않는다.
 *
 * 동시 실행 수가 아니라 **시작 속도**를 묶는다 — 업스트림 한도(FMP 분당 300건)는 속도 한도라서,
 * 동시성만 제한하면 응답이 빠를 때 한도를 넘는다. 한 번의 `next()`가 한 건의 업스트림 호출에 해당한다.
 */
export interface StartSpacer {
    next(): Promise<void>;
}

const REAL_CLOCK: StartSpacerClock = {
    now: () => Date.now(),
    sleep: ms => new Promise(resolve => setTimeout(resolve, ms)),
};

export function createStartSpacer(
    minIntervalMs: number,
    clock: StartSpacerClock = REAL_CLOCK
): StartSpacer {
    // 다음 시작이 허용되는 가장 이른 시각. 동기 구간에서 읽고 바로 갱신하므로 같은 틱의 호출도 서로 다른 칸을 받는다.
    const state = { nextStartAt: Number.NEGATIVE_INFINITY };
    return {
        next: () => {
            const now = clock.now();
            const startAt = Math.max(now, state.nextStartAt);
            state.nextStartAt = startAt + minIntervalMs;
            return startAt > now
                ? clock.sleep(startAt - now)
                : Promise.resolve();
        },
    };
}

/** 페이서가 쓰는 시계·대기 — 테스트는 가짜 시계와, 그 시계를 앞으로 미는 `sleep`을 넣는다. */
export interface CallPacerClock {
    nowMs: () => number;
    sleep: (ms: number) => Promise<void>;
}

/** 호출 묶음 하나를 시작해도 될 때까지 기다린다 — `calls`는 그 묶음이 보낼 요청 수다. */
export type CallPacer = (calls: number) => Promise<void>;

/**
 * 분당 `callsPerMinute`건을 넘지 않게 호출 묶음의 **시작 간격**을 벌린다. 묶음 하나가 `calls`건이면 다음 묶음은 그 시작에서
 * `calls × (60초 ÷ callsPerMinute)` 뒤에야 시작한다(첫 묶음은 바로). 묶음 안의 동시 호출은 그대로 둔다 — 지연 상한이 아니라
 * 평균 속도 상한이다. 대기는 직전 묶음 하나의 간격을 넘지 않는다.
 *
 * 다음 시작 시각을 클로저에 쥐는 상태 객체다(실행 하나가 하나를 만들어 단계 사이에 넘긴다).
 */
export function createCallPacer(
    callsPerMinute: number,
    clock: CallPacerClock
): CallPacer {
    const intervalMs = 60_000 / callsPerMinute;
    let nextStartMs = Number.NEGATIVE_INFINITY;
    return async calls => {
        const waitMs = nextStartMs - clock.nowMs();
        if (waitMs > 0) await clock.sleep(waitMs);
        nextStartMs = Math.max(clock.nowMs(), nextStartMs) + calls * intervalMs;
    };
}

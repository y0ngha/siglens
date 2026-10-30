/** 호출 전체 마감(`limits.timeoutMs`)을 넘겼을 때 던지는 오류. 호출자가 `instanceof`로 시간 초과와 다른 실패를 가른다. */
export class ProviderCallTimeoutError extends Error {
    constructor(readonly timeoutMs: number) {
        super(`[llm-provider] call exceeded ${timeoutMs}ms deadline`);
        this.name = 'ProviderCallTimeoutError';
    }
}

/**
 * 호출 전체를 묶는 마감. 모든 어댑터가 `limits.timeoutMs`를 지키려고 쓴다.
 *
 * SDK의 `timeout`은 **응답 헤더가 도착할 때까지만** 잰다(`fetchWithTimeout`이 fetch가 resolve되면
 * 타이머를 지운다). 스트림 본문 읽기는 마감이 없어, 토큰이 느리게 흐르면 호출이 `timeoutMs`를
 * 훨씬 넘겨 이어지고 그동안 호출자의 락·비용 계산이 깨진다. 그래서 헤더 전부터 본문 끝까지를
 * 이 마감이 한 번에 묶는다.
 *
 * - `signal`: SDK 요청에 넘겨 만료 시 실제 연결을 끊는다. `timeoutMs`가 없으면 `undefined`.
 * - `guard(work)`: `work`와 마감을 경주시킨다. 만료되면 {@link ProviderCallTimeoutError}로 거절한다.
 *   SDK가 abort에 반응하지 않는 경우에도 호출자는 마감에 풀려난다.
 * - `dispose()`: 정상·실패 종료 시 타이머를 정리한다(`finally`에서 호출).
 */
export interface CallDeadline {
    readonly signal: AbortSignal | undefined;
    guard<T>(work: Promise<T>): Promise<T>;
    dispose(): void;
}

/** `timeoutMs`가 `undefined`면 아무것도 막지 않는 no-op 마감을 돌려준다. 타이머를 쓰므로 `dispose()`를 꼭 부른다. */
export function createCallDeadline(
    timeoutMs: number | undefined
): CallDeadline {
    if (timeoutMs === undefined) {
        return {
            signal: undefined,
            guard: work => work,
            dispose: () => {},
        };
    }
    const controller = new AbortController();
    // 마감은 abort 신호 하나로 표현한다 — 타이머가 abort를 걸고, 그 신호가 SDK 요청과 경주 둘 다를 끝낸다.
    const expiry = new Promise<never>((_, reject) => {
        controller.signal.addEventListener(
            'abort',
            () => reject(new ProviderCallTimeoutError(timeoutMs)),
            { once: true }
        );
    });
    // 아무도 경주시키지 않은 채 만료돼도 unhandled rejection이 되지 않게 한다.
    expiry.catch(() => {});
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return {
        signal: controller.signal,
        guard: work => Promise.race([work, expiry]),
        dispose: () => clearTimeout(timer),
    };
}

/**
 * `start`가 만든 호출을 마감과 경주시키고, 성공·실패·동기 throw 어느 경우에도 타이머를 푼다.
 * `start` 호출 자체를 try 안에서 하므로 요청 생성이 던져도 타이머가 남지 않는다.
 */
export async function runWithCallDeadline<T>(
    deadline: CallDeadline,
    start: () => Promise<T>
): Promise<T> {
    try {
        return await deadline.guard(start());
    } finally {
        deadline.dispose();
    }
}

/** SDK 요청 옵션에 마감 signal을 싣는다. signal이 없으면 `undefined`라 SDK 기본 요청 옵션이 유지된다. */
export function toDeadlineRequestOptions(
    deadline: CallDeadline
): { signal: AbortSignal } | undefined {
    return deadline.signal !== undefined
        ? { signal: deadline.signal }
        : undefined;
}

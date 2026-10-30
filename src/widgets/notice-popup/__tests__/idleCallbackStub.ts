/**
 * `requestIdleCallback`/`cancelIdleCallback` 테스트 스텁 — 유휴 콜백을 테스트가 직접
 * 흘려보내고, 예약 수를 세고, 원래 전역으로 되돌린다.
 */

/** `stubIdleCallback`이 돌려주는 조작 핸들. */
export interface IdleCallbackStub {
    /** 예약된 유휴 콜백을 모두 실행하고 비운다. */
    flush: () => void;
    /** 아직 실행·취소되지 않은 예약 수. */
    pendingCount: () => number;
    /** 스텁 전의 전역 함수로 되돌린다. */
    restore: () => void;
}

/**
 * `requestIdleCallback`을 수동으로 흘려보낼 수 있게 대체한다. ID는 단조 증가 카운터라
 * 취소 뒤에 새로 예약해도 앞선 예약과 겹치지 않는다.
 */
export function stubIdleCallback(): IdleCallbackStub {
    const pending = new Map<number, IdleRequestCallback>();
    let nextId = 1;
    const originalRequest = window.requestIdleCallback;
    const originalCancel = window.cancelIdleCallback;
    window.requestIdleCallback = (callback: IdleRequestCallback): number => {
        const id = nextId;
        nextId += 1;
        pending.set(id, callback);
        return id;
    };
    window.cancelIdleCallback = (id: number): void => {
        pending.delete(id);
    };
    return {
        flush: () => {
            const callbacks = [...pending.values()];
            pending.clear();
            callbacks.forEach(callback =>
                callback({ didTimeout: false, timeRemaining: () => 50 })
            );
        },
        pendingCount: () => pending.size,
        restore: () => {
            window.requestIdleCallback = originalRequest;
            window.cancelIdleCallback = originalCancel;
        },
    };
}

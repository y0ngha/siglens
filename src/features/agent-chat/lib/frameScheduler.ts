/**
 * 텍스트 조각을 한 프레임에 한 번만 화면에 반영한다(rAF). `requestAnimationFrame`이
 * 없는 환경(일부 테스트·워커)에서는 한 프레임 남짓한 타이머로 대신한다.
 */
const FRAME_FALLBACK_MS = 16;

/** `scheduleFrame`의 예약 핸들. 어느 API로 예약했는지에 따라 취소 함수가 다르다. */
export type FrameHandle =
    | { kind: 'raf'; id: number }
    | { kind: 'timeout'; id: ReturnType<typeof setTimeout> };

/** `callback`을 다음 프레임에 한 번 부르도록 예약한다. */
export function scheduleFrame(callback: () => void): FrameHandle {
    if (typeof requestAnimationFrame === 'function')
        return { kind: 'raf', id: requestAnimationFrame(callback) };
    return { kind: 'timeout', id: setTimeout(callback, FRAME_FALLBACK_MS) };
}

/** `scheduleFrame`으로 잡은 예약을 거둔다. */
export function cancelFrame(handle: FrameHandle): void {
    if (handle.kind === 'raf') cancelAnimationFrame(handle.id);
    else clearTimeout(handle.id);
}

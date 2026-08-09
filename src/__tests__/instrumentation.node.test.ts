/**
 * Task 9: `src/instrumentation.node.ts` — registerShutdownHandlers() 단위 테스트.
 *
 * 이 파일은 Node 런타임 전용이며 Edge 번들에서 제외된다. 테스트는 vitest `node`
 * 프로젝트에서 실행된다.
 *
 * 검증 범위:
 * - SIGTERM + in-flight 카운터 1 → 카운터가 0이 되고 POST_DRAIN_GRACE_MS 경과 후 exit(0)
 * - 카운터 이미 0 → POST_DRAIN_GRACE_MS 경과 후 exit(0)
 * - 두 번째 SIGTERM → no-op (drain을 두 번 시작하지 않는다)
 *
 * `process.exit`를 mock해 테스트 러너가 실제로 종료되지 않도록 한다.
 *
 * `shutdownHandlersRegistered`는 모듈 레벨 싱글톤이라 테스트 간 격리가 필요하다.
 * 각 테스트 전에 `vi.resetModules()`로 모듈 레지스트리를 초기화하고 동적 import로
 * 새 인스턴스를 얻는다 — SIGTERM 리스너도 afterEach에서 제거한다.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── 의존성 mock (hoisted) ──────────────────────────────────────────────

const { mockDrainBackgroundTasks, mockStopAcceptingBackgroundTasks } =
    vi.hoisted(() => ({
        mockDrainBackgroundTasks: vi.fn().mockResolvedValue(undefined),
        mockStopAcceptingBackgroundTasks: vi.fn(),
    }));

vi.mock('@/entities/ticker/lib/backgroundTask', () => ({
    drainBackgroundTasks: mockDrainBackgroundTasks,
    stopAcceptingBackgroundTasks: mockStopAcceptingBackgroundTasks,
}));

/**
 * `activeStreams`를 실제 구현으로 고정한다(vi.importActual).
 *
 * `vi.resetModules()`는 모듈 레지스트리를 초기화하지만 vi.mock 등록은 유지한다.
 * 고정 없이 `await import('@/instrumentation.node')`를 하면 instrumentation이
 * 로드할 때 activeStreams도 새 인스턴스를 얻어, 이 테스트 파일의 정적 import와
 * 별개의 카운터를 가진다. 고정하면 양쪽이 동일한 인스턴스를 참조한다.
 */
vi.mock('@/shared/lib/sse/activeStreams', async () =>
    vi.importActual('@/shared/lib/sse/activeStreams')
);

// activeStreams는 실제 구현을 사용한다 — 카운터를 조작해 drain 대기를 제어한다.
import {
    incrementActiveStreams,
    decrementActiveStreams,
    __resetActiveStreamsForTests,
} from '@/shared/lib/sse/activeStreams';

// ── 테스트 ────────────────────────────────────────────────────────────

describe('registerShutdownHandlers()', () => {
    let exitSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.useFakeTimers();
        __resetActiveStreamsForTests();
        // 이전 테스트의 호출 기록을 지운다 — vi.resetModules()는 mock 함수 자체를
        // 교체하지 않아 호출 카운터가 누적된다.
        mockDrainBackgroundTasks.mockReset();
        mockDrainBackgroundTasks.mockResolvedValue(undefined);
        mockStopAcceptingBackgroundTasks.mockReset();
        // `shutdownHandlersRegistered` 싱글톤을 초기화하기 위해 모듈 레지스트리를 리셋.
        // 이렇게 하면 다음 동적 import가 모듈을 새로 실행해 `= false`로 시작한다.
        vi.resetModules();
        // process.exit를 mock해 실제 종료를 방지한다.
        exitSpy = vi
            .spyOn(process, 'exit')
            .mockImplementation(
                (_code?: number | string | null | undefined) =>
                    undefined as never
            );
    });

    afterEach(() => {
        vi.useRealTimers();
        __resetActiveStreamsForTests();
        exitSpy.mockRestore();
        // additive 등록이므로 이전 테스트의 핸들러를 제거한다.
        process.removeAllListeners('SIGTERM');
        process.removeAllListeners('SIGINT');
    });

    it('in-flight 카운터 1 → 카운터가 0이 되고 POST_DRAIN_GRACE_MS 경과 후 exit(0)를 호출한다', async () => {
        /**
         * Task 2: 이 단일 테스트가 두 가지 독립적인 회귀를 잡는다.
         *
         * 회귀 A — `waitForActiveStreams` 삭제:
         *   drainBackgroundTasks만 await하면 drain이 즉시 완료된다.
         *   그러면 count=1인 상태에서 5 000ms 후 setTimeout이 발화해
         *   "exit NOT called" 단언이 실패한다.
         *
         * 회귀 B — `setTimeout` grace 래퍼 삭제:
         *   drain 완료 시 `process.exit(0)`을 직접 호출하면,
         *   decrement 이후 microtask flush(advanceTimersByTimeAsync)에서
         *   즉시 exit가 발화해 "999ms 후 exit NOT called" 단언이 실패한다.
         *
         * 5 000ms를 선택한 이유: POST_DRAIN_GRACE_MS(1 000ms) < 5 000ms
         * 이므로 회귀 A(setTimeout 즉시 발화)를 잡을 수 있고,
         * SHUTDOWN_DRAIN_DEADLINE_MS(180 000ms) > 5 000ms이므로
         * 올바른 구현에서는 waitForActiveStreams deadline이 여기서 발화하지 않는다.
         */

        // 스트림 1개 진행 중.
        incrementActiveStreams();

        const { registerShutdownHandlers } =
            await import('@/instrumentation.node');
        registerShutdownHandlers();

        process.emit('SIGTERM');

        // drain이 pending 중 — exit가 즉시 호출되지 않는다.
        await Promise.resolve();
        expect(exitSpy).not.toHaveBeenCalled();

        // count=1이므로 waitForActiveStreams 미resolve.
        // 5 000ms 경과 후에도 exit 없어야 한다.
        // waitForActiveStreams를 삭제하면 drain이 즉시 완료돼
        // setTimeout(1 000ms)가 이미 발화 → 이 단언 실패 (회귀 A 감지).
        await vi.advanceTimersByTimeAsync(5_000);
        expect(exitSpy).not.toHaveBeenCalled();

        // 카운터를 0으로 내리면 waitForActiveStreams가 resolve된다.
        decrementActiveStreams();

        // POST_DRAIN_GRACE_MS - 1ms = 999ms 경과.
        // 올바른 구현: setTimeout(exit, 1 000ms)가 아직 미발화 → exit 없어야 한다.
        // setTimeout을 삭제하면 decrement 직후 microtask flush에서 exit가 바로 발화해
        // 이 단언이 실패한다 (회귀 B 감지).
        await vi.advanceTimersByTimeAsync(999);
        expect(exitSpy).not.toHaveBeenCalled();

        // 마지막 1ms — POST_DRAIN_GRACE_MS(1 000ms) 완성 → exit(0).
        await vi.advanceTimersByTimeAsync(1);
        expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it('카운터가 이미 0이면 SIGTERM → POST_DRAIN_GRACE_MS 후 즉시 exit(0)를 호출한다', async () => {
        // 카운터가 0이면 waitForActiveStreams가 즉시 resolve된다.

        const { registerShutdownHandlers } =
            await import('@/instrumentation.node');
        registerShutdownHandlers();

        process.emit('SIGTERM');

        // drain promise 체인이 플러시되기 전에는 exit 없다.
        await Promise.resolve();
        expect(exitSpy).not.toHaveBeenCalled();

        // POST_DRAIN_GRACE_MS 진행.
        await vi.advanceTimersByTimeAsync(1_000);

        expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it('두 번째 SIGTERM은 no-op — drain을 이중으로 실행하지 않는다', async () => {
        const { registerShutdownHandlers } =
            await import('@/instrumentation.node');
        registerShutdownHandlers();

        // 첫 번째 SIGTERM.
        process.emit('SIGTERM');
        // 두 번째 SIGTERM — shuttingDown=true라 handleShutdown이 즉시 return한다.
        process.emit('SIGTERM');

        // stopAcceptingBackgroundTasks는 첫 번째 SIGTERM에서만 호출된다.
        expect(mockStopAcceptingBackgroundTasks).toHaveBeenCalledTimes(1);
        // drain도 한 번만 실행된다.
        expect(mockDrainBackgroundTasks).toHaveBeenCalledTimes(1);

        // POST_DRAIN_GRACE_MS 진행 — exit도 한 번만 호출된다.
        await vi.advanceTimersByTimeAsync(1_000);
        expect(exitSpy).toHaveBeenCalledTimes(1);
    });
});

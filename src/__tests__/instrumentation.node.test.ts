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
        // 스트림이 1개 진행 중이면 drain이 완료될 때까지 exit를 미뤄야 한다.
        incrementActiveStreams();

        const { registerShutdownHandlers } =
            await import('@/instrumentation.node');
        registerShutdownHandlers();

        process.emit('SIGTERM');

        // drain이 pending 중 — exit가 즉시 호출되지 않는다.
        await Promise.resolve();
        expect(exitSpy).not.toHaveBeenCalled();

        // 카운터를 0으로 내리면 waitForActiveStreams가 resolve된다.
        decrementActiveStreams();

        // POST_DRAIN_GRACE_MS(1000ms)를 진행해 setTimeout 콜백이 발화된다.
        await vi.advanceTimersByTimeAsync(1_000);

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

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
    fireAndForget,
    drainBackgroundTasks,
    stopAcceptingBackgroundTasks,
    __resetBackgroundTasksForTests,
    __pendingBackgroundTaskCount,
} from '../../lib/backgroundTask';

/** deferred promise + resolve/reject 핸들 생성 헬퍼. */
function deferred<T = void>(): {
    promise: Promise<T>;
    resolve: (v: T) => void;
    reject: (e: unknown) => void;
} {
    let resolve!: (v: T) => void;
    let reject!: (e: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

describe('fireAndForget', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        __resetBackgroundTasksForTests();
    });

    it('options.waitUntil이 제공되면 해당 훅에 promise를 위임하고 registry에 추가하지 않는다', () => {
        const waitUntil = vi.fn();
        const p = Promise.resolve();
        fireAndForget(p, { waitUntil });
        expect(waitUntil).toHaveBeenCalledWith(p);
        expect(__pendingBackgroundTaskCount()).toBe(0);
    });

    it('options가 없고 promise가 reject되면 console.error로 로깅하고 unhandledRejection을 막는다', async () => {
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        fireAndForget(Promise.reject(new Error('boom')));
        await new Promise(r => setTimeout(r, 0));
        expect(errSpy).toHaveBeenCalledWith(
            '[fireAndForget] background task error:',
            expect.any(Error)
        );
    });

    it('options가 없고 promise가 resolve되면 console.error를 호출하지 않는다', async () => {
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        fireAndForget(Promise.resolve());
        await new Promise(r => setTimeout(r, 0));
        expect(errSpy).not.toHaveBeenCalled();
    });
});

describe('background task registry', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
        __resetBackgroundTasksForTests();
    });

    it('registry 경로 promise를 추적하고 settle 시 제거한다', async () => {
        const d = deferred();
        fireAndForget(d.promise);
        expect(__pendingBackgroundTaskCount()).toBe(1);

        d.resolve();
        // finally 콜백이 microtask 큐에서 실행되도록 양보.
        await new Promise(r => setTimeout(r, 0));
        expect(__pendingBackgroundTaskCount()).toBe(0);
    });

    it('reject된 작업도 추적 후 registry에서 제거한다(unhandledRejection 없이)', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const d = deferred();
        fireAndForget(d.promise);
        expect(__pendingBackgroundTaskCount()).toBe(1);

        d.reject(new Error('boom'));
        await new Promise(r => setTimeout(r, 0));
        expect(__pendingBackgroundTaskCount()).toBe(0);
    });

    it('drainBackgroundTasks는 추적 중인 모든 작업이 끝날 때까지 await한다', async () => {
        const a = deferred();
        const b = deferred();
        fireAndForget(a.promise);
        fireAndForget(b.promise);
        expect(__pendingBackgroundTaskCount()).toBe(2);

        let drained = false;
        const drain = drainBackgroundTasks(10_000).then(() => {
            drained = true;
        });

        await new Promise(r => setTimeout(r, 0));
        expect(drained).toBe(false);

        a.resolve();
        b.resolve();
        await drain;
        expect(drained).toBe(true);
    });

    it('drainBackgroundTasks는 deadline을 넘기면 남은 작업을 버리고 반환한다', async () => {
        vi.useFakeTimers();
        const never = deferred(); // 절대 resolve하지 않음
        fireAndForget(never.promise);

        let drained = false;
        const drain = drainBackgroundTasks(1_000).then(() => {
            drained = true;
        });

        // deadline 직전: 아직 안 끝남.
        await vi.advanceTimersByTimeAsync(999);
        expect(drained).toBe(false);

        // deadline 도달: 남은 작업 버리고 반환.
        await vi.advanceTimersByTimeAsync(1);
        await drain;
        expect(drained).toBe(true);
    });

    it('대기 중인 작업이 없으면 즉시 반환한다', async () => {
        await expect(drainBackgroundTasks(10_000)).resolves.toBeUndefined();
    });

    it('stopAcceptingBackgroundTasks 이후 도착한 작업은 registry에 추가하지 않는다', () => {
        stopAcceptingBackgroundTasks();
        fireAndForget(deferred().promise);
        expect(__pendingBackgroundTaskCount()).toBe(0);
    });

    it('drain 중에도 catch-net은 유지되어 거부가 unhandled로 새지 않는다', async () => {
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        stopAcceptingBackgroundTasks();
        fireAndForget(Promise.reject(new Error('late')));
        await new Promise(r => setTimeout(r, 0));
        expect(errSpy).toHaveBeenCalledWith(
            '[fireAndForget] background task error:',
            expect.any(Error)
        );
    });
});

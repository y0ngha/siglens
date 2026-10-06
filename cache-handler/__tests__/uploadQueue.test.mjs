import { vi } from 'vitest';

const { setEntry } = vi.hoisted(() => ({ setEntry: vi.fn() }));
vi.mock('../s3Store.mjs', () => ({ setEntry: (...a) => setEntry(...a) }));

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
    DRAIN_UPLOADS_SYMBOL,
    registerDrain,
    drainUploads,
    inFlightCount,
    pendingEntry,
    scheduleUpload,
    __resetForTests,
} from '../uploadQueue.mjs';

function deferred() {
    let resolve;
    const promise = new Promise(r => {
        resolve = r;
    });
    return { promise, resolve };
}

beforeEach(() => {
    __resetForTests();
    setEntry.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.resetModules();
});

describe('uploadQueue', () => {
    it('업로드가 끝날 때까지 대기 사본을 보여주고, 끝나면 지운다', async () => {
        const gate = deferred();
        setEntry.mockReturnValueOnce(gate.promise);
        const entry = { value: 1 };
        await scheduleUpload('/AAPL', 'APP_PAGE', entry);
        expect(pendingEntry('/AAPL', 'APP_PAGE')).toBe(entry);
        // FETCH와 페이지는 S3에서 다른 객체다 — 슬롯도 갈린다.
        expect(pendingEntry('/AAPL', 'FETCH')).toBeNull();

        gate.resolve();
        expect(await drainUploads(1_000)).toBe(0);
        expect(pendingEntry('/AAPL', 'APP_PAGE')).toBeNull();
        expect(setEntry).toHaveBeenCalledWith('/AAPL', 'APP_PAGE', entry);
    });

    it('drain은 마감이 지나면 남은 개수를 돌려준다', async () => {
        vi.useFakeTimers();
        setEntry.mockReturnValueOnce(new Promise(() => {}));
        await scheduleUpload('/AAPL', 'APP_PAGE', { value: 1 });
        const drained = drainUploads(5_000);
        await vi.advanceTimersByTimeAsync(5_000);
        expect(await drained).toBe(1);
    });

    it('drain 중에 들어온 업로드도 마감 안에서 기다린다', async () => {
        const first = deferred();
        const second = deferred();
        setEntry
            .mockReturnValueOnce(first.promise)
            .mockReturnValueOnce(second.promise);
        await scheduleUpload('/A', 'APP_PAGE', { value: 1 });
        const drained = drainUploads(1_000);
        await scheduleUpload('/B', 'APP_PAGE', { value: 2 });
        first.resolve();
        await Promise.resolve();
        second.resolve();
        expect(await drained).toBe(0);
        expect(inFlightCount()).toBe(0);
    });

    it('진행 중 업로드가 상한을 넘으면 그 업로드를 기다린다(배압)', async () => {
        vi.stubEnv('ISR_CACHE_MAX_INFLIGHT_UPLOADS', '1');
        vi.resetModules();
        const queue = await import('../uploadQueue.mjs');
        const blocked = deferred();
        const gate = deferred();
        setEntry
            .mockReturnValueOnce(blocked.promise)
            .mockReturnValueOnce(gate.promise);

        await queue.scheduleUpload('/A', 'APP_PAGE', { value: 1 });
        let settled = false;
        const second = queue
            .scheduleUpload('/B', 'APP_PAGE', { value: 2 })
            .then(() => {
                settled = true;
            });
        await Promise.resolve();
        await Promise.resolve();
        expect(settled).toBe(false);

        gate.resolve();
        await second;
        expect(settled).toBe(true);
        blocked.resolve();
        expect(await queue.drainUploads(1_000)).toBe(0);
    });

    it('drain 함수를 전역 심볼의 Set에 등록한다(instrumentation.node.ts가 찾는 키)', () => {
        expect(DRAIN_UPLOADS_SYMBOL).toBe(
            Symbol.for('siglens.isrCache.drainUploads')
        );
        const registry = globalThis[DRAIN_UPLOADS_SYMBOL];
        expect(registry).toBeInstanceOf(Set);
        expect(registry.has(drainUploads)).toBe(true);
    });

    it('기존 등록을 덮어쓰지 않고 합치며, 같은 drain은 한 번만 등록하고 로그를 남긴다', () => {
        const log = vi.spyOn(console, 'log').mockImplementation(() => {});
        const other = async () => 0;
        const registry = { [DRAIN_UPLOADS_SYMBOL]: new Set([other]) };
        registerDrain(registry);
        registerDrain(registry);
        expect([...registry[DRAIN_UPLOADS_SYMBOL]]).toEqual([
            other,
            drainUploads,
        ]);
        expect(log).toHaveBeenCalledTimes(1);
        expect(log.mock.calls[0][0]).toMatch(
            /\[isr-cache\] background upload drain registered/
        );
        log.mockRestore();
    });

    it('레지스트리에 Set이 아닌 값이 있으면 새 Set으로 시작한다', () => {
        vi.spyOn(console, 'log').mockImplementation(() => {});
        const registry = { [DRAIN_UPLOADS_SYMBOL]: () => 0 };
        registerDrain(registry);
        expect(registry[DRAIN_UPLOADS_SYMBOL]).toEqual(new Set([drainUploads]));
        vi.restoreAllMocks();
    });
});

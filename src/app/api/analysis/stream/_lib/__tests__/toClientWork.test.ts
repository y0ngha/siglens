import { describe, expect, it, vi } from 'vitest';
import type { MeterGate } from '../../meteredRevealGate';
import { toClientWork } from '../toClientWork';

const OFF: MeterGate = { kind: 'off' };
const EXHAUSTED: MeterGate = { kind: 'exhausted' };

describe('toClientWork', () => {
    it('done 결과에서 unfilteredResult를 떼고 meter를 싣는다', async () => {
        const release = vi.fn(async () => {});
        const out = await toClientWork(
            Promise.resolve({
                status: 'done',
                result: 1,
                unfilteredResult: 2,
            }),
            EXHAUSTED,
            release
        );
        expect(out).toEqual({
            status: 'done',
            result: 1,
            meter: { state: 'exhausted' },
        });
        expect(release).not.toHaveBeenCalled();
    });

    it('cached 결과에도 meter를 싣는다', async () => {
        const out = await toClientWork(
            Promise.resolve({ status: 'cached', result: 1 }),
            EXHAUSTED,
            async () => {}
        );
        expect(out).toEqual({
            status: 'cached',
            result: 1,
            meter: { state: 'exhausted' },
        });
    });

    it('미터가 off면 meter 필드를 싣지 않는다', async () => {
        const out = await toClientWork(
            Promise.resolve({ status: 'done', result: 1 }),
            OFF,
            async () => {}
        );
        expect(out).toEqual({ status: 'done', result: 1 });
    });

    it('결과 없는 상태는 meter 없이 통과시키고 미터 기록을 되돌린다', async () => {
        const release = vi.fn(async () => {});
        const out = await toClientWork(
            Promise.resolve({ status: 'miss_no_trigger' }),
            EXHAUSTED,
            release
        );
        expect(out).toEqual({ status: 'miss_no_trigger' });
        expect(release).toHaveBeenCalledTimes(1);
    });

    it('reject되면 미터 기록을 되돌리고 같은 오류로 reject한다', async () => {
        const release = vi.fn(async () => {});
        const failure = new Error('boom');
        await expect(
            toClientWork(Promise.reject(failure), EXHAUSTED, release)
        ).rejects.toBe(failure);
        expect(release).toHaveBeenCalledTimes(1);
    });
});

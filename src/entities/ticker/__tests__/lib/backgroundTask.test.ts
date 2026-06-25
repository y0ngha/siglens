import { describe, it, expect, vi, afterEach } from 'vitest';
import { fireAndForget } from '../../lib/backgroundTask';

describe('fireAndForget', () => {
    afterEach(() => vi.restoreAllMocks());

    it('options.waitUntil이 제공되면 해당 훅에 promise를 위임한다', () => {
        const waitUntil = vi.fn();
        const p = Promise.resolve();
        fireAndForget(p, { waitUntil });
        expect(waitUntil).toHaveBeenCalledWith(p);
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
});

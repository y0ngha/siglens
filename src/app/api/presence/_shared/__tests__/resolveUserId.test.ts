import { afterEach, describe, expect, it, vi } from 'vitest';

const getCurrentUser = vi.hoisted(() => vi.fn());
vi.mock('@/entities/auth/lib/getCurrentUser', () => ({ getCurrentUser }));

import { resolveUserId } from '../resolveUserId';

describe('resolveUserId', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        getCurrentUser.mockReset();
    });

    it('세션이 회원으로 확정되면 id를 준다', async () => {
        getCurrentUser.mockResolvedValue({ id: 'user-7' });
        await expect(resolveUserId('[t]')).resolves.toBe('user-7');
    });

    it('세션이 없으면 null', async () => {
        getCurrentUser.mockResolvedValue(null);
        await expect(resolveUserId('[t]')).resolves.toBeNull();
    });

    it('조회가 던지면 로그를 남기고 비회원으로 접는다', async () => {
        const error = new Error('db down');
        getCurrentUser.mockRejectedValue(error);
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        await expect(resolveUserId('[t]')).resolves.toBeNull();
        expect(spy).toHaveBeenCalledWith('[t] getCurrentUser failed:', error);
    });
});

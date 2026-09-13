import type { MockedFunction } from 'vitest';

const { cookieStore } = vi.hoisted(() => ({
    cookieStore: { get: vi.fn(), set: vi.fn() },
}));
vi.mock('next/headers', () => ({ cookies: async () => cookieStore }));
vi.mock('@/entities/auth/lib/getCurrentUser', () => ({
    getCurrentUser: vi.fn(),
}));

import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { currentUserAction } from '@/entities/auth/actions/currentUserAction';

const mockGet = getCurrentUser as MockedFunction<typeof getCurrentUser>;

describe('currentUserAction', () => {
    beforeEach(() => {
        cookieStore.get.mockReset();
        cookieStore.set.mockReset();
        mockGet.mockReset();
    });

    it('getCurrentUser 결과를 그대로 반환하고 쿠키는 건드리지 않는다', async () => {
        const fakeUser = { id: 'u1' } as never;
        mockGet.mockResolvedValue(fakeUser);
        cookieStore.get.mockReturnValue({ value: 'live' });
        await expect(currentUserAction()).resolves.toBe(fakeUser);
        expect(cookieStore.set).not.toHaveBeenCalled();
    });

    it('DB가 모르는 세션 쿠키는 세션·힌트 쿠키를 만료시킨다 — 프록시 가드가 /login을 막지 않게', async () => {
        mockGet.mockResolvedValue(null);
        cookieStore.get.mockReturnValue({ value: 'stale-token' });
        await expect(currentUserAction()).resolves.toBeNull();
        const cleared = cookieStore.set.mock.calls.map(([c]) => c);
        expect(cleared).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    name: 'siglens_session',
                    value: '',
                    maxAge: 0,
                }),
                expect.objectContaining({
                    name: 'siglens_auth',
                    value: '',
                    maxAge: 0,
                }),
            ])
        );
    });

    it('쿠키가 없는 게스트는 아무것도 쓰지 않는다', async () => {
        mockGet.mockResolvedValue(null);
        cookieStore.get.mockReturnValue(undefined);
        await currentUserAction();
        expect(cookieStore.set).not.toHaveBeenCalled();
    });

    it('조회 실패는 null이지만 쿠키를 지우지 않는다 — 일시 장애로 로그아웃시키지 않는다', async () => {
        mockGet.mockRejectedValue(new Error('db down'));
        cookieStore.get.mockReturnValue({ value: 'live' });
        vi.spyOn(console, 'error').mockImplementation(() => {});
        await expect(currentUserAction()).resolves.toBeNull();
        expect(cookieStore.set).not.toHaveBeenCalled();
    });
});

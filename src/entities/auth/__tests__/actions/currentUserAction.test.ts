const { cookieStore, hostHeader } = vi.hoisted(() => ({
    cookieStore: { get: vi.fn(), set: vi.fn() },
    hostHeader: {
        value: 'siglens.io' as string | null,
        error: null as Error | null,
    },
}));
vi.mock('next/headers', () => ({
    cookies: async () => cookieStore,
    headers: async () => {
        if (hostHeader.error) throw hostHeader.error;
        return new Headers({ host: hostHeader.value ?? '' });
    },
}));
vi.mock('@/entities/auth/server/getCurrentUser', () => ({
    getCurrentUser: vi.fn(),
}));

import type { MockedFunction } from 'vitest';
import { currentUserAction } from '@/entities/auth/actions/currentUserAction';
import { getCurrentUser } from '@/entities/auth/server/getCurrentUser';
import { SECONDS_PER_DAY } from '@/shared/config/time';

/** Cookie jar by name: `{ siglens_session: 'x' }`. Unlisted names are absent. */
const jar = (values: Record<string, string>) =>
    cookieStore.get.mockImplementation((name: string) =>
        name in values ? { value: values[name] } : undefined
    );
const hintWrite = () =>
    cookieStore.set.mock.calls
        .map(([c]) => c)
        .find(c => c.name === 'siglens_signed_in');

const mockGet = getCurrentUser as MockedFunction<typeof getCurrentUser>;

describe('currentUserAction', () => {
    beforeEach(() => {
        cookieStore.get.mockReset();
        cookieStore.set.mockReset();
        mockGet.mockReset();
        hostHeader.value = 'siglens.io';
        hostHeader.error = null;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('getCurrentUser 결과를 그대로 반환하고 쿠키는 건드리지 않는다', async () => {
        const fakeUser = { id: 'u1' } as never;
        mockGet.mockResolvedValue(fakeUser);
        jar({ siglens_session: 'live', siglens_signed_in: '1' });
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

    it('DB 오류는 세션 토큰 원문을 로그에 남기지 않는다 — DrizzleQueryError 메시지·params·cause 모두', async () => {
        const sentinel = 'SENTINEL-SESSION-TOKEN-0123456789abcdef';
        const cause = Object.assign(new Error(`cause ${sentinel}`), {
            code: '57P01',
        });
        const dbError = Object.assign(
            new Error(
                `Failed query: select "id" from "sessions" where "id" = $1\nparams: ${sentinel},1`,
                { cause }
            ),
            { name: 'DrizzleQueryError', params: [sentinel, 1], cause }
        );
        mockGet.mockRejectedValue(dbError);
        cookieStore.get.mockReturnValue({ value: sentinel });
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        await expect(currentUserAction()).resolves.toBeNull();
        expect(errorSpy).toHaveBeenCalledWith(
            '[currentUserAction] unexpected error',
            { name: 'DrizzleQueryError', code: '57P01' }
        );
        const logged = errorSpy.mock.calls
            .flat()
            .map(arg =>
                typeof arg === 'string'
                    ? arg
                    : JSON.stringify(arg, Object.getOwnPropertyNames(arg ?? {}))
            )
            .join('\n');
        expect(logged).not.toContain(sentinel);
    });
    describe('main-host sign-in hint (siglens_signed_in)', () => {
        const user = { id: 'u1' } as never;

        it('main host + user + no hint -> sets the hint for a pre-deploy session', async () => {
            mockGet.mockResolvedValue(user);
            jar({ siglens_session: 'live' });
            await expect(currentUserAction()).resolves.toBe(user);
            expect(hintWrite()).toEqual({
                name: 'siglens_signed_in',
                value: '1',
                maxAge: 30 * SECONDS_PER_DAY,
                path: '/',
                domain: 'siglens.io',
                sameSite: 'lax',
                secure: false,
                httpOnly: true,
            });
        });

        it('main host + user + hint -> no hint write', async () => {
            mockGet.mockResolvedValue(user);
            jar({ siglens_session: 'live', siglens_signed_in: '1' });
            await currentUserAction();
            expect(cookieStore.set).not.toHaveBeenCalled();
        });

        it('main host + no user + hint (no session cookie) -> expires the hint only', async () => {
            mockGet.mockResolvedValue(null);
            jar({ siglens_signed_in: '1' });
            await expect(currentUserAction()).resolves.toBeNull();
            expect(hintWrite()).toEqual(
                expect.objectContaining({
                    value: '',
                    maxAge: 0,
                    domain: 'siglens.io',
                    path: '/',
                })
            );
            expect(cookieStore.set).toHaveBeenCalledTimes(1);
        });

        it('main host + no user + hint + stale session cookie -> hint is expired and the stale session is still cleared', async () => {
            mockGet.mockResolvedValue(null);
            jar({ siglens_session: 'stale', siglens_signed_in: '1' });
            await currentUserAction();
            const names = cookieStore.set.mock.calls.map(([c]) => c.name);
            expect(names).toEqual(
                expect.arrayContaining([
                    'siglens_session',
                    'siglens_auth',
                    'siglens_signed_in',
                ])
            );
            expect(hintWrite()?.maxAge).toBe(0);
        });

        it('main host + no user + no hint -> no hint write', async () => {
            mockGet.mockResolvedValue(null);
            jar({});
            await currentUserAction();
            expect(hintWrite()).toBeUndefined();
            expect(cookieStore.set).not.toHaveBeenCalled();
        });

        it('ai host + user -> no hint write (the ai session is not a main session)', async () => {
            hostHeader.value = 'ai.siglens.io';
            mockGet.mockResolvedValue(user);
            jar({ siglens_session: 'live' });
            await currentUserAction();
            expect(hintWrite()).toBeUndefined();
        });

        it('ai host + no user + hint -> the hint is left alone', async () => {
            hostHeader.value = 'ai.siglens.io';
            mockGet.mockResolvedValue(null);
            jar({ siglens_signed_in: '1' });
            await currentUserAction();
            expect(hintWrite()).toBeUndefined();
        });

        it('cookies().set throws while syncing the hint -> the user is still returned and the error is logged', async () => {
            mockGet.mockResolvedValue(user);
            jar({ siglens_session: 'live' });
            cookieStore.set.mockImplementation(() => {
                throw new Error('cannot set cookie');
            });
            const errorSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {});
            await expect(currentUserAction()).resolves.toBe(user);
            expect(errorSpy).toHaveBeenCalledWith(
                '[currentUserAction] main session hint sync failed',
                expect.anything()
            );
        });

        it('headers() throws while syncing the hint -> the user is still returned and the error is logged', async () => {
            mockGet.mockResolvedValue(user);
            jar({ siglens_session: 'live' });
            hostHeader.error = new Error('no request scope');
            const errorSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {});
            await expect(currentUserAction()).resolves.toBe(user);
            expect(errorSpy).toHaveBeenCalledWith(
                '[currentUserAction] main session hint sync failed',
                expect.anything()
            );
        });

        it('lookup failure -> no hint write', async () => {
            mockGet.mockRejectedValue(new Error('db down'));
            jar({ siglens_session: 'live' });
            vi.spyOn(console, 'error').mockImplementation(() => {});
            await currentUserAction();
            expect(hintWrite()).toBeUndefined();
        });
    });
});

import { AUTH_SESSION_COOKIE_NAME } from '@/entities/session/lib/sessionCookie';
import { logoutUser } from '@/entities/user/lib/logoutUser';
import type { SessionRepository } from '@/shared/db/types';

function makeDependencies(sessionInvalidated: boolean): {
    dependencies: { sessions: SessionRepository };
    deleteSession: ReturnType<typeof vi.fn>;
} {
    const deleteSession = vi.fn().mockResolvedValue(sessionInvalidated);

    return {
        dependencies: {
            sessions: {
                createSession: vi.fn(),
                findSession: vi.fn(),
                deleteSession,
                deleteExpiredSessions: vi.fn(),
            },
        },
        deleteSession,
    };
}

describe('logoutUser', () => {
    it('invalidates the session and returns an expired HTTP-only cookie', async () => {
        const { dependencies, deleteSession } = makeDependencies(true);

        const result = await logoutUser(
            { sessionToken: 'session-1' },
            dependencies
        );

        expect(deleteSession).toHaveBeenCalledWith('session-1');
        expect(result).toEqual({
            ok: true,
            sessionInvalidated: true,
            cookie: {
                name: AUTH_SESSION_COOKIE_NAME,
                value: '',
                httpOnly: true,
                secure: true,
                sameSite: 'lax',
                path: '/',
                expires: new Date('1970-01-01T00:00:00.000Z'),
                maxAgeSeconds: 0,
            },
        });
    });

    it('clears the cookie even when no persisted session exists', async () => {
        const { dependencies } = makeDependencies(false);

        const result = await logoutUser(
            { sessionToken: 'missing-session' },
            dependencies,
            {
                cookieName: 'custom_session',
                secureCookie: false,
                sameSite: 'none',
                path: '/app',
            }
        );

        expect(result).toEqual({
            ok: true,
            sessionInvalidated: false,
            cookie: {
                name: 'custom_session',
                value: '',
                httpOnly: true,
                secure: false,
                sameSite: 'none',
                path: '/app',
                expires: new Date('1970-01-01T00:00:00.000Z'),
                maxAgeSeconds: 0,
            },
        });
    });
});

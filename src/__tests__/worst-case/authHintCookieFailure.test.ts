vi.mock('next/headers', () => ({
    cookies: vi.fn(),
}));

vi.mock('next/navigation', () => ({
    redirect: vi.fn((url: string) => {
        throw new Error(`NEXT_REDIRECT:${url}`);
    }),
}));

vi.mock('@/entities/session', () => ({
    applyAuthCookie: vi.fn((cookie: unknown) => cookie),
    isSecureCookieEnv: vi.fn(() => false),
    createAuthHintCookie: vi.fn(() => ({
        name: 'siglens_auth_hint',
        value: '1',
    })),
    DEFAULT_SESSION_TTL_SECONDS: 604800,
}));
vi.mock('@/entities/session/api', () => ({
    DrizzleSessionRepository: vi.fn(),
}));
vi.mock('@/entities/session/lib/bcrypt', () => ({
    bcryptPasswordVerifier: { verifyPassword: vi.fn() },
}));
// getAuthDatabaseClient는 barrel이 아닌 @/entities/session/lib/db에서 직접 import되므로
// (server-only 체인을 client 번들에서 분리) 해당 경로를 별도로 mock한다.
vi.mock('@/entities/session/lib/db', () => ({
    getAuthDatabaseClient: vi.fn(() => ({ db: {} })),
}));

vi.mock('@/entities/user', () => ({
    DrizzleUserRepository: vi.fn(),
    loginUser: vi.fn(),
}));

vi.mock('@/shared/lib/auth/redirect', () => ({
    sanitizeNextPath: vi.fn((path?: string) => path ?? '/'),
}));

vi.mock('@/shared/lib/auth/validation', () => ({
    normalizeEmail: vi.fn((e: string) => e.toLowerCase().trim()),
}));

import { loginAction } from '@/features/auth-login/actions/loginAction';
import { loginUser } from '@/entities/user';
import { cookies } from 'next/headers';
import type { LoginFormState } from '@/shared/lib/auth/formTypes';

const mockLoginUser = loginUser as ReturnType<typeof vi.fn>;
const mockCookies = cookies as ReturnType<typeof vi.fn>;

const INITIAL_STATE: LoginFormState = { error: null };

function createFormData(fields: Record<string, string>): FormData {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) {
        fd.set(k, v);
    }
    return fd;
}

describe('loginAction error handling and cookie behavior', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('returns error state when loginUser fails', async () => {
        mockLoginUser.mockResolvedValue({
            ok: false,
            error: { code: 'invalid_credentials', message: 'Wrong password' },
        });

        const result = await loginAction(
            INITIAL_STATE,
            createFormData({ email: 'test@test.com', password: 'wrong' })
        );

        expect(result.error?.code).toBe('invalid_credentials');
    });

    it('catches unexpected errors and returns generic error', async () => {
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        mockLoginUser.mockRejectedValue(new Error('DB connection lost'));

        const result = await loginAction(
            INITIAL_STATE,
            createFormData({ email: 'test@test.com', password: 'password' })
        );

        expect(result.error?.code).toBe('unexpected');
        expect(errorSpy).toHaveBeenCalledWith(
            '[loginAction] unexpected error:',
            expect.any(Error)
        );
    });

    it('re-throws NEXT_REDIRECT error (redirect after success)', async () => {
        mockLoginUser.mockResolvedValue({
            ok: true,
            user: { id: '1' },
            session: { id: 's1' },
            cookie: { name: 'session', value: 'tok', httpOnly: true },
        });

        const mockSet = vi.fn();
        mockCookies.mockResolvedValue({ set: mockSet });

        await expect(
            loginAction(
                INITIAL_STATE,
                createFormData({ email: 'test@test.com', password: 'pass123' })
            )
        ).rejects.toThrow('NEXT_REDIRECT');
    });

    it('sets both auth cookie and hint cookie on success', async () => {
        mockLoginUser.mockResolvedValue({
            ok: true,
            user: { id: '1' },
            session: { id: 's1' },
            cookie: { name: 'session', value: 'tok', httpOnly: true },
        });

        const setCalls: unknown[] = [];
        mockCookies.mockResolvedValue({
            set: vi.fn((...args: unknown[]) => setCalls.push(args)),
        });

        try {
            await loginAction(
                INITIAL_STATE,
                createFormData({ email: 'test@test.com', password: 'pass123' })
            );
        } catch {
            // NEXT_REDIRECT expected
        }

        expect(setCalls).toHaveLength(2);
    });
});

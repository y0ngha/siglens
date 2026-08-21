// 액션의 리다이렉트는 `localeHref`/`localeRedirect`를 거치고, 그 안의
// `getLocale()`은 next-intl config 파일을 요구한다(빌드 플러그인이 만든다).
// 여기서는 액션 로직만 검증하므로 기본 로케일로 고정한다 — 그러면 리다이렉트
// 경로가 접두사 없는 기존 값과 같아져 기존 단언이 그대로 유효하다.
// ko 카탈로그를 실제로 조회하는 스텁 — 키 오타나 카탈로그 누락이 여기서 잡힌다.
vi.mock('next-intl/server', async () => {
    const { nextIntlServerStub } =
        await import('@/shared/test-utils/catalogTranslator');
    return nextIntlServerStub();
});
vi.mock('next/headers', () => ({
    cookies: vi.fn(),
}));

vi.mock('next/navigation', () => ({
    redirect: vi.fn((url: string) => {
        throw new Error(`NEXT_REDIRECT:${url}`);
    }),
}));

vi.mock('@/entities/auth', () => ({
    applyAuthCookie: vi.fn((cookie: unknown) => cookie),
    isSecureCookieEnv: vi.fn(() => false),
    createAuthHintCookie: vi.fn(() => ({
        name: 'siglens_auth_hint',
        value: '1',
    })),
    DEFAULT_SESSION_TTL_SECONDS: 604800,
    loginUser: vi.fn(),
}));
// DrizzleUserRepository와 DrizzleSessionRepository는 barrel이 아닌
// @/entities/auth/api에서 직접 import되므로 해당 경로를 mock한다.
vi.mock('@/entities/auth/api', () => ({
    DrizzleSessionRepository: vi.fn(),
    DrizzleUserRepository: vi.fn(),
}));
vi.mock('@/entities/auth/lib/bcrypt', () => ({
    bcryptPasswordVerifier: { verifyPassword: vi.fn() },
}));
// getAuthDatabaseClient는 barrel이 아닌 @/entities/auth/lib/db에서 직접 import되므로
// (server-only 체인을 client 번들에서 분리) 해당 경로를 별도로 mock한다.
vi.mock('@/entities/auth/lib/db', () => ({
    getAuthDatabaseClient: vi.fn(() => ({ db: {} })),
}));

vi.mock('@/shared/lib/auth/redirect', () => ({
    sanitizeNextPath: vi.fn((path?: string) => path ?? '/'),
}));

vi.mock('@/shared/lib/auth/validation', () => ({
    normalizeEmail: vi.fn((e: string) => e.toLowerCase().trim()),
}));

import { loginAction } from '@/features/auth-login/actions/loginAction';
import { loginUser } from '@/entities/auth';
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

'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
    applyAuthCookie,
    isSecureCookieEnv,
    createAuthHintCookie,
    DEFAULT_SESSION_TTL_SECONDS,
    loginUser,
} from '@/entities/auth';
import { bcryptPasswordVerifier } from '@/entities/auth/lib/bcrypt';
import {
    DrizzleSessionRepository,
    DrizzleUserRepository,
} from '@/entities/auth/api';
import { getAuthDatabaseClient } from '@/entities/auth/lib/db';
import type { LoginFormState } from '@/shared/lib/auth/formTypes';
import { sanitizeNextPath, toSameOriginPath } from '@/shared/lib/auth/redirect';
import { normalizeEmail } from '@/shared/lib/auth/validation';

export async function loginAction(
    _prev: LoginFormState,
    formData: FormData
): Promise<LoginFormState> {
    try {
        const email = normalizeEmail(String(formData.get('email') ?? ''));
        const password = String(formData.get('password') ?? '');
        const next = sanitizeNextPath(formData.get('next')?.toString());
        const secure = isSecureCookieEnv();

        const { db } = getAuthDatabaseClient();
        const result = await loginUser(
            { email, password },
            {
                users: new DrizzleUserRepository(db),
                sessions: new DrizzleSessionRepository(db),
                passwordVerifier: bcryptPasswordVerifier,
            },
            { secureCookie: secure }
        );

        if (!result.ok) {
            return {
                error: {
                    code: result.error.code,
                    message: result.error.message,
                },
            };
        }

        const cookieStore = await cookies();
        cookieStore.set(applyAuthCookie(result.cookie));
        cookieStore.set(
            createAuthHintCookie({
                maxAgeSeconds: DEFAULT_SESSION_TTL_SECONDS,
                secure,
            })
        );
        // 리다이렉트 싱크 바로 앞에서 URL 파서로 같은-오리진 경로만 남긴다.
        // 문자열 검사(sanitizeNextPath)가 놓칠 수 있는 절대/프로토콜-상대 URL을
        // 파서가 호스트째로 떼어낸다.
        redirect(toSameOriginPath(next));
    } catch (err) {
        if (err instanceof Error && err.message.startsWith('NEXT_REDIRECT'))
            throw err;
        console.error('[loginAction] unexpected error:', err);
        return {
            error: {
                code: 'unexpected',
                message:
                    '로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
            },
        };
    }
}

'use server';

import { getTranslations } from 'next-intl/server';

import { localeHref } from '@/shared/i18n/localeRedirect';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
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
import { sanitizeNextPath } from '@/shared/lib/auth/redirect';
import { normalizeEmail } from '@/shared/lib/auth/validation';

export async function loginAction(
    _prev: LoginFormState,
    formData: FormData
): Promise<LoginFormState> {
    // 상태의 `message`가 그대로 화면에 뿌려지므로 요청 로케일로 만든다.
    const tAuth = await getTranslations('entities.auth.error');
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
        // 문자열 검사(sanitizeNextPath)가 놓칠 수 있는 절대/프로토콜-상대 URL을 파서가
        // 호스트째로 떼어낸다. base 호스트는 결과에 쓰이지 않는 더미다.
        const target = new URL(next, 'https://siglens.invalid');
        // `localeHref`는 멱등이다 — `next`에 이미 접두사가 있으면 그대로,
        // 없으면(기본값 `/`) 현재 로케일을 붙인다. `localeRedirect`가 아니라
        // 동기 `redirect`를 쓰는 이유는 아래 catch가 NEXT_REDIRECT를 재throw해야
        // 하고, TypeScript가 `never` 반환으로 이후 코드를 도달 불가로 좁혀야 하기
        // 때문이다(localeRedirect.ts JSDoc 참고).
        redirect(
            await localeHref(`${target.pathname}${target.search}${target.hash}`)
        );
    } catch (err) {
        if (err instanceof Error && err.message.startsWith('NEXT_REDIRECT'))
            throw err;
        console.error('[loginAction] unexpected error:', err);
        return {
            error: {
                code: 'unexpected',
                message: tAuth('loginFailed'),
            },
        };
    }
}

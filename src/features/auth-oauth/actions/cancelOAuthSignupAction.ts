'use server';

import { localeRedirect } from '@/shared/i18n/localeRedirect';
import { createPendingOAuthSignupStoreFromEnv } from '@/entities/oauth-account';
import {
    authNextQuery,
    DEFAULT_REDIRECT_PATH,
    sanitizeNextPath,
} from '@/shared/lib/auth/redirect';

/**
 * 대기 중인 OAuth 가입을 지우고, 로그인 화면에 되실을 `?next=` 쿼리를 돌려준다.
 *
 * 지우기 전에 돌아갈 곳을 읽는다 — 로그인 화면으로 되실어 줘야 ai.siglens.io에서
 * 온 사용자(SSO 핸드오프 `next`)가 다른 방법으로 로그인한 뒤에도 ai로 돌아간다.
 * 전부 best-effort다: Redis가 없거나 실패하면 토큰은 TTL로 사라지고 쿼리는 빈다.
 */
async function discardPendingSignup(token: string): Promise<string> {
    if (!token) return '';
    try {
        const store = createPendingOAuthSignupStoreFromEnv();
        if (store === null) return '';
        // 돌아갈 곳을 못 읽어도 삭제는 시도한다.
        const next = await store.peek(token).then(
            pending => sanitizeNextPath(pending?.next),
            () => DEFAULT_REDIRECT_PATH
        );
        await store.delete(token).catch(() => {
            // Best-effort cleanup: if Redis is unavailable, the token will TTL-expire on its own.
        });
        return next === DEFAULT_REDIRECT_PATH ? '' : authNextQuery(next);
    } catch {
        return '';
    }
}

export async function cancelOAuthSignupAction(
    formData: FormData
): Promise<void> {
    const query = await discardPendingSignup(
        String(formData.get('token') ?? '').trim()
    );
    return localeRedirect(`/login${query}`);
}

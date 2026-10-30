'use server';

import { localeRedirect } from '@/shared/i18n/localeRedirect';
import { createPendingOAuthSignupStoreFromEnv } from '@/entities/oauth-account/lib/pendingOAuthSignupStore';
import {
    authNextQuery,
    DEFAULT_REDIRECT_PATH,
    sanitizeNextPath,
} from '@/shared/lib/auth/redirect';

const LOG_PREFIX = '[cancelOAuthSignupAction]';

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
            (error: unknown) => {
                console.warn(`${LOG_PREFIX} peek failed:`, error);
                return DEFAULT_REDIRECT_PATH;
            }
        );
        // Best-effort cleanup: if Redis is unavailable, the token will TTL-expire on its own.
        await store.delete(token).catch((error: unknown) => {
            console.warn(`${LOG_PREFIX} delete failed:`, error);
        });
        return next === DEFAULT_REDIRECT_PATH ? '' : authNextQuery(next);
    } catch (error) {
        console.warn(`${LOG_PREFIX} discard failed:`, error);
        return '';
    }
}

/**
 * OAuth 가입 동의 화면의 "취소" 폼 액션. 회원 인증이 필요 없다 — 추측 불가능한
 * 일회성 토큰을 가진 사람만 그 대기 가입을 지울 수 있고, 결과는 항상 로그인
 * 화면으로의 리다이렉트다.
 */
export async function cancelOAuthSignupAction(
    formData: FormData
): Promise<void> {
    const query = await discardPendingSignup(
        String(formData.get('token') ?? '').trim()
    );
    return localeRedirect(`/login${query}`);
}

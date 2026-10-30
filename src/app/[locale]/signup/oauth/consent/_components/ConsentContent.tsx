import { OAUTH_ERROR_REDIRECT } from '@/entities/auth/lib/errorMessages';
import { createPendingOAuthSignupStoreFromEnv } from '@/entities/oauth-account/lib/pendingOAuthSignupStore';
import { OAuthConsentForm } from '@/features/auth-oauth-consent/ui/OAuthConsentForm';
import { cancelOAuthSignupAction } from '@/features/auth-oauth/actions/cancelOAuthSignupAction';
import { localeRedirect } from '@/shared/i18n/localeRedirect';
import { readConsentToken } from '../_lib/readConsentToken';

interface ConsentContentProps {
    readonly searchParams: Promise<{ token?: string | string[] }>;
}

/**
 * 동의 페이지의 쿼리 의존 본문 — 대기 중 OAuth 가입 프로필을 `?token=`으로 조회해 동의 폼을 그린다.
 * 토큰 판정을 스토어 조회보다 먼저 해, 잘못된 토큰(없음·빈 값·반복된 키)은 Redis를 읽지 않고
 * `consentInvalid`로 보낸다. 스토어를 만들 수 없거나 프로필이 만료됐으면 각자의 오류 코드로 로그인
 * 화면에 보낸다. 조회는 `peek`라 토큰을 소비하지 않는다(소비는 동의 제출 액션이 한다).
 */
export async function ConsentContent({ searchParams }: ConsentContentProps) {
    const token = readConsentToken((await searchParams).token);
    if (token === null) {
        return localeRedirect(OAUTH_ERROR_REDIRECT.consentInvalid);
    }

    const store = createPendingOAuthSignupStoreFromEnv();
    if (!store) {
        return localeRedirect(OAUTH_ERROR_REDIRECT.serviceUnavailable);
    }

    const profile = await store.peek(token);
    if (!profile) {
        return localeRedirect(OAUTH_ERROR_REDIRECT.consentExpired);
    }

    return (
        <OAuthConsentForm
            token={token}
            provider={profile.provider}
            email={profile.email}
            name={profile.name}
            avatarUrl={profile.avatarUrl}
            cancelAction={cancelOAuthSignupAction}
        />
    );
}

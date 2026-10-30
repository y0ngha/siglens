import {
    buildOAuthRedirectUri,
    getOAuthAdapter,
} from '@/features/auth-oauth/lib/providers';
import type { OAuthProfileResult } from '@/features/auth-oauth/lib/types';
import type { SupportedOAuthProvider } from '@/shared/lib/types';

/**
 * 인가 코드를 프로필로 바꾼다. 어댑터는 provider 응답이 나쁠 때만 실패 결과를 돌려주고
 * 네트워크 오류(DNS·연결 끊김)는 던지므로, 여기서 `token_exchange_failed`로 접어 콜백이
 * 500 대신 로그인 화면의 오류 코드로 이어지게 한다.
 *
 * 던져진 오류 자체는 로그에 싣지 않는다 — 요청 URL·본문(인가 코드, 클라이언트 시크릿)이 오류
 * 메시지에 섞일 수 있어 provider와 오류 이름만 남긴다.
 */
export async function exchangeProfile(
    provider: SupportedOAuthProvider,
    code: string
): Promise<OAuthProfileResult> {
    try {
        return await getOAuthAdapter(provider).exchangeCodeForProfile({
            code,
            redirectUri: buildOAuthRedirectUri(provider),
        });
    } catch (error) {
        console.error('[oauth-callback] code exchange threw', {
            provider,
            name: error instanceof Error ? error.name : typeof error,
        });
        return { ok: false, reason: 'token_exchange_failed' };
    }
}

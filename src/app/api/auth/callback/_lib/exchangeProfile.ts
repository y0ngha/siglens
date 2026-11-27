import {
    buildOAuthRedirectUri,
    getOAuthAdapter,
} from '@/features/auth-oauth/lib/providers';
import type { OAuthProfileResult } from '@/features/auth-oauth/lib/types';
import { normalizeEmail } from '@/shared/lib/auth/validation';
import type { SupportedOAuthProvider } from '@/shared/lib/types';

/**
 * 인가 코드를 프로필로 바꾼다. 어댑터는 provider 응답이 나쁠 때만 실패 결과를 돌려주고
 * 네트워크 오류(DNS·연결 끊김)는 던지므로, 여기서 `token_exchange_failed`로 접어 콜백이
 * 500 대신 로그인 화면의 오류 코드로 이어지게 한다.
 *
 * 성공한 프로필의 이메일은 여기서 한 번 `normalizeEmail`(소문자·trim)을 거친다. 이메일 가입
 * 경로가 같은 함수로 저장하므로, provider가 `Foo@Gmail.com`처럼 대소문자가 섞인 주소를 줘도
 * 대소문자를 구분하는 `users.email` 유니크 검사를 우회해 같은 사람의 두 번째 계정이 생기지
 * 않는다. 충돌 조회·pending 저장소·충돌 리다이렉트가 모두 이 값을 받는다.
 *
 * 던져진 오류 자체는 로그에 싣지 않는다 — 요청 URL·본문(인가 코드, 클라이언트 시크릿)이 오류
 * 메시지에 섞일 수 있어 provider와 오류 이름만 남긴다.
 */
export async function exchangeProfile(
    provider: SupportedOAuthProvider,
    code: string
): Promise<OAuthProfileResult> {
    try {
        const result = await getOAuthAdapter(provider).exchangeCodeForProfile({
            code,
            redirectUri: buildOAuthRedirectUri(provider),
        });
        if (!result.ok) return result;
        return {
            ...result,
            profile: {
                ...result.profile,
                email: normalizeEmail(result.profile.email),
            },
        };
    } catch (error) {
        console.error('[oauth-callback] code exchange threw', {
            provider,
            name: error instanceof Error ? error.name : typeof error,
        });
        return { ok: false, reason: 'token_exchange_failed' };
    }
}

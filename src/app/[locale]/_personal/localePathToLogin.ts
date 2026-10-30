import { localePath, type Locale } from '@/shared/i18n/locales';
import { authNextQuery } from '@/shared/lib/auth/redirect';

/**
 * 회원 전용 페이지(`/account`·`/account/delete`·`/email-report`)의 페이지 가드가 비회원을 보낼
 * 로그인 주소. 로그인 페이지와 돌아올 경로 둘 다 요청 로케일을 유지한다 — 영어 사용자가 한국어
 * 로그인 화면으로 떨어지거나, 로그인 뒤 한국어 페이지로 돌아오면 안 된다. 프록시 전방 가드
 * (`AUTH_REQUIRED_PATHS`)도 `next`에 로케일 경로를 싣는다.
 */
export function localePathToLogin(locale: Locale, path: string): string {
    return `${localePath(locale, '/login')}${authNextQuery(
        localePath(locale, path)
    )}`;
}

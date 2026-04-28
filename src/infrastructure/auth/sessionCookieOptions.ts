/**
 * 인증 쿠키의 secureCookie 플래그를 NODE_ENV 기반으로 결정한다.
 * 운영 환경(production)에서는 true, 그 외 환경에서는 false.
 * (next dev는 http로 동작하므로 secure 쿠키가 전송되지 않는다.)
 */
export function isSecureCookieEnv(): boolean {
    return process.env.NODE_ENV === 'production';
}

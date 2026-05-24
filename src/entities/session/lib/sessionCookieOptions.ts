/** secureCookie 플래그를 NODE_ENV 기반으로 결정 — production은 true, 그 외 false (next dev는 http). */
export function isSecureCookieEnv(): boolean {
    return process.env.NODE_ENV === 'production';
}

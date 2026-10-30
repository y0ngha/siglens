/** 쿠키 `Secure` 플래그를 NODE_ENV로 정한다 — production은 true, 그 외는 false(next dev는 http). 세션·힌트·핸드오프 쿠키가 공유한다. */
export function isSecureCookieEnv(): boolean {
    return process.env.NODE_ENV === 'production';
}

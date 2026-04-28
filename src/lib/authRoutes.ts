export const AUTH_PATHS = {
    login: '/login',
    signup: '/signup',
} as const;

export const DEFAULT_REDIRECT_PATH = '/';

/**
 * Open-redirect를 막기 위해 next 쿼리 값을 검증한다.
 * 같은 origin의 path-only 만 허용하고, 그 외엔 '/'를 반환한다.
 */
export function sanitizeNextPath(input: string | null | undefined): string {
    if (!input) return DEFAULT_REDIRECT_PATH;
    if (!input.startsWith('/')) return DEFAULT_REDIRECT_PATH;
    if (input.startsWith('//') || input.startsWith('/\\'))
        return DEFAULT_REDIRECT_PATH;
    return input;
}

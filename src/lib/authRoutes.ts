export const AUTH_PATHS = {
    login: '/login',
    signup: '/signup',
} as const;

export const DEFAULT_REDIRECT_PATH = '/';

// Open-redirect 방어: 같은 origin의 path-only만 허용, 그 외 '/' 반환
export function sanitizeNextPath(input: string | null | undefined): string {
    if (!input) return DEFAULT_REDIRECT_PATH;
    if (!input.startsWith('/')) return DEFAULT_REDIRECT_PATH;
    if (input.startsWith('//') || input.startsWith('/\\'))
        return DEFAULT_REDIRECT_PATH;
    return input;
}

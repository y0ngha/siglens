export const DEFAULT_REDIRECT_PATH = '/';

const PATH_PREFIX = '/';
const PROTOCOL_RELATIVE_PREFIX = '//';
const BACKSLASH_HOST_PREFIX = '/\\';

// Open-redirect 방어: 같은 origin의 path-only만 허용, 그 외 '/' 반환
export function sanitizeNextPath(input: string | null | undefined): string {
    if (!input) return DEFAULT_REDIRECT_PATH;
    if (!input.startsWith(PATH_PREFIX)) return DEFAULT_REDIRECT_PATH;
    if (
        input.startsWith(PROTOCOL_RELATIVE_PREFIX) ||
        input.startsWith(BACKSLASH_HOST_PREFIX)
    )
        return DEFAULT_REDIRECT_PATH;
    return input;
}

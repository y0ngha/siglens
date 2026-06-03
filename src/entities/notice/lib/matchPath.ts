/**
 * 공지의 path_pattern을 현재 pathname과 매칭한다. 지원 규칙은 3종:
 *  1. null 또는 '/*' → 전역(모든 경로)
 *  2. '/prefix/*'    → 접두 일치 ('/prefix' 자신과 '/prefix/...' 하위)
 *  3. 그 외          → 정확 일치
 * 양쪽 경로의 trailing slash는 비교 전 제거한다(길이 > 1인 경우만).
 * 정규식은 의도적으로 지원하지 않는다(설계 §2).
 */
export function matchPath(pattern: string | null, pathname: string): boolean {
    if (pattern === null || pattern === '/*') return true;

    const normalize = (p: string): string =>
        p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p;
    const normalizedPathname = normalize(pathname);
    const normalizedPattern = normalize(pattern);

    if (normalizedPattern.endsWith('/*')) {
        const prefix = normalizedPattern.slice(0, -2); // '/symbol/*' → '/symbol'
        return (
            normalizedPathname === prefix ||
            normalizedPathname.startsWith(`${prefix}/`)
        );
    }

    return normalizedPathname === normalizedPattern;
}

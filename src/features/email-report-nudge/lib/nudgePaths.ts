/**
 * 넛지를 띄우지 않는 경로 — 설정·인증·수신거부 화면 자체에서는 권할 게 없거나 방해만 된다.
 * 로케일 접두사를 뗀 경로(`useAppPathname`) 기준이다.
 */
export const NUDGE_EXCLUDED_PATH_PREFIXES = [
    '/account',
    '/login',
    '/signup',
    '/forgot-password',
    '/reset-password',
    '/email-report',
] as const;

/**
 * 메일 리포트 넛지를 띄우지 않는 경로인지. 앞부분을 세그먼트 단위로 맞춘다 — 하위 경로
 * (`/account/delete`)는 포함하고, 이름만 겹치는 경로(`/accounting`)는 제외하지 않는다.
 */
export function isNudgeExcludedPath(pathname: string): boolean {
    return NUDGE_EXCLUDED_PATH_PREFIXES.some(
        prefix => pathname === prefix || pathname.startsWith(`${prefix}/`)
    );
}

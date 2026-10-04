/**
 * 프록시(`src/proxy.ts`)의 인증 가드가 보는 경로 목록.
 *
 * 프록시(edge runtime)와 클라이언트(`NavigationPendingContext`)가 함께 쓰므로 외부
 * 의존이 0인 상수 파일에 둔다. 클라이언트는 이 목록으로 **가드가 보낼 도착지를
 * 미리 맞춘다** — 목록이 프록시와 갈리면 클릭 직후 엉뚱한 골격이 뜨거나, 같은
 * 경로로 되돌아오는 이동에서 골격이 풀리지 않는다.
 */

/** 로그인된 사용자가 들어오면 다른 곳으로 보내는 경로(정확 일치). */
export const GUEST_ONLY_PATHS: ReadonlySet<string> = new Set([
    '/login',
    '/signup',
    '/forgot-password',
    '/reset-password',
]);

/** 비로그인 사용자가 들어오면 `/login`으로 보내는 경로(접두 일치). */
export const AUTH_REQUIRED_PATHS: readonly string[] = [
    '/account',
    '/portfolio',
];

const LOGIN_PATH = '/login';
const HOME_PATH = '/';

/**
 * 앱 경로(로케일 접두사·쿼리 없음)로 이동했을 때 프록시 가드를 거쳐 **실제로 도착할**
 * 앱 경로를 예측한다.
 *
 * `hasAuthHint`는 힌트 쿠키(`siglens_auth`)라 진짜 세션과 어긋날 수 있다(세션이
 * 죽었는데 힌트만 남은 경우 등). 그래서 결과는 **추정**이다 — 골격을 고르는 데만
 * 쓰고, 어긋나도 도착하면 실제 페이지가 그려진다. 게스트 전용 경로의 `next` 파라미터는
 * 보지 않는다(대부분 홈으로 간다).
 */
export function predictGuardedLanding(
    appPath: string,
    hasAuthHint: boolean
): string {
    if (hasAuthHint) {
        return GUEST_ONLY_PATHS.has(appPath) ? HOME_PATH : appPath;
    }
    return AUTH_REQUIRED_PATHS.some(prefix => appPath.startsWith(prefix))
        ? LOGIN_PATH
        : appPath;
}

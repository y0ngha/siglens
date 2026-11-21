import { AI_SITE_URL, MAIN_SITE_URL } from '@/shared/config/aiHost';
import { MAIN_SESSION_HINT_COOKIE_NAME } from '@/shared/config/cookieNames';
import { DEFAULT_SESSION_TTL_SECONDS } from './sessionCookie';

/**
 * 메인 호스트 로그인 흔적 쿠키의 `cookies().set()` 인자. 식별자도 비밀도 담지 않는다 —
 * 값은 `1` 또는 만료용 빈 문자열이다.
 */
export interface MainSessionHintCookieDescriptor {
    readonly name: typeof MAIN_SESSION_HINT_COOKIE_NAME;
    readonly value: '1' | '';
    readonly maxAge: number;
    readonly path: '/';
    readonly domain: string;
    readonly sameSite: 'lax';
    readonly secure: boolean;
    readonly httpOnly: true;
}

const IPV4_LITERAL = /^\d{1,3}(?:\.\d{1,3}){3}$/;

/**
 * 두 호스트가 공유하는 부모 도메인. 메인이 점이 있는 등록 도메인이고 ai 호스트가 그 하위
 * 도메인일 때만 돌려준다(운영 `siglens.io` / `ai.siglens.io`). `localhost`·IP·무관한 호스트는
 * null — 브라우저가 `Domain=localhost`를 `ai.localhost`와 믿을 만하게 공유하지 않는다.
 */
export function resolveMainSessionHintDomain(
    mainSiteUrl: string,
    aiSiteUrl: string
): string | null {
    try {
        const main = new URL(mainSiteUrl).hostname.toLowerCase();
        const ai = new URL(aiSiteUrl).hostname.toLowerCase();
        if (!main.includes('.')) return null;
        if (main.startsWith('[') || IPV4_LITERAL.test(main)) return null;
        return ai.endsWith(`.${main}`) ? main : null;
    } catch {
        return null;
    }
}

/** 호출 시점에 읽는다(모듈 로드 시점이 아니라) — 테스트가 URL 상수를 목으로 바꿔도 따라간다. */
export function mainSessionHintDomain(): string | null {
    return resolveMainSessionHintDomain(MAIN_SITE_URL, AI_SITE_URL);
}

function build(
    domain: string,
    value: '1' | '',
    maxAge: number,
    secure: boolean
): MainSessionHintCookieDescriptor {
    return {
        name: MAIN_SESSION_HINT_COOKIE_NAME,
        value,
        maxAge,
        path: '/',
        domain,
        sameSite: 'lax',
        secure,
        httpOnly: true,
    };
}

/** 메인 호스트가 세션을 만들 때 심는다. 게이트가 꺼진 환경(로컬)이면 null. 수명은 세션 쿠키와 같다. */
export function createMainSessionHintCookie(params: {
    secure: boolean;
}): MainSessionHintCookieDescriptor | null {
    const domain = mainSessionHintDomain();
    return domain === null
        ? null
        : build(domain, '1', DEFAULT_SESSION_TTL_SECONDS, params.secure);
}

/** 지우는 쿠키. 도메인·경로가 심을 때와 같아야 브라우저가 지운다. 게이트가 꺼진 환경이면 null. */
export function createExpiredMainSessionHintCookie(params: {
    secure: boolean;
}): MainSessionHintCookieDescriptor | null {
    const domain = mainSessionHintDomain();
    return domain === null ? null : build(domain, '', 0, params.secure);
}

/**
 * ai 페이지가 SSO 핸드오프를 시작할지. 게이트가 꺼진 환경에서는 항상 true(기존 동작:
 * 언제나 프로브). 켜진 환경에서는 흔적이 `1`일 때만 true. 인증 판단이 아니다 —
 * 핸드오프가 진짜 세션을 다시 검증한다.
 */
export function shouldStartHandoff(hintValue: string | undefined): boolean {
    return mainSessionHintDomain() === null || hintValue === '1';
}

/** `cookies()`(Server Action)와 `NextResponse.cookies`(라우트 핸들러)가 함께 만족하는 쓰기 면. */
interface MainSessionHintCookieWriter {
    set(cookie: MainSessionHintCookieDescriptor): unknown;
}

/**
 * 흔적 쿠키를 심는다. 게이트가 꺼진 환경(로컬 호스트)에서는 아무것도 하지 않는다.
 *
 * 세션을 만드는 호출부(`loginAction`, `registerAction`, `finalizeOAuthSignupAction`, OAuth 콜백)는
 * 메인 호스트에서만 실행된다: 로그인·가입 폼 페이지(`app/[locale]/login`, `signup`)는 메인에만 있고
 * ai 호스트의 프록시는 모든 경로를 `app/ai/[locale]/*`로 rewrite하는데 그 아래에 이 폼이 없다.
 * ai 호스트의 로그인 CTA는 메인 `/login`으로 보낸다. 그래서 여기서 호스트를 따로 가르지 않는다
 * (ai 호스트 세션을 만드는 `handoff/consume`은 일부러 이 함수를 부르지 않는다).
 */
export function setMainSessionHint(
    store: MainSessionHintCookieWriter,
    params: { secure: boolean }
): void {
    const cookie = createMainSessionHintCookie(params);
    if (cookie) store.set(cookie);
}

/** 흔적 쿠키를 지운다. 게이트가 꺼진 환경에서는 아무것도 하지 않는다. */
export function clearMainSessionHint(
    store: MainSessionHintCookieWriter,
    params: { secure: boolean }
): void {
    const cookie = createExpiredMainSessionHintCookie(params);
    if (cookie) store.set(cookie);
}

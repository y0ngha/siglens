import 'server-only';
import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import {
    DEFAULT_LOCALE,
    isLocale,
    localePath,
    splitLocalePath,
} from './locales';

/**
 * 서버(Server Action / Route Handler / 페이지)에서 쓸 **로케일 접두사가 붙은 경로**를 만든다.
 *
 * `redirect('/')`처럼 접두사 없는 경로로 보내면 프록시가 그것을 기본 로케일로
 * 해석한다 — 로그아웃·회원탈퇴·OAuth 오류·비밀번호 재설정·API 키 저장 중
 * 세션 만료 등 **모든 Server Action이 비-ko 사용자를 한국어 페이지에 버린다.**
 * 클라이언트의 `LocaleLink`/`useLocalePath`가 막는 것과 같은 결함이며, 훅을
 * 쓸 수 없는 서버 경로용 대응이다.
 *
 * 로케일은 `getLocale()`로 얻는다. Server Action에는 라우트 세그먼트가 없지만,
 * next-intl 미들웨어가 요청 헤더에 `X-NEXT-INTL-LOCALE`을 심고 `getLocale()`이
 * 그 헤더로 폴백한다(Server Action은 항상 dynamic이라 `headers()` 사용에 제약이 없다).
 *
 * **멱등하다** — 이미 접두사가 붙은 경로를 넘겨도 두 번 붙지 않는다
 * (`splitLocalePath`로 먼저 벗긴 뒤 다시 붙인다). `next` 쿼리 파라미터도 같은
 * 규칙으로 다시 붙인다 — 그러지 않으면 로그인 후 돌아갈 곳만 ko로 떨어진다.
 *
 * @param path `/`로 시작하는 경로. 쿼리스트링·해시를 포함할 수 있다.
 * @returns 로케일 접두사가 붙은 경로.
 */
export async function localeHref(path: string): Promise<string> {
    const raw = await getLocale();
    const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;

    const hashIndex = path.indexOf('#');
    const hash = hashIndex === -1 ? '' : path.slice(hashIndex);
    const withoutHash = hashIndex === -1 ? path : path.slice(0, hashIndex);

    const queryIndex = withoutHash.indexOf('?');
    const rawPathname =
        queryIndex === -1 ? withoutHash : withoutHash.slice(0, queryIndex);
    const search = queryIndex === -1 ? '' : withoutHash.slice(queryIndex + 1);

    const pathname = localePath(locale, splitLocalePath(rawPathname).path);

    let query = '';
    if (search) {
        const params = new URLSearchParams(search);
        const next = params.get('next');
        if (next?.startsWith('/')) {
            params.set('next', localePath(locale, splitLocalePath(next).path));
        }
        query = `?${params.toString()}`;
    }

    return `${pathname}${query}${hash}`;
}

/**
 * `localeHref`로 경로를 로케일화한 뒤 리다이렉트한다.
 *
 * ⚠️ **`try/catch`로 `NEXT_REDIRECT`를 재throw하는 코드 안에서는 쓰지 말 것.**
 * `return localeRedirect(...)`는 promise를 adopt해 로컬 `catch`를 건너뛰고,
 * `await localeRedirect(...)`는 TypeScript가 이후 코드를 도달 불가로 좁히지
 * 못해 "함수에 return이 없다"가 된다. 그런 자리에서는
 * `redirect(await localeHref(path))`를 직접 쓴다 — `redirect`가 동기 `never`라
 * 두 문제가 함께 사라진다.
 */
export async function localeRedirect(path: string): Promise<never> {
    redirect(await localeHref(path));
}

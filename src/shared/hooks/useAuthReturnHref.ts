'use client';

import { usePathname } from 'next/navigation';
import { GUEST_ONLY_PATHS } from '@/shared/config/authGuardPaths';
import { splitLocalePath } from '@/shared/i18n/locales';
import {
    authNextQuery,
    DEFAULT_REDIRECT_PATH,
    sanitizeNextPath,
} from '@/shared/lib/auth/redirect';
import { useHydrated } from './useHydrated';

/** 돌아올 곳을 실어 보낼 수 있는 인증 화면. */
export type AuthEntryPath = '/signup' | '/login';

/** `'/signup/oauth/consent'.split('/')` → `['', 'signup', 'oauth', 'consent']` — 0번은 선행 `/` 앞의 빈 칸이다. */
const FIRST_SEGMENT_INDEX = 1;

/**
 * 돌아갈 곳인가. 홈과 게스트 전용 인증 화면(`GUEST_ONLY_PATHS` — 프록시 가드와 같은 목록)
 * 아래는 아니다. 인증 화면에서 가입 유도가 뜨면(전역 모달) `next`가 인증 화면 자신을 가리켜,
 * 가입을 마친 사람이 다시 로그인 화면에 떨어진다. 하위 경로(`/signup/oauth/consent`)도 같은
 * 화면으로 치려고 첫 구간으로 비교한다.
 */
function isReturnTarget(localeFreePath: string): boolean {
    if (localeFreePath === DEFAULT_REDIRECT_PATH) return false;
    const firstSegment = localeFreePath.split('/')[FIRST_SEGMENT_INDEX] ?? '';
    return !GUEST_ONLY_PATHS.has(`/${firstSegment}`);
}

/**
 * 지금 보는 페이지로 돌아오는 가입·로그인 링크(`/signup?next=/AAPL`).
 *
 * 분석 화면의 가입 유도(잠금 카드, 넛지 모달)가 `/signup`만 가리키면 가입을 마친 사람이
 * 보던 종목이 아니라 빈 보유종목 화면에 떨어진다 — 가입한 이유(잠긴 내용)를 바로 확인하지
 * 못한다. `next`를 실으면 가입·로그인 폼과 소셜 로그인이 그 경로로 돌려보낸다.
 *
 * 쿼리스트링·해시도 싣는다(탭·필터 같은 URL 상태). `useSearchParams`를 쓰지 않는 이유:
 * 정적 페이지에서 그 훅은 가장 가까운 Suspense까지 CSR로 떨어뜨린다. 대신 하이드레이션 뒤
 * `window.location`을 읽는다 — 경로가 바뀌면 다시 렌더되므로 값이 따라오고, 경로는 그대로인
 * 채 쿼리만 바뀐 직후에는 다음 렌더까지 이전 쿼리가 남을 수 있다.
 *
 * 하이드레이션 전에는 `next` 없는 경로를 돌려준다. 서버가 그린 HTML에 `?next=`가 박히면
 * 종목 페이지 수만큼 서로 다른 가입 URL이 생겨 크롤러가 그것을 따로 수집한다. 홈(로케일 홈
 * 포함)과 인증 화면은 돌아갈 곳으로 치지 않는다 — 가입 직후 기본 목적지 정책
 * (`resolvePostSignupDestination`)이 그대로 적용되게 한다.
 */
export function useAuthReturnHref(path: AuthEntryPath): string {
    const pathname = usePathname();
    const isHydrated = useHydrated();
    if (!isHydrated || pathname === null) return path;
    // 판정은 쿼리 없는 경로로 한다 — `/?x=1`이 홈이 아닌 것으로, `/en?x=1`의 첫 구간이
    // 로케일이 아닌 것으로 읽히지 않게.
    if (!isReturnTarget(splitLocalePath(sanitizeNextPath(pathname)).path)) {
        return path;
    }
    const { search, hash } = window.location;
    const next = sanitizeNextPath(`${pathname}${search}${hash}`);
    return next === DEFAULT_REDIRECT_PATH
        ? path
        : `${path}${authNextQuery(next)}`;
}

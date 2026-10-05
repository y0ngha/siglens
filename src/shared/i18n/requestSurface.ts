import { isAiHost } from '@/shared/config/aiHost';
import { resolveLocale, type Locale } from '@/shared/i18n/locales';

/**
 * next-intl 미들웨어(`proxy.ts`가 호스트마다 직접 심는 값 포함)가 요청 헤더에 싣는
 * 현재 로케일. `getLocale()`이 읽는 바로 그 헤더다.
 */
export const REQUEST_LOCALE_HEADER = 'x-next-intl-locale';

export interface RequestSurface {
    readonly locale: Locale;
    /** `ai.siglens.io`(SiglensAI) 호스트의 요청인가. 아니면 메인 사이트다. */
    readonly onAiHost: boolean;
}

interface HeaderReader {
    get(name: string): string | null;
}

/**
 * 요청 헤더에서 **로케일과 호스트**를 판정한다 — 루트 `not-found.tsx`용이다.
 *
 * 매칭되는 라우트가 없는 URL(`/foo/bar`, `/en/foo/bar`)의 404는 `[locale]`
 * 세그먼트가 해석되지 않은 자리라 `params`가 없다. 그래서 로케일은 미들웨어가
 * 남긴 헤더에서, 호스트는 `host`에서 읽는다.
 *
 * 헤더가 없거나 지원하지 않는 값이면 던지지 않고 **한국어 · 메인 호스트**로 떨어진다 —
 * 광고 랜딩(`/lp/*`)처럼 intl 미들웨어를 거치지 않는 경로도 같은 404로 끝나고,
 * 404 렌더가 던지면 사용자는 빈 오류 셸을 본다.
 */
export function resolveRequestSurface(headers: HeaderReader): RequestSurface {
    return {
        locale: resolveLocale(headers.get(REQUEST_LOCALE_HEADER) ?? ''),
        onAiHost: isAiHost(headers.get('host')),
    };
}

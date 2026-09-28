import {
    ANALYSIS_LOCALE_HEADER,
    resolveLocale,
    type Locale,
} from '@/shared/i18n/locales';

/**
 * `/api/*` 요청이 실은 로케일. 없거나 알 수 없는 값이면 기본 로케일.
 *
 * `/api/*`는 next-intl 미들웨어 matcher에서 제외돼 있어 요청 로케일을 알 방법이
 * 헤더뿐이다(클라이언트가 주소에서 유도해 `ANALYSIS_LOCALE_HEADER`에 싣는다).
 * 신뢰 경계이므로 반드시 검증한다 — 임의 문자열이 캐시 키에 들어가면 번역 캐시가
 * 무한히 파편화된다.
 */
export function localeFromRequestHeader(request: Request): Locale {
    return resolveLocale(request.headers.get(ANALYSIS_LOCALE_HEADER) ?? '');
}

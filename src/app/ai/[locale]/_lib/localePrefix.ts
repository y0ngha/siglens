import { localePath, type Locale } from '@/shared/i18n/locales';

/**
 * `locale`의 URL 접두(`ko` → `''`, `en` → `/en`). 채팅 셸·소개 페이지가 내부 링크와
 * `currentPath`를 이 접두 위에 직접 조립하므로 끝 슬래시가 없어야 한다.
 */
export function localePrefixOf(locale: Locale): string {
    return localePath(locale, '').replace(/\/$/, '');
}

import { localePath, type Locale } from '@/shared/i18n/locales';

/**
 * 핸드오프 왕복에서 살려 보낼 쿼리. `q`는 siglens.io의 질문 진입 링크, 나머지는
 * 광고 클릭 식별자와 캠페인 태그다 — 버리면 광고에서 온 방문의 전환이 광고와
 * 연결되지 않는다. 목록 밖 파라미터는 버린다.
 */
const CARRIED_PARAMS = [
    'q',
    'gclid',
    'gbraid',
    'wbraid',
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_term',
    'utm_content',
] as const;

/**
 * 핸드오프 후 돌아올 로케일 포함 경로(`next`) — `maybeHandoffRedirect`의 순수 부분.
 *
 * `CARRIED_PARAMS`만 인코딩해 실어 `?q=`와 광고 클릭 식별자를 지킨다.
 */
export function buildHandoffNext(
    locale: Locale,
    path: string,
    searchParams: Record<string, string | string[] | undefined>
): string {
    const query = CARRIED_PARAMS.flatMap(key => {
        const value = searchParams[key];
        return typeof value === 'string' && value
            ? [`${key}=${encodeURIComponent(value)}`]
            : [];
    }).join('&');
    return `${localePath(locale, path)}${query ? `?${query}` : ''}`;
}

import { MS_PER_HOUR } from '@/shared/config/time';

/**
 * `date`를 UTC 정시(분·초·밀리초 0)로 내림한다.
 *
 * sitemap 빌더 몇 곳(`/news`, `/market`)은 "최근 1시간 내 갱신"을 나타내려고
 * `now - 1h`을 그대로 lastmod로 썼다. 이 라우트는 `force-dynamic`이라 요청마다
 * `now`가 달라지므로 lastmod도 매번 달라지고, `maxLastModified`가 항상 그 rolling
 * 값을 골라 sitemap index의 자식 lastmod가 끝없이 "방금 바뀜"으로 나가 — freshness
 * 신호 자체가 무력화된다. 시(hour) 단위로 양자화하면 같은 시간대 안의 반복 호출은
 * 값이 고정돼 안정적인 신호가 된다.
 */
export function floorToHour(date: Date): Date {
    return new Date(Math.floor(date.getTime() / MS_PER_HOUR) * MS_PER_HOUR);
}

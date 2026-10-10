import {
    ABOUT_PATH,
    METHODOLOGY_PATH,
    PRIVACY_PATH,
    TERMS_PATH,
} from '@/shared/lib/legal';
import { GUIDE_CATEGORIES } from '@/entities/guide/types';
import { GUIDE_PATH, guideCategoryPath } from '@/shared/lib/guidePaths';
import { BACKTESTING_PATH } from '@/shared/lib/seo';

/**
 * lastmod로만 변화를 알 수 있는 정적 페이지 — 본문이 상수·약관·정적 데이터라 프리웜이 건드리지
 * 않는다(바뀌는 시점은 sitemap의 `lastmod`가 유일하게 알려 준다).
 *
 * IndexNow 쪽 두 곳이 **이 목록 하나**를 쓴다: 지연표(`indexNowDelays`의 URL 분류)와
 * lastmod 변화 감시(`seo-prewarm/indexNowStaticPages`). 따로 적으면 한쪽에만 페이지가 추가돼
 * 변화는 감지되는데 분류가 `null`이라 제출되지 않는(또는 그 반대의) 조용한 누락이 생긴다.
 */
export const STATIC_PAGE_PATHS = [
    ABOUT_PATH,
    METHODOLOGY_PATH,
    PRIVACY_PATH,
    TERMS_PATH,
    BACKTESTING_PATH,
    // 차트 가이드 허브·카테고리. 항목(90개)은 DB에서 오므로 여기 담지 않는다 — sitemap으로 충분하다.
    GUIDE_PATH,
    ...GUIDE_CATEGORIES.map(guideCategoryPath),
] as const;

/**
 * 차트 가이드 항목 경로(`/guide/{category}/{slug}`)인가. 항목(90개)은 DB에서 와서
 * `STATIC_PAGE_PATHS`에 나열할 수 없으므로 모양으로 판정한다 — IndexNow 변화 감시와
 * 지연표 분류가 같은 판정을 쓴다.
 *
 * 인자는 **pathname**이다(쿼리·해시 없음). 지연표는 `new URL(url).pathname`을, 변화 감시는
 * sitemap `entry.url`(쿼리·해시 없이 조립된 정규 URL)에서 origin을 뗀 값을 넘긴다. 그래도
 * `?`·`#`가 섞여 오면 정규 항목 URL이 아니므로 항목으로 보지 않는다 — 같은 문서의 변형 URL이
 * 감시 해시에 별도 키로 쌓여 중복 제출되는 일을 막는다.
 */
export function isGuideEntryPath(path: string): boolean {
    if (path.includes('?') || path.includes('#')) return false;
    const segments = path.split('/').filter(segment => segment.length > 0);
    return (
        segments.length === 3 &&
        `/${segments[0]}` === GUIDE_PATH &&
        (GUIDE_CATEGORIES as readonly string[]).includes(segments[1])
    );
}

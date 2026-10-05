import {
    ABOUT_PATH,
    METHODOLOGY_PATH,
    PRIVACY_PATH,
    TERMS_PATH,
} from '@/shared/lib/legal';
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
] as const;

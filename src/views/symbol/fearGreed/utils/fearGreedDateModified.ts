import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';
import type { MarketProfileId } from '@/shared/config/marketProfile/types';
import { sessionCloseUtcOnDate } from '@/shared/lib/marketSessionDate';

/**
 * 공포·탐욕 탭 `WebPage.dateModified` — **마지막 점수 봉의 세션 마감 순간**.
 *
 * 이 탭의 본문은 일봉에서 결정적으로 계산되므로 내용이 바뀐 시점은 그 봉이 마감된 때다.
 * sitemap `lastmod`(`buildPopularEntries`의 `todayClose` = 직전 마감 세션의 마감 순간)와
 * 같은 정의다 — 마지막 점수 봉이 직전 마감 세션이면 두 값이 같다(동일성 테스트).
 * 빌드 시각·요청 시각을 쓰면 크롤된 날이 곧 수정일이 되는 거짓 신선도 신호다
 * (2026-09-17 정책 감사 M2).
 */
export function fearGreedDateModified(
    lastScoredDate: string,
    profile: MarketProfileId
): Date {
    return sessionCloseUtcOnDate(sessionSpecFor(profile), lastScoredDate);
}

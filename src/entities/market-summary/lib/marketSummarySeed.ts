import type { MarketSummaryData } from '@y0ngha/siglens-core';
import type { DashboardScopeId } from '@/shared/config/dashboardScope';
import type { MarketSummaryActionResult } from '@/shared/lib/types';

/**
 * 서버가 React Query에 심는 시장 요약 시드 — **클라이언트 액션 응답과 같은 모양**이어야 한다.
 *
 * `scope`를 빠뜨리면 미국 밖 시장에서 시드가 통째로 버려진다. `useMarketSummary`는
 * 롤링 배포 중 구 컨테이너의 미국 응답을 걸러내려고 "미국이 아니면 `scope`가 일치해야
 * 쓴다"고 검사하는데(`matchesScope`), 그 검사는 시드에도 똑같이 적용된다. 예전엔 시드가
 * `{ summary }`뿐이라 `/market/kr`의 서버 HTML에 지수·섹터 카드가 하나도 없었고, 하이드레이션
 * 뒤 클라이언트 fetch가 끝나서야 카드가 생기며 아래 콘텐츠를 밀어냈다
 * (2026-10-04 운영 실측: 모바일 CLS 0.332, 서버 HTML의 요약 패널 1,990B 대 미국 15,775B).
 */
export function marketSummarySeed(
    scope: DashboardScopeId,
    summary: MarketSummaryData
): Extract<MarketSummaryActionResult, { summary: unknown }> {
    return { summary, scope };
}

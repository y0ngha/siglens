/**
 * 시장 요약 패널 하단의 브리핑 영역 — 상태(미정·실패·결과)에 맞는 카드를 고른다.
 */
import type { RunBriefingResult } from '@y0ngha/siglens-core';
import type { ClientDashboardScope } from '@/shared/config/dashboardScope';
import { BriefingCard } from './BriefingCard';
import { BriefingErrorCard } from './ui/briefing/BriefingErrorCard';
import { BriefingLoadingCard } from './ui/briefing/BriefingLoadingCard';

interface BriefingRegionProps {
    /** `useMarketBriefing`의 입력 — `undefined`=미정, `'error'`=실패. */
    input: RunBriefingResult | 'error' | undefined;
    scope: ClientDashboardScope;
}

/**
 * 결과가 아직 없으면(서버 seed 없음 + 스트림 진행 전·중) `null` 대신 자리를 잡은 로딩
 * 카드를 그린다 — 서버 HTML에도 나가므로 브리핑 도착 시 아래 패널이 밀리지 않는다.
 * `cached`와 `done`은 둘 다 본문과 생성 시각을 가지며, 조회가 끝까지 막힌 채 돌아오므로
 * Suspense가 필요 없다.
 */
export function BriefingRegion({ input, scope }: BriefingRegionProps) {
    if (input === undefined) return <BriefingLoadingCard />;
    if (input === 'error') return <BriefingErrorCard />;
    if (input.status === 'cached' || input.status === 'done') {
        return (
            <BriefingCard
                briefing={input.briefing}
                generatedAt={input.generatedAt}
                scope={scope}
            />
        );
    }
    // 예상 밖 status — 방어적으로 로딩 카드.
    return <BriefingLoadingCard />;
}

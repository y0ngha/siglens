import type { FearGreedLabel, FearGreedReading } from '@y0ngha/siglens-core';
import type {
    MarketFearGreedHubView,
    MarketFearGreedViewSnapshot,
} from '@/entities/market-fear-greed/model';

/**
 * 허브 뷰 fixture 빌더. 기본값은 판독값 없음(`snapshot: null`, 빈 비교·빈 기록)이다.
 * 제네릭이라 시장(`MarketFearGreedSnapshot`)·크립토 스냅샷 모두 캐스트 없이 넣는다.
 */
export function hubView<S extends MarketFearGreedViewSnapshot>({
    snapshot = null,
    history = [],
    comparisons = [],
}: {
    snapshot?: S | null;
    history?: FearGreedReading[];
    comparisons?: MarketFearGreedHubView<S>['comparisons'];
} = {}): MarketFearGreedHubView<S> {
    return { snapshot, comparisons, history };
}

/** 점수 → core 5단계 라벨(경계는 core 기본값과 같은 25·45·55·75). 테스트 fixture 전용. */
function labelOf(score: number): FearGreedLabel {
    if (score < 25) return 'EXTREME_FEAR';
    if (score < 45) return 'FEAR';
    if (score < 55) return 'NEUTRAL';
    if (score < 75) return 'GREED';
    return 'EXTREME_GREED';
}

/**
 * `endDate`(ISO)에서 하루씩 거슬러 `count`개의 날짜 오름차순 점수 기록을 만든다.
 * 점수는 `startScore`에서 하루 1점씩 올라 100에서 접힌다(결정적).
 */
export function scoredHistory(
    count: number,
    endDate: string,
    startScore = 10
): FearGreedReading[] {
    const endMs = Date.parse(`${endDate}T00:00:00Z`);
    return Array.from({ length: count }, (_, i) => {
        const score = (startScore + i) % 100;
        return {
            date: new Date(endMs - (count - 1 - i) * 86_400_000)
                .toISOString()
                .slice(0, 10),
            score,
            label: labelOf(score),
        };
    });
}

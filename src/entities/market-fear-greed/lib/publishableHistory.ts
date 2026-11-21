import type { FearGreedLabel, FearGreedReading } from '@y0ngha/siglens-core';
import type {
    MarketFearGreedHubView,
    MarketFearGreedViewSnapshot,
} from '../model';

/** 표·내려받기·Dataset 배포 정보가 함께 쓰는 하한. 최근 표(20거래일)가 늘 꽉 차게 같은 값이다. */
export const FEAR_GREED_HISTORY_MIN_POINTS = 20;

/** 점수가 있는 점(score와 label이 모두 있는 점). */
export type ScoredReading = FearGreedReading & {
    score: number;
    label: FearGreedLabel;
};

/** 워밍업·중간 빈 날(`null`)을 건너뛴 점수 있는 점만, 입력 순서 그대로. */
export function scoredReadings(
    history: readonly FearGreedReading[]
): ScoredReading[] {
    return history.filter(
        (point): point is ScoredReading =>
            point.score !== null && point.label !== null
    );
}

/** 공개 하한을 통과한 기록. 파일 본문 빌더는 검증 전 뷰가 아니라 이 값만 받는다. */
export interface PublishableHistory {
    /** 마지막 점의 날짜. 스냅샷 기준일과 같다. */
    asOf: string;
    /** 점수 있는 점, 날짜 오름차순. `FEAR_GREED_HISTORY_MIN_POINTS`개 이상. */
    points: ScoredReading[];
}

/**
 * 기록을 화면·파일·Dataset 배포 정보로 내보내도 되는가. 세 표면이 이 검사 하나를 쓴다.
 *
 * 스냅샷이 있고, 점수 있는 점이 최소 개수 이상이며, 마지막 점의 날짜가 스냅샷 기준일과
 * 같아야 한다. 마지막 날짜가 어긋난 기록은 히어로와 다른 날을 "최신"이라 말하게 된다.
 * 거짓이면 표는 생략하고 파일은 503으로 답한다 — 빈 표·빈 파일을 데이터로 내지 않는다.
 */
export function publishableHistory<S extends MarketFearGreedViewSnapshot>(
    view: MarketFearGreedHubView<S>
): PublishableHistory | null {
    const { snapshot } = view;
    if (snapshot === null) return null;
    const points = scoredReadings(view.history);
    return points.length >= FEAR_GREED_HISTORY_MIN_POINTS &&
        points.at(-1)?.date === snapshot.asOf
        ? { asOf: snapshot.asOf, points }
        : null;
}

/** 불리언만 필요한 호출부(표시 여부, JSON-LD)용. */
export function hasPublishableHistory<S extends MarketFearGreedViewSnapshot>(
    view: MarketFearGreedHubView<S>
): boolean {
    return publishableHistory(view) !== null;
}

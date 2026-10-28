import type { FearGreedSnapshot } from '@y0ngha/siglens-core';
import { FearGreedGauge } from '@/shared/ui/FearGreedGauge';
import { toDisplayReading } from './utils/displayReading';

interface FearGreedHeroProps {
    snapshot: FearGreedSnapshot;
}

/**
 * 공포·탐욕 페이지의 큰 반원 게이지. 점수와 라벨은 같은 반올림 값에서 뽑아
 * 숫자·바늘·라벨이 한 구간을 가리킨다(`toDisplayReading`).
 */
export function FearGreedHero({ snapshot }: FearGreedHeroProps) {
    const { score, label } = toDisplayReading(snapshot.score);
    return (
        <FearGreedGauge
            score={score}
            label={label}
            size="hero"
            confidence={snapshot.confidence}
        />
    );
}

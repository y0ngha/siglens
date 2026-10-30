import type { FearGreedSnapshot } from '@y0ngha/siglens-core';
import { FearGreedGauge } from '@/shared/ui/FearGreedGauge';

interface FearGreedHeroProps {
    snapshot: FearGreedSnapshot;
}

/**
 * 공포·탐욕 페이지의 큰 반원 게이지. 점수는 반올림해 찍고, 라벨은 core가 준
 * `snapshot.label`을 그대로 쓴다 — 헤더 배지·서버 요약·공유 카드도 같은 라벨을 읽으므로
 * 구간 경계 근처에서도 한 페이지의 라벨이 갈라지지 않는다. 점수→라벨 구간은 core 몫이다.
 */
export function FearGreedHero({ snapshot }: FearGreedHeroProps) {
    return (
        <FearGreedGauge
            score={Math.round(snapshot.score)}
            label={snapshot.label}
            size="hero"
            confidence={snapshot.confidence}
        />
    );
}

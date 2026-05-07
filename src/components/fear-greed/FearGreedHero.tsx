import type { FearGreedSnapshot } from '@y0ngha/siglens-core';
import { FearGreedGauge } from './FearGreedGauge';

interface FearGreedHeroProps {
    snapshot: FearGreedSnapshot;
}

/** Hero semicircle gauge for the fearGreed page. Thin wrapper around FearGreedGauge at hero size. */
export function FearGreedHero({ snapshot }: FearGreedHeroProps) {
    return (
        <FearGreedGauge
            score={Math.round(snapshot.score)}
            label={snapshot.label}
            size="hero"
        />
    );
}

import type { FearGreedHistoryPoint } from '@y0ngha/siglens-core';
import { buildComparisonTiles } from './utils/comparisonTiles';
import { FearGreedComparisonTile } from './ui/gauges/FearGreedComparisonTile';

interface FearGreedComparisonGaugesProps {
    history: FearGreedHistoryPoint[];
}

/**
 * 현재와 1주·1개월·1년 전 점수를 CNN 스타일 미니 게이지 네 칸으로 비교한다.
 * 점수가 하나도 없으면(워밍업뿐) 그리지 않는다.
 */
export function FearGreedComparisonGauges({
    history,
}: FearGreedComparisonGaugesProps) {
    const tiles = buildComparisonTiles(history);
    if (tiles.length === 0) return null;
    return (
        // 2열→4열 grid — flex-wrap은 4칸이 3+1로 갈라져 마지막 칸만 홀로 남는 폭이 생긴다.
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {tiles.map(tile => (
                <FearGreedComparisonTile key={tile.key} tile={tile} />
            ))}
        </ul>
    );
}

'use client';

import type { ChatOptionsBlock } from '@/entities/chat-conversation/types';
import { useOptionsBlockModel } from '@/widgets/chart/visual/useOptionsBlockModel';
import { VisualBlockCard } from '@/widgets/chart/visual/VisualBlockCard';
import { OpenInterestChart } from '@/widgets/options/OpenInterestChart';

/**
 * 옵션 분포 블록 — 옵션 탭과 같은 행사가별 미결제약정 차트(`OpenInterestChart`, 자체 카드·스크린 리더 표 포함)에
 * 맥스페인·풋콜 비율 한 줄을 덧붙인다. 차트가 이미 카드라 틀은 표면 없이(`bare`) 제목 줄만 둔다.
 */
export function OptionsBlock({ block }: { readonly block: ChatOptionsBlock }) {
    const model = useOptionsBlockModel(block);
    return (
        <VisualBlockCard
            title={model.title}
            asOfText={model.asOfText}
            variant="bare"
        >
            <OpenInterestChart
                underlyingPrice={block.underlyingPrice}
                oiByStrike={model.oiByStrike}
                maxPain={block.maxPain}
                oiStale={false}
            />
            <p className="mt-1 px-1 text-xs text-secondary-300">
                {model.summary}
            </p>
        </VisualBlockCard>
    );
}

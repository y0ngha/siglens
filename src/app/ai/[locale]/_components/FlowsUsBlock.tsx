'use client';

import type { ChatFlowsUsBlock } from '@/entities/chat-conversation/types';
import { FlowsUsInstitutionalCard } from '@/widgets/chart/visual/FlowsUsInstitutionalCard';
import { InsiderFlowsBlockView } from '@/widgets/chart/visual/InsiderFlowsBlockView';
import { QuarterFlowChart } from '@/widgets/investor-flows/ui/charts/QuarterFlowChart';
import {
    flowDirection,
    type QuarterBar,
} from '@/widgets/investor-flows/utils/institutional';

/**
 * 미국 수급 블록 — 기관 분기 순증감은 수급 탭의 `QuarterFlowChart`를 재사용하고(진행 중 분기는 윤곽선), 내부자 월별은
 * 수급 탭에 대응 그림이 없어 새로 그린 막대(`InsiderFlowsBlockView`)를 아래에 붙인다.
 */
export function FlowsUsBlock({ block }: { readonly block: ChatFlowsUsBlock }) {
    // `complete`가 생기기 전에 저장된 블록에는 필드가 없다 — 없으면 완결 분기로 본다(`false`만 진행 중).
    const bars: QuarterBar[] = block.institutional.map(q => ({
        period: q.period,
        complete: q.complete !== false,
        holders: q.holders,
        netShareChange: q.netShareChange,
        direction: flowDirection(q.netShareChange),
    }));
    return (
        <>
            {bars.length === 0 ? null : (
                <FlowsUsInstitutionalCard block={block}>
                    <QuarterFlowChart bars={bars} />
                </FlowsUsInstitutionalCard>
            )}
            <InsiderFlowsBlockView block={block} />
        </>
    );
}

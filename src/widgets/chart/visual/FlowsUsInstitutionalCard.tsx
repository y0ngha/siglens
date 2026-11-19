'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import type { ChatFlowsUsBlock } from '@/entities/chat-conversation/types';
import { VisualBlockCard } from './VisualBlockCard';

/**
 * 미국 수급 블록의 기관 분기 카드 틀 — 제목·기준 시각·소제목을 달고, 그림(수급 탭의 `QuarterFlowChart`)은 조립하는
 * app 레이어가 `children`으로 넣는다(위젯끼리는 import하지 못한다).
 */
export function FlowsUsInstitutionalCard({
    block,
    children,
}: {
    readonly block: ChatFlowsUsBlock;
    readonly children: ReactNode;
}) {
    const t = useTranslations('widgets.chart');
    return (
        <VisualBlockCard
            title={t('ChatVisual.flowsUsTitle', {
                symbol: block.name ?? block.symbol,
            })}
            asOfText={t('ChatVisual.asOf', { date: block.asOf.slice(0, 10) })}
        >
            <p className="mb-2 text-[11px] text-secondary-300">
                {t('ChatVisual.flowsInstitutionalCaption')}
            </p>
            {children}
        </VisualBlockCard>
    );
}

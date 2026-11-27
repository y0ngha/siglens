'use client';

import { useMemo } from 'react';
import {
    buildOverlayMenuItems,
    type OverlayMenuItem,
} from '@/entities/analysis/lib/chartOverlays/overlayItems';
import { barTimesOf } from '@/entities/analysis/lib/overlayAlignment';
import type { ChatChartBlock } from '@/entities/chat-conversation/types';
import { useSkillLabel } from '@/shared/i18n/skillLabel';

/**
 * 답변 안 차트의 "차트 작도" 메뉴 항목 — 블록의 작도를 종목 페이지와 같은 규칙(`buildOverlayMenuItems`)으로 묶고,
 * 저장된 스킬 원래 이름(`overlayLabels`)을 로케일 표시명으로 바꾼다. 매수·매도 가격 작도는 채팅 차트에 없다.
 */
export function useChatChartOverlayItems(
    block: ChatChartBlock
): OverlayMenuItem[] {
    const skillLabel = useSkillLabel();
    return useMemo(
        () =>
            buildOverlayMenuItems(block.overlays, {
                barTimes: barTimesOf(block.bars),
                lastBarTime: block.bars.at(-1)?.time ?? 0,
                labelFor: ref => {
                    const name = block.overlayLabels[ref];
                    return name === undefined ? undefined : skillLabel(name);
                },
                hasActionPrices: false,
            }),
        [block, skillLabel]
    );
}

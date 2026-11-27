'use client';

import { createContext, type ComponentType } from 'react';
import type { ChatDrawableBlock } from '@/entities/chat-conversation/types';

/**
 * 답변 안 차트(캔들 차트·시각화 블록)를 그리는 컴포넌트 — app 레이어가 `widgets/chart`의 그림 컴포넌트를 꽂는다. 위젯끼리는 import하지 않으므로
 * (`widgets/CLAUDE.md`) 채팅 위젯은 이 슬롯으로만 차트를 받는다. 비어 있으면(`null`) 차트를 그리지 않는다.
 */
export const ChatChartSlot = createContext<ComponentType<{
    block: ChatDrawableBlock;
}> | null>(null);

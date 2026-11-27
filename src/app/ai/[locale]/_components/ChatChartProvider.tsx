'use client';

import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';
import { isVisualBlock } from '@/entities/chat-conversation/lib/chartBlock';
import type { ChatDrawableBlock } from '@/entities/chat-conversation/types';
import { ChatChartSlot } from '@/widgets/agent-chat/model/chatChartSlot';
import { ChatChartPlaceholder } from '@/widgets/chart/ChatChartPlaceholder';
import { ChatVisualPlaceholder } from '@/widgets/chart/visual/ChatVisualPlaceholder';

/**
 * 답변 안 차트. 지연 청크로만 연다 — 차트 경로는 core를 값으로 쓰므로(캔들 패턴·지표 상수), 채팅 화면을 여는 것만으로는
 * 내려받지 않고 차트가 처음 나올 때 내려받는다(`aiChatCoreFree` 가드의 허용 청크). 자리 표시는 차트와 같은 높이다.
 */
const ChatChart = dynamic(
    () => import('@/widgets/chart/ChatChart').then(mod => mod.ChatChart),
    { ssr: false, loading: () => <ChatChartPlaceholder /> }
);

/**
 * 답변 안 시각화 블록(비교·실적·옵션·수급·보유종목·히트맵·배당). 캔들 차트와 별개의 지연 청크다 — 시그렌즈 위젯을 재사용하는
 * 조립(`ChatVisualBlock`)이 이 청크에 든다. core를 값으로 쓰지 않아 `aiChatCoreFree` 가드의 허용 청크에는 없고, 그래서 이
 * 청크가 core를 끌어오면 가드가 잡는다. 자리 표시는 고정 높이 그림 기준이다(재사용·표 블록은 내용만큼이라 도착하면 높이가 바뀐다).
 */
const ChatVisualBlock = dynamic(
    () => import('./ChatVisualBlock').then(mod => mod.ChatVisualBlock),
    { ssr: false, loading: () => <ChatVisualPlaceholder /> }
);

/** 블록 종류로 그릴 청크를 고른다 — `kind`가 없는 블록은 옛 캔들 차트다. */
function ChatBlockChart({ block }: { readonly block: ChatDrawableBlock }) {
    return isVisualBlock(block) ? (
        <ChatVisualBlock block={block} />
    ) : (
        <ChatChart block={block} />
    );
}

/**
 * 채팅 위젯의 차트 슬롯에 `widgets/chart`의 차트를 꽂는다 — 위젯 조합은 app 레이어가 한다(`widgets/CLAUDE.md`).
 * 컴포넌트를 context 값으로 넘기므로 클라이언트 경계 안에서 만든다(서버 컴포넌트는 함수를 넘길 수 없다).
 */
export function ChatChartProvider({
    children,
}: {
    readonly children: ReactNode;
}) {
    return (
        <ChatChartSlot.Provider value={ChatBlockChart}>
            {children}
        </ChatChartSlot.Provider>
    );
}

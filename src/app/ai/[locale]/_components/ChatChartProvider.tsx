'use client';

import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';
import { ChatChartSlot } from '@/widgets/agent-chat/model/chatChartSlot';
import { ChatChartPlaceholder } from '@/widgets/chart/ChatChartPlaceholder';

/**
 * 답변 안 차트. 지연 청크로만 연다 — 차트 경로는 core를 값으로 쓰므로(캔들 패턴·지표 상수), 채팅 화면을 여는 것만으로는
 * 내려받지 않고 차트가 처음 나올 때 내려받는다(`aiChatCoreFree` 가드의 허용 청크). 자리 표시는 차트와 같은 높이다.
 */
const ChatChart = dynamic(
    () => import('@/widgets/chart/ChatChart').then(mod => mod.ChatChart),
    { ssr: false, loading: () => <ChatChartPlaceholder /> }
);

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
        <ChatChartSlot.Provider value={ChatChart}>
            {children}
        </ChatChartSlot.Provider>
    );
}

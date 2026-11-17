import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import ko from '../../../../../messages/ko.json';
import type { ChatChartBlock } from '@/entities/chat-conversation/types';
import type { AgentUiMessage } from '@/features/agent-chat/model/types';
import { AssistantMessage } from '@/widgets/agent-chat/message/AssistantMessage';
import { ChatChartSlot } from '@/widgets/agent-chat/model/chatChartSlot';

const block: ChatChartBlock = {
    version: 1,
    symbol: 'QQQ',
    timeframe: '1Day',
    marketProfile: 'us-equity',
    bars: [{ time: 0, open: 1, high: 1, low: 1, close: 1, volume: 1 }],
    overlays: [],
    overlayColors: {},
    overlayLabels: {},
    analyzedAt: null,
};

const message: AgentUiMessage = {
    id: 'a1',
    role: 'assistant',
    content: '답변',
    status: 'complete',
    tools: [
        {
            id: 't1',
            name: 'get_bars_indicators',
            args: { symbol: 'QQQ' },
            status: 'ok',
            chart: block,
        },
    ],
};

function FakeChart({ block: b }: { block: ChatChartBlock }) {
    return <div data-testid="fake-chart">{b.symbol}</div>;
}

function renderMessage(slot: typeof FakeChart | null) {
    render(
        <NextIntlClientProvider locale="ko" messages={ko}>
            <ChatChartSlot.Provider value={slot}>
                <AssistantMessage
                    message={message}
                    relatedPages={[]}
                    symbolLabels={{}}
                    showFollowUps={false}
                    onPickFollowUp={() => {}}
                    siteUrl="https://siglens.io"
                    localePrefix=""
                    minHeight={undefined}
                    actions={null}
                />
            </ChatChartSlot.Provider>
        </NextIntlClientProvider>
    );
}

describe('AssistantMessage — 차트 슬롯', () => {
    it('슬롯에 꽂힌 컴포넌트로 도구 칩의 차트를 그린다', () => {
        renderMessage(FakeChart);
        expect(screen.getByTestId('fake-chart')).toHaveTextContent('QQQ');
    });

    it('슬롯이 비어 있으면 차트를 그리지 않는다', () => {
        renderMessage(null);
        expect(screen.queryByTestId('fake-chart')).toBeNull();
        expect(screen.getByText('답변')).toBeInTheDocument();
    });
});

import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import ko from '../../../../../messages/ko.json';
import type {
    ChatBlock,
    ChatChartBlock,
} from '@/entities/chat-conversation/types';
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

function FakeChart({ block: b }: { block: ChatBlock }) {
    return (
        <div data-testid="fake-chart">{'kind' in b ? b.kind : b.symbol}</div>
    );
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

describe('AssistantMessage — 시각화 블록', () => {
    it('시각화 블록도 같은 슬롯으로 그린다', () => {
        render(
            <NextIntlClientProvider locale="ko" messages={ko}>
                <ChatChartSlot.Provider value={FakeChart}>
                    <AssistantMessage
                        message={{
                            ...message,
                            tools: [
                                {
                                    id: 't2',
                                    name: 'show_chart',
                                    args: { kind: 'dividends', symbol: 'KO' },
                                    status: 'ok',
                                    chart: {
                                        version: 1,
                                        kind: 'dividends',
                                        asOf: '2026-11-19T00:00:00.000Z',
                                        symbol: 'KO',
                                        currency: 'USD',
                                        years: [
                                            {
                                                year: 2026,
                                                amount: 1,
                                                partial: true,
                                            },
                                        ],
                                    },
                                },
                            ],
                        }}
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
        expect(screen.getByTestId('fake-chart')).toHaveTextContent('dividends');
    });
});

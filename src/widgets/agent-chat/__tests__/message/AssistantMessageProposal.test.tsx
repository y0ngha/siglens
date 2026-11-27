vi.mock('@/widgets/agent-chat/message/PriceAlertProposalCard', () => ({
    PriceAlertProposalCard: ({
        block,
        siteUrl,
        localePrefix,
    }: {
        block: { proposal: { proposalId: string; symbol: string } };
        siteUrl: string;
        localePrefix: string;
    }) => (
        <div data-testid="proposal-card">
            {block.proposal.symbol}|{block.proposal.proposalId}|{siteUrl}|
            {localePrefix}
        </div>
    ),
}));

import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type {
    ChatBlock,
    ChatChartBlock,
    ChatPriceAlertProposalBlock,
} from '@/entities/chat-conversation/types';
import type { AgentUiMessage } from '@/features/agent-chat/model/types';
import { AssistantMessage } from '@/widgets/agent-chat/message/AssistantMessage';
import { ChatChartSlot } from '@/widgets/agent-chat/model/chatChartSlot';
import ko from '../../../../../messages/ko.json';

const proposal = (id: string, symbol: string): ChatPriceAlertProposalBlock => ({
    version: 1,
    kind: 'price_alert_proposal',
    token: `token-${id}`,
    name: null,
    proposal: {
        proposalId: id,
        subject: 'subject-hash',
        symbol,
        market: 'us',
        condition: { kind: 'close_below', level: 180 },
        basis: 'price_level',
        analysisAt: null,
        referenceClose: 190,
        quoteAt: null,
        startsAfterSession: '2026-11-24',
        expiresOn: '2026-12-24',
        exp: 1_795_000_000,
    },
});

const ids = [
    '5b1f7c1e-3d41-4a6a-9a5c-0a3b6f7d9e10',
    '0f0f0f0f-3d41-4a6a-9a5c-0a3b6f7d9e10',
    '1a1a1a1a-3d41-4a6a-9a5c-0a3b6f7d9e10',
];

const withTools = (
    blocks: ChatBlock[],
    status: AgentUiMessage['status'] = 'complete'
): AgentUiMessage => ({
    id: 'a1',
    role: 'assistant',
    content: '아래 카드에서 만들 수 있어요.',
    status,
    tools: blocks.map((chart, i) => ({
        id: `t${i}`,
        name: 'propose_price_alert',
        args: {},
        status: 'ok' as const,
        chart,
    })),
});

function renderMessage(message: AgentUiMessage) {
    const Chart = vi.fn(() => <div data-testid="chart" />);
    render(
        <NextIntlClientProvider locale="ko" messages={ko}>
            <ChatChartSlot.Provider value={Chart}>
                <AssistantMessage
                    message={message}
                    relatedPages={[]}
                    symbolLabels={{}}
                    showFollowUps={false}
                    onPickFollowUp={() => {}}
                    siteUrl="https://siglens.io"
                    localePrefix="/en"
                    minHeight={undefined}
                    actions={null}
                />
            </ChatChartSlot.Provider>
        </NextIntlClientProvider>
    );
    return Chart;
}

describe('AssistantMessage — 가격대 알림 제안 카드', () => {
    it('답이 끝나면 제안 카드를 그리고, 메인 사이트 주소와 로케일 접두사를 넘긴다', () => {
        const Chart = renderMessage(withTools([proposal(ids[0], 'AAPL')]));

        expect(screen.getByTestId('proposal-card')).toHaveTextContent(
            `AAPL|${ids[0]}|https://siglens.io|/en`
        );
        // 차트 슬롯으로는 가지 않는다.
        expect(Chart).not.toHaveBeenCalled();
        expect(screen.queryByTestId('chart')).not.toBeInTheDocument();
    });

    it('답이 아직 스트리밍 중이면 그리지 않는다 — 쓰이는 문장 위에 버튼이 먼저 뜨지 않게', () => {
        renderMessage(withTools([proposal(ids[0], 'AAPL')], 'streaming'));

        expect(screen.queryByTestId('proposal-card')).not.toBeInTheDocument();
    });

    it('한 답변에 두 장까지만 그린다', () => {
        renderMessage(
            withTools([
                proposal(ids[0], 'AAPL'),
                proposal(ids[1], 'MSFT'),
                proposal(ids[2], 'NVDA'),
            ])
        );

        expect(screen.getAllByTestId('proposal-card')).toHaveLength(2);
    });

    it('제안 카드가 있어도 차트는 그대로 그린다(서로의 상한을 쓰지 않는다)', () => {
        const chart: ChatChartBlock = {
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
        const Chart = renderMessage(
            withTools([proposal(ids[0], 'AAPL'), chart])
        );

        expect(screen.getByTestId('proposal-card')).toBeInTheDocument();
        expect(Chart).toHaveBeenCalledTimes(1);
    });
});

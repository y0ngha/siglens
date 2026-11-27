import { describe, expect, it } from 'vitest';
import type {
    ChatBlock,
    ChatPriceAlertProposalBlock,
} from '@/entities/chat-conversation/types';
import type { ToolActivityItem } from '@/features/agent-chat/model/types';
import {
    MESSAGE_PROPOSALS_MAX,
    messageProposals,
} from '@/widgets/agent-chat/utils/messageProposals';

const proposal = (
    id: string,
    symbol = 'AAPL'
): ChatPriceAlertProposalBlock => ({
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

const chart: ChatBlock = {
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

const tool = (
    id: string,
    block: ChatBlock | undefined,
    status: ToolActivityItem['status'] = 'ok'
): ToolActivityItem => ({
    id,
    name: 'propose_price_alert',
    args: {},
    status,
    ...(block ? { chart: block } : {}),
});

const A = '5b1f7c1e-3d41-4a6a-9a5c-0a3b6f7d9e10';
const B = '0f0f0f0f-3d41-4a6a-9a5c-0a3b6f7d9e10';
const C = '1a1a1a1a-3d41-4a6a-9a5c-0a3b6f7d9e10';

describe('messageProposals', () => {
    it('성공한 칩의 제안 카드만 처음 나온 순서로 고른다', () => {
        expect(
            messageProposals([
                tool('a', proposal(A)),
                tool('b', proposal(B, 'MSFT')),
            ]).map(block => block.proposal.proposalId)
        ).toEqual([A, B]);
    });

    it('실패한 칩·블록 없는 칩·차트 블록은 거른다', () => {
        expect(
            messageProposals([
                tool('a', proposal(A), 'error'),
                tool('b', undefined),
                tool('c', chart),
            ])
        ).toEqual([]);
    });

    it('같은 제안은 한 장이다', () => {
        expect(
            messageProposals([tool('a', proposal(A)), tool('b', proposal(A))])
        ).toHaveLength(1);
    });

    it('한 답변에 두 장까지만 그린다', () => {
        expect(MESSAGE_PROPOSALS_MAX).toBe(2);
        expect(
            messageProposals([
                tool('a', proposal(A)),
                tool('b', proposal(B)),
                tool('c', proposal(C)),
            ]).map(block => block.proposal.proposalId)
        ).toEqual([A, B]);
    });
});

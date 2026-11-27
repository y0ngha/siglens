import { isActionBlock } from '@/entities/chat-conversation/lib/chartBlock';
import type { ChatPriceAlertProposalBlock } from '@/entities/chat-conversation/types';
import type { ToolActivityItem } from '@/features/agent-chat/model/types';

/** 답변 하나에 그리는 가격대 알림 카드 수 상한. 도구의 턴당 상한(두 건)과 같다. */
export const MESSAGE_PROPOSALS_MAX = 2;

/**
 * 답변의 도구 칩에서 그릴 가격대 알림 제안 카드를 고른다: 성공한 칩의 행동 블록만, 같은 제안(`proposalId`)은 한 장,
 * 처음 나온 순서로 최대 {@link MESSAGE_PROPOSALS_MAX}장. 차트(`messageCharts`)와 따로 센다 — 제안이 차트 상한을 쓰지도,
 * 차트가 제안을 밀어내지도 않는다.
 */
export function messageProposals(
    tools: readonly ToolActivityItem[]
): ChatPriceAlertProposalBlock[] {
    const byId = tools.reduce((acc, tool) => {
        if (tool.status !== 'ok' || tool.chart === undefined) return acc;
        const { chart } = tool;
        if (!isActionBlock(chart)) return acc;
        return acc.has(chart.proposal.proposalId)
            ? acc
            : new Map(acc).set(chart.proposal.proposalId, chart);
    }, new Map<string, ChatPriceAlertProposalBlock>());
    return [...byId.values()].slice(0, MESSAGE_PROPOSALS_MAX);
}

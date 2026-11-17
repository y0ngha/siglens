import type { ChatChartBlock } from '@/entities/chat-conversation/types';
import type { ToolActivityItem } from '@/features/agent-chat/model/types';

/** 답변 하나에 그리는 차트 수 상한 — 여러 종목을 비교하는 답에서도 화면이 차트로 덮이지 않게 한다. */
export const MESSAGE_CHARTS_MAX = 3;

/** 그릴 차트 한 장과 그 키. 키에 분석 시각이 들어가 같은 자리의 블록이 바뀌면 차트 상태(꺼 둔 작도)도 새로 시작한다. */
interface MessageChart {
    key: string;
    block: ChatChartBlock;
}

/**
 * 같은 종목·주기 두 블록 중 남길 쪽: 분석이 있는 블록끼리는 더 최근 분석(`analyzedAt`) — 낡은 캐시 분석 뒤 새 분석을
 * 돌린 답은 새 분석의 작도를 보여야 한다. 분석 있는 블록은 봉만 있는 블록을 이긴다. 그 밖(같은 시각, 둘 다 봉만)은
 * 나중 블록.
 */
function preferred(prev: ChatChartBlock, next: ChatChartBlock): ChatChartBlock {
    if (prev.analyzedAt === null) return next;
    if (next.analyzedAt === null) return prev;
    return next.analyzedAt >= prev.analyzedAt ? next : prev;
}

/**
 * 답변의 도구 칩에서 그릴 차트를 고른다: 성공한 칩의 블록만, 같은 종목·주기는 한 장({@link preferred}), 처음 나온 순서대로
 * 최대 {@link MESSAGE_CHARTS_MAX}장.
 */
export function messageCharts(
    tools: readonly ToolActivityItem[]
): MessageChart[] {
    const byKey = tools.reduce((acc, t) => {
        if (t.status !== 'ok' || t.chart === undefined) return acc;
        const key = `${t.chart.symbol}|${t.chart.timeframe}`;
        const prev = acc.get(key);
        return new Map(acc).set(
            key,
            prev === undefined ? t.chart : preferred(prev, t.chart)
        );
    }, new Map<string, ChatChartBlock>());
    return [...byKey.entries()]
        .slice(0, MESSAGE_CHARTS_MAX)
        .map(([key, block]) => ({
            key: `${key}|${block.analyzedAt ?? 'bars'}`,
            block,
        }));
}

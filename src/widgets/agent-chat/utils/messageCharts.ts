import { isVisualBlock } from '@/entities/chat-conversation/lib/chartBlock';
import type {
    ChatBlock,
    ChatChartBlock,
    ChatVisualBlock,
} from '@/entities/chat-conversation/types';
import type { ToolActivityItem } from '@/features/agent-chat/model/types';

/** 답변 하나에 그리는 차트 수 상한 — 여러 종목을 비교하는 답에서도 화면이 차트로 덮이지 않게 한다. */
export const MESSAGE_CHARTS_MAX = 3;

/** 그릴 차트 한 장과 그 키. 키에 분석 시각이 들어가 같은 자리의 블록이 바뀌면 차트 상태(꺼 둔 작도)도 새로 시작한다. */
interface MessageChart {
    key: string;
    block: ChatBlock;
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
 * 시각화 블록의 자리 키 — 같은 키는 한 장이다(다시 부른 같은 그림). 캔들 키(`QQQ|1Day`)와 겹치지 않게 `kind`로 시작한다.
 * 비교는 종목 집합(순서 무관)과 기간, 옵션은 만기, 히트맵은 범위가 키에 든다.
 */
export function visualBlockKey(block: ChatVisualBlock): string {
    switch (block.kind) {
        case 'compare':
            return `compare|${block.series
                .map(s => s.symbol)
                .toSorted()
                .join(',')}|${block.period}`;
        case 'options':
            return `options|${block.symbol}|${block.expiry}`;
        case 'heatmap':
            return block.scope === 'theme'
                ? `heatmap|theme|${block.theme}`
                : `heatmap|sectors|${block.market}`;
        case 'portfolio':
            return 'portfolio';
        case 'financials':
        case 'flows':
        case 'dividends':
            return `${block.kind}|${block.symbol}`;
    }
}

/**
 * 답변의 도구 칩에서 그릴 차트를 고른다: 성공한 칩의 블록만. 캔들은 같은 종목·주기가 한 장({@link preferred}), 시각화는
 * 같은 {@link visualBlockKey}가 한 장(나중 블록). 둘을 합쳐 처음 나온 순서대로 최대 {@link MESSAGE_CHARTS_MAX}장.
 */
export function messageCharts(
    tools: readonly ToolActivityItem[]
): MessageChart[] {
    const byKey = tools.reduce((acc, t) => {
        if (t.status !== 'ok' || t.chart === undefined) return acc;
        const block = t.chart;
        const key = isVisualBlock(block)
            ? visualBlockKey(block)
            : `${block.symbol}|${block.timeframe}`;
        const prev = acc.get(key);
        return new Map(acc).set(
            key,
            prev === undefined || isVisualBlock(block) || isVisualBlock(prev)
                ? block
                : preferred(prev, block)
        );
    }, new Map<string, ChatBlock>());
    // 모델이 `show_chart`로 일부러 그린 블록이 데이터 조회(봉 지표·분석)에 딸려 나온 캔들 차트보다 먼저다 — 비교
    // 질문에서 종목마다 봉을 읽어 캔들이 상한을 채우면, 정작 요청한 비교 차트가 잘려 나갔다. 같은 종류 안에서는
    // 처음 나온 순서를 지킨다(`toSorted`는 안정 정렬).
    return [...byKey.entries()]
        .toSorted(
            ([, a], [, b]) =>
                Number(isVisualBlock(b)) - Number(isVisualBlock(a))
        )
        .slice(0, MESSAGE_CHARTS_MAX)
        .map(([key, block]) => ({
            key: isVisualBlock(block)
                ? `${key}|${block.asOf}`
                : `${key}|${block.analyzedAt ?? 'bars'}`,
            block,
        }));
}

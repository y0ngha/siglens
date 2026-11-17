import { describe, expect, it } from 'vitest';
import type {
    ChatChartBlock,
    ChatChartTimeframe,
} from '@/entities/chat-conversation/types';
import type { ToolActivityItem } from '@/features/agent-chat/model/types';
import {
    MESSAGE_CHARTS_MAX,
    messageCharts,
} from '@/widgets/agent-chat/utils/messageCharts';

const block = (
    symbol: string,
    overlays = 0,
    timeframe: ChatChartTimeframe = '1Day',
    analyzedAt: string | null = null
): ChatChartBlock => ({
    version: 1,
    symbol,
    timeframe,
    marketProfile: 'us-equity',
    bars: [{ time: 0, open: 1, high: 1, low: 1, close: 1, volume: 1 }],
    overlays: Array.from({ length: overlays }, (_, i) => ({
        id: `o${i}`,
    })) as never,
    overlayColors: {},
    overlayLabels: {},
    analyzedAt,
});

const tool = (
    id: string,
    chart: ChatChartBlock | undefined,
    status: ToolActivityItem['status'] = 'ok'
): ToolActivityItem => ({
    id,
    name: 'get_bars_indicators',
    args: {},
    status,
    ...(chart ? { chart } : {}),
});

describe('messageCharts', () => {
    it('성공한 칩의 블록만 고른다', () => {
        expect(
            messageCharts([
                tool('a', block('QQQ')),
                tool('b', block('SPY'), 'error'),
                tool('c', undefined),
            ]).map(c => c.key)
        ).toEqual(['QQQ|1Day|bars']);
    });

    it('같은 종목·주기는 한 장 — 분석 블록이 봉만 있는 블록을 이긴다(순서 무관)', () => {
        const analysis = block('QQQ', 2, '1Day', '2026-11-16T00:00:00Z');
        for (const tools of [
            [tool('a', block('QQQ')), tool('b', analysis)],
            [tool('a', analysis), tool('b', block('QQQ'))],
        ]) {
            const charts = messageCharts(tools);
            expect(charts).toHaveLength(1);
            expect(charts[0]?.block).toBe(analysis);
        }
    });

    it('분석 블록끼리는 더 최근 분석을 남긴다(작도 수와 무관)', () => {
        const stale = block('QQQ', 5, '1Day', '2026-11-10T00:00:00Z');
        const fresh = block('QQQ', 1, '1Day', '2026-11-16T00:00:00Z');
        expect(
            messageCharts([tool('a', fresh), tool('b', stale)])[0]?.block
        ).toBe(fresh);
        expect(
            messageCharts([tool('a', stale), tool('b', fresh)])[0]?.block
        ).toBe(fresh);
    });

    it('같은 시각이거나 둘 다 봉만이면 나중 블록을 남긴다', () => {
        const first = block('QQQ', 1, '1Day', '2026-11-16T00:00:00Z');
        const second = block('QQQ', 1, '1Day', '2026-11-16T00:00:00Z');
        expect(
            messageCharts([tool('a', first), tool('b', second)])[0]?.block
        ).toBe(second);
        const barsA = block('QQQ');
        const barsB = block('QQQ');
        expect(
            messageCharts([tool('a', barsA), tool('b', barsB)])[0]?.block
        ).toBe(barsB);
    });

    it('키에 분석 시각이 들어가 같은 자리의 블록이 바뀌면 키도 바뀐다', () => {
        expect(messageCharts([tool('a', block('QQQ'))])[0]?.key).toBe(
            'QQQ|1Day|bars'
        );
        expect(
            messageCharts([
                tool('a', block('QQQ', 0, '1Day', '2026-11-16T00:00:00Z')),
            ])[0]?.key
        ).toBe('QQQ|1Day|2026-11-16T00:00:00Z');
    });

    it('주기가 다르면 따로 그린다', () => {
        expect(
            messageCharts([
                tool('a', block('QQQ', 0, '1Day')),
                tool('b', block('QQQ', 0, '1Week')),
            ]).map(c => c.key)
        ).toEqual(['QQQ|1Day|bars', 'QQQ|1Week|bars']);
    });

    it(`최대 ${MESSAGE_CHARTS_MAX}장, 처음 나온 순서대로`, () => {
        const charts = messageCharts(
            ['A', 'B', 'C', 'D'].map(s => tool(s, block(s)))
        );
        expect(charts.map(c => c.block.symbol)).toEqual(['A', 'B', 'C']);
    });
});

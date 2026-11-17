import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import type { ChatChartBlock } from '@/entities/chat-conversation/types';
import { createTurnCharts } from '@/app/api/ai/chat/stream/_lib/turnCharts';

const block = (symbol: string): ChatChartBlock => ({
    version: 1,
    symbol,
    timeframe: '1Day',
    marketProfile: 'us-equity',
    bars: [{ time: 0, open: 1, high: 1, low: 1, close: 1, volume: 1 }],
    overlays: [],
    overlayColors: {},
    overlayLabels: {},
    analyzedAt: null,
});

describe('createTurnCharts', () => {
    it('실행기가 낸 블록을 tool_start의 이름·인자로 id에 묶어 tool_end에서 낸다', async () => {
        const charts = createTurnCharts();
        const emit = vi.fn();
        charts.register(
            { name: 'get_bars_indicators', args: { symbol: 'QQQ' } },
            Promise.resolve(block('QQQ'))
        );
        charts.started('c1', 'get_bars_indicators', { symbol: 'QQQ' });
        charts.ended('c1', emit);
        const settled = await charts.settled();
        expect(emit).toHaveBeenCalledWith(block('QQQ'));
        expect([...settled.keys()]).toEqual(['c1']);
    });

    it('인자가 다른 호출의 블록은 묶지 않는다', async () => {
        const charts = createTurnCharts();
        const emit = vi.fn();
        charts.register(
            { name: 'get_bars_indicators', args: { symbol: 'QQQ' } },
            Promise.resolve(block('QQQ'))
        );
        charts.started('c1', 'get_bars_indicators', { symbol: 'SPY' });
        charts.ended('c1', emit);
        expect((await charts.settled()).size).toBe(0);
        expect(emit).not.toHaveBeenCalled();
    });

    it('블록이 null이면 내지도 저장하지도 않는다', async () => {
        const charts = createTurnCharts();
        const emit = vi.fn();
        charts.register(
            { name: 'get_cached_analysis', args: { symbol: 'QQQ' } },
            Promise.resolve(null)
        );
        charts.started('c1', 'get_cached_analysis', { symbol: 'QQQ' });
        charts.ended('c1', emit);
        expect((await charts.settled()).size).toBe(0);
        expect(emit).not.toHaveBeenCalled();
    });

    it('블록을 내지 않은 호출은 아무것도 하지 않는다', async () => {
        const charts = createTurnCharts();
        const emit = vi.fn();
        charts.started('c1', 'get_quote', { symbols: ['QQQ'] });
        charts.ended('c1', emit);
        charts.ended('unknown', emit);
        expect((await charts.settled()).size).toBe(0);
        expect(emit).not.toHaveBeenCalled();
    });
});

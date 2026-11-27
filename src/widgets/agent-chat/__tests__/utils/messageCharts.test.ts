import { describe, expect, it } from 'vitest';
import type {
    ChatBlock,
    ChatPriceAlertProposalBlock,
    ChatChartBlock,
    ChatChartTimeframe,
    ChatCompareBlock,
    ChatDividendsBlock,
    ChatHeatmapBlock,
    ChatOptionsBlock,
} from '@/entities/chat-conversation/types';
import type { ToolActivityItem } from '@/features/agent-chat/model/types';
import {
    MESSAGE_CHARTS_MAX,
    messageCharts,
    visualBlockKey,
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
    chart: ChatBlock | undefined,
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
        expect(charts.map(c => c.key)).toEqual([
            'A|1Day|bars',
            'B|1Day|bars',
            'C|1Day|bars',
        ]);
    });
});

const compare = (
    symbols: string[],
    period: ChatCompareBlock['period'] = '6M'
): ChatCompareBlock => ({
    version: 1,
    kind: 'compare',
    asOf: '2026-11-19T00:00:00.000Z',
    period,
    series: symbols.map(symbol => ({
        symbol,
        points: [
            [1, 0],
            [2, 1],
        ],
    })),
});

const dividends = (symbol: string, amount = 1): ChatDividendsBlock => ({
    version: 1,
    kind: 'dividends',
    asOf: '2026-11-19T00:00:00.000Z',
    symbol,
    currency: 'USD',
    years: [{ year: 2026, amount, partial: true }],
});

const options = (symbol: string, expiry: string): ChatOptionsBlock => ({
    version: 1,
    kind: 'options',
    asOf: '2026-11-19T00:00:00.000Z',
    symbol,
    expiry,
    underlyingPrice: 100,
    maxPain: null,
    putCallRatio: null,
    strikes: [{ strike: 100, callOI: 1, putOI: 1 }],
});

const heatmapSectors = (market: 'us' | 'kr'): ChatHeatmapBlock => ({
    version: 1,
    kind: 'heatmap',
    asOf: '2026-11-19T00:00:00.000Z',
    scope: 'sectors',
    market,
    sectors: [{ label: 'IT', changePct: 1 }],
});

describe('messageCharts — 시각화 블록', () => {
    it('종류별 키로 캔들과 섞어 그리고, 시각화 블록을 캔들보다 앞에 둔다', () => {
        expect(
            messageCharts([
                tool('a', block('QQQ')),
                tool('b', compare(['NVDA', 'AMD'])),
                tool('c', dividends('KO')),
            ]).map(c => c.key)
        ).toEqual([
            'compare|AMD,NVDA|6M|2026-11-19T00:00:00.000Z',
            'dividends|KO|2026-11-19T00:00:00.000Z',
            'QQQ|1Day|bars',
        ]);
    });

    it('캔들이 상한을 먼저 채워도 요청한 시각화 블록은 잘리지 않는다', () => {
        expect(
            messageCharts([
                tool('a', block('QQQ')),
                tool('b', block('SPY')),
                tool('c', block('BTCUSD')),
                tool('d', compare(['QQQ', 'SPY', 'BTCUSD'], '1Y')),
            ]).map(c => c.key.split('|')[0])
        ).toEqual(['compare', 'QQQ', 'SPY']);
    });

    it('비교 키는 종목 순서와 무관하고 기간은 키에 든다', () => {
        const keys = (b: ChatCompareBlock) => visualBlockKey(b);
        expect(keys(compare(['NVDA', 'AMD']))).toBe(
            keys(compare(['AMD', 'NVDA']))
        );
        expect(keys(compare(['NVDA', 'AMD'], '1Y'))).not.toBe(
            keys(compare(['NVDA', 'AMD']))
        );
    });

    it('같은 키의 시각화 블록은 한 장 — 나중 블록이 이긴다', () => {
        const charts = messageCharts([
            tool('a', dividends('KO', 1)),
            tool('b', dividends('KO', 2)),
        ]);
        expect(charts).toHaveLength(1);
        expect(charts[0]?.block).toMatchObject({ years: [{ amount: 2 }] });
    });

    it('옵션은 만기별, 히트맵은 시장별로 따로 그린다', () => {
        expect(
            messageCharts([
                tool('a', options('TSLA', '2026-12-18')),
                tool('b', options('TSLA', '2027-01-15')),
                tool('c', heatmapSectors('us')),
            ]).map(c => c.key.split('|').slice(0, 3).join('|'))
        ).toEqual([
            'options|TSLA|2026-12-18',
            'options|TSLA|2027-01-15',
            'heatmap|sectors|us',
        ]);
        expect(visualBlockKey(heatmapSectors('kr'))).toBe('heatmap|sectors|kr');
    });

    it('캔들과 시각화를 합쳐 최대 3장', () => {
        expect(
            messageCharts([
                tool('a', block('QQQ')),
                tool('b', compare(['NVDA', 'AMD'])),
                tool('c', dividends('KO')),
                tool('d', dividends('PEP')),
            ])
        ).toHaveLength(MESSAGE_CHARTS_MAX);
    });

    it('실패한 칩의 시각화 블록은 그리지 않는다', () => {
        expect(
            messageCharts([tool('a', compare(['A', 'B']), 'error')])
        ).toEqual([]);
    });

    it('가격대 알림 제안 카드는 차트가 아니다 — 차트 상한에도 세지 않는다', () => {
        const proposal: ChatPriceAlertProposalBlock = {
            version: 1,
            kind: 'price_alert_proposal',
            token: 'body.signature',
            name: null,
            proposal: {
                proposalId: '5b1f7c1e-3d41-4a6a-9a5c-0a3b6f7d9e10',
                subject: 'subject-hash',
                symbol: 'AAPL',
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
        };

        expect(messageCharts([tool('p', proposal)])).toEqual([]);
        expect(
            messageCharts([
                tool('a', block('QQQ')),
                tool('p', proposal),
                tool('b', compare(['NVDA', 'AMD'])),
                tool('c', dividends('KO')),
            ]).map(chart => chart.block)
        ).toHaveLength(MESSAGE_CHARTS_MAX);
        expect(
            messageCharts([tool('p', proposal), tool('a', block('QQQ'))])
        ).toHaveLength(1);
    });
});

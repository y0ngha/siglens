import type { SectorSignalsResult } from '@y0ngha/siglens-core';
import { guideEntry } from '@/__tests__/fixtures/guideFixtures';
import {
    resolveLiveTargets,
    selectLiveSymbols,
} from '@/views/guide/lib/liveSymbols';

const doubleBottom = guideEntry({
    slug: 'double-bottom',
    category: 'chart-patterns',
});
const rsi = guideEntry({ slug: 'rsi', signals: ['rsi_oversold'] });
const howto = guideEntry({
    slug: 'double-bottom-confirm',
    category: 'howto',
    about: ['double-bottom', 'rsi'],
    signals: ['rsi_bullish_divergence'],
});
const catalog = [howto, doubleBottom, rsi];

function scanner(
    stocks: SectorSignalsResult['stocks'],
    computedAt = '2026-10-25T00:00:00.000Z'
): SectorSignalsResult {
    return { computedAt, stocks };
}

describe('resolveLiveTargets', () => {
    it('차트 패턴 항목은 GUIDE_PATH_BY_TRIGGER를 역전한 패턴 id를 얻는다', () => {
        const targets = resolveLiveTargets(doubleBottom, catalog);
        expect(targets.patternNames).toContain('double_bottom');
        expect(targets.signalTypes).toEqual([]);
    });

    it('howto는 자기 signals + about 항목들의 signals·패턴 id를 합친다', () => {
        const targets = resolveLiveTargets(howto, catalog);
        expect(targets.signalTypes).toEqual([
            'rsi_bullish_divergence',
            'rsi_oversold',
        ]);
        expect(targets.patternNames).toContain('double_bottom');
    });

    it('catalog에 없는 about slug는 무시한다', () => {
        const orphan = guideEntry({
            slug: 'orphan',
            category: 'howto',
            about: ['missing', 'rsi'],
            signals: [],
        });
        const targets = resolveLiveTargets(orphan, catalog);
        expect(targets.signalTypes).toEqual(['rsi_oversold']);
        expect(targets.patternNames).toEqual([]);
    });

    it('지표 항목은 패턴 id가 없다', () => {
        expect(resolveLiveTargets(rsi, catalog).patternNames).toEqual([]);
    });
});

describe('selectLiveSymbols', () => {
    const stock = (
        symbol: string,
        type: 'rsi_oversold' | 'golden_cross',
        phase: 'confirmed' | 'expected',
        changePercent: number
    ) => ({
        symbol,
        koreanName: `${symbol} 이름`,
        sectorSymbol: 'XLK',
        price: 100,
        changePercent,
        trend: 'uptrend' as const,
        signals: [
            { type, direction: 'bullish' as const, phase, detectedAt: 10 },
        ],
    });

    it('신호가 맞는 종목만, confirmed → expected → 스냅샷 순, 시장별로 묶는다', () => {
        const groups = selectLiveSymbols({
            targets: {
                signalTypes: ['rsi_oversold'],
                patternNames: ['double_bottom'],
            },
            scanner: [
                {
                    market: 'us',
                    result: scanner([
                        stock('AAPL', 'rsi_oversold', 'expected', 1),
                        stock('MSFT', 'golden_cross', 'confirmed', 5),
                        stock('NVDA', 'rsi_oversold', 'confirmed', -2),
                    ]),
                },
                {
                    market: 'kr',
                    result: scanner([
                        stock('005930.KS', 'rsi_oversold', 'confirmed', 0.5),
                    ]),
                },
            ],
            snapshotHits: [
                { symbol: 'TSLA', generatedAt: '2026-10-24T21:00:00.000Z' },
                { symbol: 'NVDA', generatedAt: '2026-10-24T21:00:00.000Z' },
            ],
            limitPerMarket: 5,
        });
        expect(groups.map(g => g.market)).toEqual(['us', 'kr']);
        expect(groups[0].rows.map(r => [r.symbol, r.basis])).toEqual([
            ['NVDA', 'scanner'],
            ['AAPL', 'scanner'],
            ['TSLA', 'snapshot'],
        ]);
        expect(groups[0].rows[2]).toMatchObject({
            name: null,
            changePercent: null,
            detectedOn: '2026-10-24T21:00:00.000Z',
        });
        expect(groups[1].rows.map(r => r.symbol)).toEqual(['005930.KS']);
    });

    it('시장당 limit을 넘기지 않고, 비면 그룹을 내지 않는다', () => {
        const many = Array.from({ length: 7 }, (_, i) =>
            stock(`S${i}`, 'rsi_oversold', 'confirmed', i)
        );
        const groups = selectLiveSymbols({
            targets: { signalTypes: ['rsi_oversold'], patternNames: [] },
            scanner: [{ market: 'us', result: scanner(many) }],
            snapshotHits: [],
            limitPerMarket: 5,
        });
        expect(groups).toHaveLength(1);
        expect(groups[0].rows).toHaveLength(5);
        // |changePercent| 큰 순
        expect(groups[0].rows[0].symbol).toBe('S6');
    });

    it('patternNames가 비면 스냅샷 적중은 버린다', () => {
        expect(
            selectLiveSymbols({
                targets: { signalTypes: ['rsi_oversold'], patternNames: [] },
                scanner: [],
                snapshotHits: [
                    { symbol: 'TSLA', generatedAt: '2026-10-24T21:00:00.000Z' },
                ],
                limitPerMarket: 5,
            })
        ).toEqual([]);
    });

    it('대상 신호가 expected뿐이면 비대상 confirmed가 있어도 expected로 순위를 매긴다', () => {
        const mixed = {
            ...stock('MIXED', 'rsi_oversold', 'expected', 9),
            signals: [
                {
                    type: 'rsi_oversold' as const,
                    direction: 'bullish' as const,
                    phase: 'expected' as const,
                    detectedAt: 10,
                },
                {
                    type: 'golden_cross' as const,
                    direction: 'bullish' as const,
                    phase: 'confirmed' as const,
                    detectedAt: 10,
                },
            ],
        };
        const groups = selectLiveSymbols({
            targets: { signalTypes: ['rsi_oversold'], patternNames: [] },
            scanner: [
                {
                    market: 'us',
                    result: scanner([
                        mixed,
                        stock('CONF', 'rsi_oversold', 'confirmed', 0.1),
                    ]),
                },
            ],
            snapshotHits: [],
            limitPerMarket: 5,
        });
        // MIXED의 |변동|이 더 크지만 expected라 confirmed인 CONF 뒤에 온다.
        expect(groups[0].rows.map(r => r.symbol)).toEqual(['CONF', 'MIXED']);
    });

    it('대상이 없으면 빈 배열', () => {
        expect(
            selectLiveSymbols({
                targets: { signalTypes: [], patternNames: [] },
                scanner: [],
                snapshotHits: [],
                limitPerMarket: 5,
            })
        ).toEqual([]);
    });
});

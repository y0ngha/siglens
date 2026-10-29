import type { AnalysisResponse, Bar } from '@y0ngha/siglens-core';
import { buildShareSnapshotInput } from '@/features/share/lib/buildShareSnapshotInput';
import type { ShareableRegistration } from '@/features/share/model/ShareableAnalysisContext';
import { MAX_CHART_BARS } from '@/entities/shared-analysis/types';

function bar(time: number): Bar {
    return { time, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 };
}

const RESULT: AnalysisResponse = {
    summary: '상승 추세',
    trend: 'bullish',
    indicatorResults: [],
    riskLevel: 'low',
    keyLevels: { support: [], resistance: [] },
    priceTargets: { bullish: null, bearish: null },
    patternSummaries: [],
    strategyResults: [],
    candlePatterns: [],
    trendlines: [],
};

function reg(
    overrides: Partial<ShareableRegistration> = {}
): ShareableRegistration {
    return {
        kind: 'chart',
        status: 'success',
        result: RESULT,
        context: {
            symbol: 'MSFT',
            displayName: 'Microsoft',
            assetClass: 'us_equity',
        },
        trigger: () => {},
        ...overrides,
    };
}

describe('buildShareSnapshotInput', () => {
    describe('공유할 결과가 없을 때', () => {
        it('등록이 없으면 null', () => {
            expect(buildShareSnapshotInput(null, 'free')).toBeNull();
        });

        it('status가 success가 아니면 null', () => {
            expect(
                buildShareSnapshotInput(reg({ status: 'pending' }), 'free')
            ).toBeNull();
        });

        it('result가 없으면 null', () => {
            expect(
                buildShareSnapshotInput(reg({ result: null }), 'free')
            ).toBeNull();
        });
    });

    it('기본 필드와 sharerTier를 그대로 싣는다', () => {
        expect(buildShareSnapshotInput(reg(), 'pro')).toEqual({
            kind: 'chart',
            symbol: 'MSFT',
            context: {
                symbol: 'MSFT',
                displayName: 'Microsoft',
                assetClass: 'us_equity',
            },
            result: RESULT,
            sharerTier: 'pro',
        });
    });

    describe('chartBars', () => {
        it('MAX_CHART_BARS를 넘으면 가장 최근 봉만 남긴다', () => {
            const bars = Array.from({ length: MAX_CHART_BARS + 2 }, (_, i) =>
                bar(i)
            );
            const input = buildShareSnapshotInput(
                reg({ chartBars: bars }),
                'free'
            );
            expect(input?.chartBars?.map(b => b.time)).toEqual(
                bars.slice(2).map(b => b.time)
            );
        });

        it('빈 배열이면 필드를 생략한다', () => {
            const input = buildShareSnapshotInput(
                reg({ chartBars: [] }),
                'free'
            );
            expect(input).not.toHaveProperty('chartBars');
        });

        it('chart가 아닌 kind는 bars를 싣지 않는다', () => {
            const input = buildShareSnapshotInput(
                reg({ kind: 'news', chartBars: [bar(1)] }),
                'free'
            );
            expect(input).not.toHaveProperty('chartBars');
        });
    });

    describe('plain', () => {
        it('내용이 있는 산문은 원문 그대로 싣는다', () => {
            const input = buildShareSnapshotInput(
                reg({ plain: '  쉬운 설명  ' }),
                'free'
            );
            expect(input?.plain).toBe('  쉬운 설명  ');
        });

        it('공백뿐인 산문은 생략한다', () => {
            const input = buildShareSnapshotInput(
                reg({ plain: '   ' }),
                'free'
            );
            expect(input).not.toHaveProperty('plain');
        });

        it('null 산문은 생략한다', () => {
            const input = buildShareSnapshotInput(reg({ plain: null }), 'free');
            expect(input).not.toHaveProperty('plain');
        });
    });
});

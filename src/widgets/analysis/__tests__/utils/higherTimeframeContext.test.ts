import type {
    HigherTimeframeReading,
    MarketBackdropReading,
} from '@y0ngha/siglens-core';
import {
    buildAnalysisContextModel,
    selectContextLines,
    type AnalysisContextModel,
} from '@/widgets/analysis/utils/higherTimeframeContext';

function htf(
    over: Partial<HigherTimeframeReading> = {}
): HigherTimeframeReading {
    return {
        kind: 'weekly',
        trend: 'bullish',
        slopeAtr: 1.62,
        rsi14: 61.2,
        closeVsMa50Pct: 12.4,
        lastBarInProgress: true,
        bars: 246,
        alignment: 'aligned',
        ...over,
    };
}

function backdrop(
    over: Partial<MarketBackdropReading> = {}
): MarketBackdropReading {
    return {
        label: 'S&P 500 (SPY)',
        trend: 'bullish',
        closeVsMa200Pct: 6.2,
        endDate: '2026-11-20',
        relative: [
            { sessions: 20, symbolPct: 4.1, benchmarkPct: 1.3 },
            { sessions: 60, symbolPct: 9.8, benchmarkPct: 5.0 },
        ],
        ...over,
    };
}

describe('buildAnalysisContextModel', () => {
    it('두 필드가 모두 없는 옛 결과는 null이다', () => {
        expect(buildAnalysisContextModel({})).toBeNull();
    });

    it('상위 시간대 읽기를 그대로 옮긴다', () => {
        expect(buildAnalysisContextModel({ higherTimeframe: htf() })).toEqual({
            higherTimeframe: {
                kind: 'weekly',
                trend: 'bullish',
                alignment: 'aligned',
                lastBarInProgress: true,
            },
            market: null,
        });
    });

    it('판단하지 못한 추세(null)는 보합으로 바꾸지 않고 null로 둔다', () => {
        const model = buildAnalysisContextModel({
            higherTimeframe: htf({ trend: null, alignment: null }),
        });
        expect(model?.higherTimeframe).toMatchObject({
            trend: null,
            alignment: null,
        });
    });

    it('알 수 없는 kind·추세·정렬은 걸러 낸다(캐시에서 되살아난 부분 객체)', () => {
        const bad = {
            kind: 'yearly',
            trend: 'sideways',
            alignment: 'weird',
            lastBarInProgress: 'yes',
        } as unknown as HigherTimeframeReading;
        expect(buildAnalysisContextModel({ higherTimeframe: bad })).toBeNull();
        const partial = {
            ...htf(),
            trend: 'sideways',
            alignment: 'weird',
            lastBarInProgress: 'yes',
        } as unknown as HigherTimeframeReading;
        expect(
            buildAnalysisContextModel({ higherTimeframe: partial })
                ?.higherTimeframe
        ).toEqual({
            kind: 'weekly',
            trend: null,
            alignment: null,
            lastBarInProgress: false,
        });
    });

    it('시장 배경은 20거래일 구간만 부호 있는 퍼센트로 옮긴다', () => {
        expect(
            buildAnalysisContextModel({ marketBackdrop: backdrop() })?.market
        ).toEqual({
            label: 'S&P 500 (SPY)',
            trend: 'bullish',
            basisDate: '2026-11-20',
            change: { sessions: 20, symbolPct: '+4.1%', benchmarkPct: '+1.3%' },
        });
    });

    it('20거래일 값이 한쪽이라도 없으면 변화 줄은 없다', () => {
        const model = buildAnalysisContextModel({
            marketBackdrop: backdrop({
                relative: [
                    { sessions: 20, symbolPct: null, benchmarkPct: 1.3 },
                    { sessions: 60, symbolPct: 9.8, benchmarkPct: 5.0 },
                ],
            }),
        });
        expect(model?.market?.change).toBeNull();
    });

    it('라벨이 비면 시장 배경을 그리지 않는다', () => {
        expect(
            buildAnalysisContextModel({
                marketBackdrop: backdrop({ label: '' }),
            })
        ).toBeNull();
    });

    it('basisDate: 분석 봉과 날짜가 같으면 null, 다르거나 모르면 endDate', () => {
        const at = (iso: string) => ({
            barTime: Date.parse(`${iso}T00:00:00Z`) / 1000,
            close: 1,
        });
        const basisOf = (dataAsOf?: { barTime: number; close: number }) =>
            buildAnalysisContextModel({
                marketBackdrop: backdrop(),
                dataAsOf,
            })?.market?.basisDate;
        expect(basisOf(at('2026-11-20'))).toBeNull();
        expect(basisOf(at('2026-11-19'))).toBe('2026-11-20');
        expect(basisOf(undefined)).toBe('2026-11-20');
    });

    it('basisDate: 달력에 없는 날짜나 null은 말하지 않는다', () => {
        for (const endDate of ['2026-13-45', 'x', null]) {
            expect(
                buildAnalysisContextModel({
                    marketBackdrop: backdrop({ endDate }),
                })?.market?.basisDate
            ).toBeNull();
        }
    });
});

describe('selectContextLines', () => {
    function modelOf(
        h: Partial<HigherTimeframeReading> | null,
        b: Partial<MarketBackdropReading> | null = null
    ): AnalysisContextModel {
        const model = buildAnalysisContextModel({
            ...(h === null ? {} : { higherTimeframe: htf(h) }),
            ...(b === null ? {} : { marketBackdrop: backdrop(b) }),
            dataAsOf: {
                barTime: Date.parse('2026-11-20T00:00:00Z') / 1000,
                close: 1,
            },
        });
        if (model === null) throw new Error('model expected');
        return model;
    }
    const keysOf = (m: AnalysisContextModel) =>
        selectContextLines(m, 'AAPL').map(l => l.key);

    it.each([
        [{ trend: null, alignment: null }, 'htfUnknown'],
        [{ alignment: 'aligned' }, 'htfAligned'],
        [{ alignment: 'opposed' }, 'htfOpposed'],
        [{ alignment: 'mixed' }, 'htfMixed'],
        [{ alignment: null }, 'htfTrend'],
    ] as const)('상위 시간대 %j -> %s (진행 중 아님)', (over, key) => {
        expect(keysOf(modelOf({ ...over, lastBarInProgress: false }))).toEqual([
            key,
        ]);
    });

    it.each([
        ['daily', 'progressDaily'],
        ['weekly', 'progressWeekly'],
        ['monthly', 'progressMonthly'],
    ] as const)('%s 진행 중이면 %s 줄이 뒤따른다', (kind, key) => {
        expect(keysOf(modelOf({ kind, lastBarInProgress: true }))).toEqual([
            expect.any(String),
            key,
        ]);
    });

    it('kind와 추세는 params로 넘긴다', () => {
        const [first] = selectContextLines(
            modelOf({
                kind: 'monthly',
                trend: 'bearish',
                alignment: 'opposed',
            }),
            'AAPL'
        );
        expect(first.params).toEqual({ kind: 'monthly', trend: 'bearish' });
    });

    it('시장 줄: 추세·기준일·변화 순, 변화는 표시 코드를 쓴다', () => {
        const lines = selectContextLines(
            modelOf(null, { endDate: '2026-11-19' }),
            '005930'
        );
        expect(lines.map(l => l.key)).toEqual([
            'marketTrend',
            'marketBasis',
            'marketChange',
        ]);
        expect(lines[2].params).toMatchObject({
            ticker: '005930',
            sessions: 20,
            symbolPct: '+4.1%',
            benchmarkPct: '+1.3%',
        });
    });

    it('시장 추세가 null이면 marketUnknown, 기준일이 같으면 기준일 줄이 없다', () => {
        expect(keysOf(modelOf(null, { trend: null }))).toEqual([
            'marketUnknown',
            'marketChange',
        ]);
    });

    it('key는 줄마다 겹치지 않는다', () => {
        const keys = selectContextLines(
            modelOf({ lastBarInProgress: true }, { endDate: '2026-11-19' }),
            'AAPL'
        ).map(l => l.key);
        expect(new Set(keys).size).toBe(keys.length);
    });
});

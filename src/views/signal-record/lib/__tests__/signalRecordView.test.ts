import {
    MEASURED_SIGNAL_BASE_RATES,
    type MeasuredSignalBaseRate,
    type MeasuredSignalHorizon,
} from '@y0ngha/siglens-core';
import { defined } from '@/shared/test-utils/defined';
import { buildSignalRecordView } from '../signalRecordView';

const REAL = MEASURED_SIGNAL_BASE_RATES.golden_cross;

function viewOf(record: MeasuredSignalBaseRate) {
    return defined(buildSignalRecordView(record), 'record view');
}

function symbolsOf(market: 'us' | 'kr'): number {
    return defined(
        REAL.scope.markets.find(entry => entry.market === market),
        market
    ).symbols;
}

function withHorizon(
    index: number,
    patch: Partial<MeasuredSignalHorizon>
): MeasuredSignalBaseRate {
    const horizons = REAL.horizons.map((horizon, i) =>
        i === index ? { ...horizon, ...patch } : horizon
    ) as unknown as MeasuredSignalBaseRate['horizons'];
    return { ...REAL, horizons };
}

describe('buildSignalRecordView', () => {
    it('기록이 없으면 null이다', () => {
        expect(buildSignalRecordView(null)).toBeNull();
    });

    it('항상 1·5·10·20 순서의 네 줄을 낸다', () => {
        const view = viewOf(REAL);

        expect(view.rows.map(row => row.days)).toEqual([1, 5, 10, 20]);
    });

    it('줄 순서는 비율이 아니라 기간 순서다', () => {
        const view = viewOf({
            ...REAL,
            horizons: REAL.horizons.map((horizon, i) => ({
                ...horizon,
                eventShare: 0.9 - i * 0.1,
            })) as unknown as MeasuredSignalBaseRate['horizons'],
        });

        expect(view.rows.map(row => row.days)).toEqual([1, 5, 10, 20]);
    });

    it('비율과 표본 수는 상수 필드 그대로다', () => {
        const view = viewOf(REAL);
        const first = view.rows[0];
        const horizon = REAL.horizons[0];

        expect(first).toEqual({
            kind: 'rates',
            days: 1,
            n: horizon.n,
            event: `${(defined(horizon.eventShare) * 100).toFixed(1)}%`,
            placebo: `${(defined(horizon.placeboShare) * 100).toFixed(1)}%`,
            verdict: horizon.verdict,
        });
    });

    it('비율은 소수 한 자리 퍼센트 문자열이다', () => {
        const view = viewOf(
            withHorizon(1, { eventShare: 0.48381, placeboShare: 0.5 })
        );

        expect(view.rows[1]).toMatchObject({
            event: '48.4%',
            placebo: '50.0%',
        });
    });

    it('범위는 상수의 시장별 종목 수와 기간 그대로다', () => {
        const view = viewOf(REAL);

        expect(view).toMatchObject({
            usSymbols: symbolsOf('us'),
            krSymbols: symbolsOf('kr'),
            from: REAL.scope.from,
            to: REAL.scope.to,
            direction: REAL.direction,
        });
    });

    it('표본 부족 기간은 비율을 싣지 않는다', () => {
        const view = viewOf(
            withHorizon(2, {
                verdict: 'insufficient_sample',
                eventShare: null,
                placeboShare: null,
                difference: null,
            })
        );

        expect(view.rows[2]).toEqual({ kind: 'insufficient', days: 10 });
        expect(view.rows[1].kind).toBe('rates');
    });

    it('판정이 있어도 비율 한쪽이 null이면 숨긴다', () => {
        const view = viewOf(withHorizon(0, { eventShare: null }));

        expect(view.rows[0]).toEqual({ kind: 'insufficient', days: 1 });
    });

    it('판정이 표본 부족이면 비율이 남아 있어도 숨긴다', () => {
        const view = viewOf(withHorizon(3, { verdict: 'insufficient_sample' }));

        expect(view.rows[3]).toEqual({ kind: 'insufficient', days: 20 });
    });

    it('기간이 하나라도 빠지면 블록 전체를 내지 않는다', () => {
        const partial = {
            ...REAL,
            horizons: REAL.horizons.slice(0, 3),
        } as unknown as MeasuredSignalBaseRate;

        expect(buildSignalRecordView(partial)).toBeNull();
    });

    it('기간 순서가 어긋나면 블록 전체를 내지 않는다', () => {
        const shuffled = {
            ...REAL,
            horizons: [...REAL.horizons].reverse(),
        } as unknown as MeasuredSignalBaseRate;

        expect(buildSignalRecordView(shuffled)).toBeNull();
    });

    it('합산 범위에 한 시장이 없으면 내지 않는다', () => {
        const usOnly = {
            ...REAL,
            scope: {
                ...REAL.scope,
                markets: REAL.scope.markets.filter(m => m.market === 'us'),
            },
        };

        expect(buildSignalRecordView(usOnly)).toBeNull();
    });
});

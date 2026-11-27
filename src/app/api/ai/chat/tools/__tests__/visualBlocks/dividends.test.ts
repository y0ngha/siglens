vi.mock('server-only', () => ({}));

const m = vi.hoisted(() => ({ source: vi.fn(), assetOf: vi.fn() }));
vi.mock('@/app/api/ai/chat/tools/dividends', () => ({
    fetchDividendSource: m.source,
}));
vi.mock('@/entities/ticker/server/resolveAssetInfo', () => ({
    resolveAssetInfoOrNull: m.assetOf,
}));

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    buildDividendsBlock,
    DIVIDEND_YEARS_MAX,
    dividendYearsFrom,
} from '@/app/api/ai/chat/tools/visualBlocks/dividends';
import type { MarketProfileId } from '@/shared/config/marketProfile/types';

const env = {
    locale: 'ko' as const,
    userId: 'u',
    allowUnofficialSources: true,
    now: new Date('2026-11-19T12:00:00Z'),
};
const ev = (exDate: string, amount: number) => ({
    exDate,
    amount,
    payDate: null,
});

const asset = (marketProfile?: MarketProfileId) => ({
    symbol: 'X',
    name: 'X Inc',
    ...(marketProfile ? { marketProfile } : {}),
});

beforeEach(() => {
    Object.values(m).forEach(fn => fn.mockReset());
    m.assetOf.mockResolvedValue(asset('us-equity'));
});

describe('dividendYearsFrom', () => {
    it('배당락 연도별로 합산하고 올해는 partial, 오늘 이후 배당락은 뺀다', () => {
        expect(
            dividendYearsFrom(
                [
                    ev('2025-03-01', 0.25),
                    ev('2025-09-01', 0.25),
                    ev('2026-03-01', 0.3),
                    ev('2026-12-15', 0.3),
                ],
                '2026-11-19',
                10
            )
        ).toEqual([
            { year: 2025, amount: 0.5, partial: false },
            { year: 2026, amount: 0.3, partial: true },
        ]);
    });

    it('첫 배당 해부터 올해까지 배당이 없는 해는 0으로 채운다', () => {
        expect(
            dividendYearsFrom([ev('2023-05-01', 1)], '2026-11-19', 10).map(
                y => [y.year, y.amount]
            )
        ).toEqual([
            [2023, 1],
            [2024, 0],
            [2025, 0],
            [2026, 0],
        ]);
    });

    it(`최근 ${DIVIDEND_YEARS_MAX}개 연도만 남기고, 금액은 소수 4자리로 반올림한다`, () => {
        const events = Array.from({ length: 15 }, (_, i) =>
            ev(`${2012 + i}-02-01`, 0.1 + 0.2)
        );
        const years = dividendYearsFrom(
            events,
            '2026-11-19',
            DIVIDEND_YEARS_MAX
        );
        expect(years).toHaveLength(DIVIDEND_YEARS_MAX);
        expect(years[0]?.year).toBe(2017);
        expect(years[0]?.amount).toBe(0.3);
    });

    it('배당이 없으면 빈 배열', () => {
        expect(dividendYearsFrom([], '2026-11-19', 10)).toEqual([]);
        expect(
            dividendYearsFrom([ev('2026-12-01', 1)], '2026-11-19', 10)
        ).toEqual([]);
    });
});

describe('buildDividendsBlock', () => {
    it('미국: FMP 이력으로 블록과 요약을 만든다', async () => {
        m.source.mockResolvedValue({
            kind: 'fmp',
            rows: [ev('2025-04-01', 0.5), ev('2026-04-01', 0.52)],
        });
        const out = await buildDividendsBlock('KO', env);
        if ('error' in out) throw new Error(out.reason);
        expect(m.source).toHaveBeenCalledWith('KO', false);
        expect(out.block).toMatchObject({
            kind: 'dividends',
            symbol: 'KO',
            currency: 'USD',
            years: [
                { year: 2025, amount: 0.5, partial: false },
                { year: 2026, amount: 0.52, partial: true },
            ],
        });
    });

    it('자산 조회가 null이어도 블록을 만들고 통화는 기본 시장(USD)으로 내려간다', async () => {
        m.assetOf.mockResolvedValue(null);
        m.source.mockResolvedValue({
            kind: 'fmp',
            rows: [ev('2026-04-01', 0.52)],
        });
        const out = await buildDividendsBlock('ZZZZ', env);
        if ('error' in out) throw new Error(out.reason);
        expect(out.block).toMatchObject({ kind: 'dividends', currency: 'USD' });
    });

    it('한국: Yahoo 이력(원 단위)으로 만든다', async () => {
        m.assetOf.mockResolvedValue(asset('kr-equity'));
        m.source.mockResolvedValue({
            kind: 'yahoo',
            data: {
                history: [{ exDate: '2026-03-30', amount: 361 }],
                summary: null,
            },
        });
        const out = await buildDividendsBlock('005930.KS', env);
        if ('error' in out) throw new Error(out.reason);
        expect(m.source).toHaveBeenCalledWith('005930.KS', true);
        expect(out.block).toMatchObject({
            currency: 'KRW',
            years: [{ year: 2026, amount: 361 }],
        });
    });

    it('공급자 실패·이력 조회 실패·무배당은 no_data', async () => {
        m.source.mockResolvedValueOnce(null);
        expect(await buildDividendsBlock('KO', env)).toMatchObject({
            reason: 'dividend_history_unavailable',
        });
        m.source.mockResolvedValueOnce({
            kind: 'yahoo',
            data: { history: null, summary: null },
        });
        expect(await buildDividendsBlock('005930.KS', env)).toMatchObject({
            reason: 'dividend_history_unavailable',
        });
        m.source.mockResolvedValueOnce({ kind: 'fmp', rows: [] });
        expect(await buildDividendsBlock('TSLA', env)).toEqual({
            error: 'no_data',
            reason: 'no_dividends_paid',
        });
    });
});

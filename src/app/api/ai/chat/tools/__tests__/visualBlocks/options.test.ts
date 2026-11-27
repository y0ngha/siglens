vi.mock('server-only', () => ({}));

const m = vi.hoisted(() => ({
    tabAllowed: vi.fn(),
    hasMarket: vi.fn(),
    snapshot: vi.fn(),
}));
vi.mock('@/entities/ticker/api', () => ({
    isTabAllowedForSymbol: m.tabAllowed,
}));
vi.mock('@/entities/options-chain/server/optionsDataCache', () => ({
    hasOptionsMarket: m.hasMarket,
    fetchOptionsSnapshot: m.snapshot,
}));

import type {
    OptionsChain,
    OptionsContract,
    OptionsSnapshot,
} from '@y0ngha/siglens-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    buildOptionsBlock,
    OPTIONS_STRIKES_MAX,
    optionsStrikesFrom,
    pickChain,
} from '@/app/api/ai/chat/tools/visualBlocks/options';

const contract = (strike: number, openInterest: number): OptionsContract => ({
    contractSymbol: `X${strike}`,
    strike,
    lastPrice: 1,
    bid: 1,
    ask: 1,
    volume: 0,
    openInterest,
    impliedVolatility: 0.3,
    inTheMoney: false,
});

const chain = (
    expirationDate: string,
    daysToExpiration: number,
    strikes: readonly number[],
    oi = 100
): OptionsChain => ({
    expirationDate,
    daysToExpiration,
    calls: strikes.map(s => contract(s, oi + s)),
    puts: strikes.map(s => contract(s, oi)),
});

const snap = (
    chains: OptionsChain[],
    underlyingPrice = 100
): OptionsSnapshot => ({
    symbol: 'TSLA',
    underlyingPrice,
    chains,
    capturedAt: '2026-11-19T15:00:00.000Z',
});

beforeEach(() => {
    Object.values(m).forEach(fn => fn.mockReset());
    m.tabAllowed.mockResolvedValue(true);
    m.hasMarket.mockResolvedValue(true);
});

describe('pickChain', () => {
    const chains = [
        chain('2026-11-20', 1, [100]),
        chain('2026-11-27', 8, [100]),
        chain('2026-12-18', 29, [100]),
    ];
    it('기본은 7일 이상 남은 가장 가까운 만기', () => {
        expect(pickChain(chains, null)?.expirationDate).toBe('2026-11-27');
    });
    it('7일 이상 남은 만기가 없으면 가장 먼 만기', () => {
        expect(pickChain(chains.slice(0, 1), null)?.expirationDate).toBe(
            '2026-11-20'
        );
    });
    it('지정한 만기가 있으면 그것, 없으면 null', () => {
        expect(pickChain(chains, '2026-12-18')?.daysToExpiration).toBe(29);
        expect(pickChain(chains, '2027-01-01')).toBeNull();
    });
});

describe('optionsStrikesFrom', () => {
    const oi = (strike: number, c = 1, p = 1) => ({
        strike,
        callOpenInterest: c,
        putOpenInterest: p,
    });

    it('기초자산가 ±20% 밖과 미결제약정이 모두 0인 행사가는 뺀다', () => {
        expect(
            optionsStrikesFrom(
                [oi(70), oi(80), oi(100), oi(120), oi(121), oi(110, 0, 0)],
                100
            ).map(r => r.strike)
        ).toEqual([80, 100, 120]);
    });

    it(`${OPTIONS_STRIKES_MAX}개를 넘으면 기초자산가에 가까운 순으로 남기고 행사가 순으로 돌려준다`, () => {
        const rows = Array.from({ length: 100 }, (_, i) => oi(80 + i * 0.4));
        const out = optionsStrikesFrom(rows, 100);
        expect(out).toHaveLength(OPTIONS_STRIKES_MAX);
        expect(out.map(r => r.strike)).toEqual(
            out.map(r => r.strike).toSorted((a, b) => a - b)
        );
        // 가장 먼 행사가(80·120 근처)는 잘리고 100 근처가 남는다.
        expect(out[0]?.strike).toBeGreaterThan(85);
        expect(out.at(-1)?.strike).toBeLessThan(115);
    });
});

describe('buildOptionsBlock', () => {
    it('만기 하나의 행사가별 콜·풋 OI와 맥스페인·풋콜 비율을 싣는다', async () => {
        m.snapshot.mockResolvedValue(
            snap([chain('2026-11-27', 8, [90, 100, 110])])
        );
        const out = await buildOptionsBlock('TSLA', null);
        if ('error' in out) throw new Error(out.reason);
        expect(out.block).toMatchObject({
            kind: 'options',
            symbol: 'TSLA',
            expiry: '2026-11-27',
            underlyingPrice: 100,
            asOf: '2026-11-19T15:00:00.000Z',
            strikes: [
                { strike: 90, callOI: 190, putOI: 100 },
                { strike: 100, callOI: 200, putOI: 100 },
                { strike: 110, callOI: 210, putOI: 100 },
            ],
        });
        expect(out.summary).toMatchObject({
            daysToExpiration: 8,
            strikesShown: 3,
            topCallOpenInterest: [
                { strike: 110, openInterest: 210 },
                expect.anything(),
                expect.anything(),
            ],
        });
    });

    it('옵션 탭이 없는 종목·옵션 시장이 없는 종목은 no_data(스냅샷을 읽지 않는다)', async () => {
        m.tabAllowed.mockResolvedValueOnce(false);
        expect(await buildOptionsBlock('005930.KS', null)).toMatchObject({
            error: 'no_data',
        });
        m.hasMarket.mockResolvedValueOnce(false);
        expect(await buildOptionsBlock('XYZ', null)).toEqual({
            error: 'no_data',
            reason: 'no_options_market',
        });
        expect(m.snapshot).not.toHaveBeenCalled();
    });

    it('스냅샷이 없거나 만기가 없으면 no_data', async () => {
        m.snapshot.mockResolvedValueOnce(null);
        expect(await buildOptionsBlock('TSLA', null)).toMatchObject({
            reason: 'no_snapshot',
        });
        m.snapshot.mockResolvedValueOnce(snap([]));
        expect(await buildOptionsBlock('TSLA', null)).toMatchObject({
            reason: 'no_snapshot',
        });
    });

    it('지정한 만기가 없으면 가능한 만기를 사유에 싣는다', async () => {
        m.snapshot.mockResolvedValue(snap([chain('2026-11-27', 8, [100])]));
        const out = await buildOptionsBlock('TSLA', '2027-06-18');
        expect(out).toMatchObject({ error: 'no_data' });
        expect('reason' in out && out.reason).toContain('2026-11-27');
    });

    it('가격 근처에 미결제약정이 없으면 no_data', async () => {
        m.snapshot.mockResolvedValue(
            snap([chain('2026-11-27', 8, [10, 500], 0)])
        );
        expect(await buildOptionsBlock('TSLA', null)).toEqual({
            error: 'no_data',
            reason: 'no_open_interest_near_the_price',
        });
    });
});

import type { TreasuryRateSnapshot } from '@y0ngha/siglens-core';
import { describe, expect, it, vi } from 'vitest';
import type { EconomyProvider } from '../EconomyProvider';
import {
    OfficialTreasuryEconomyProvider,
    pickTreasury,
} from '../OfficialTreasuryEconomyProvider';

vi.mock('server-only', () => ({}));

const snap = (date: string, year10: number): TreasuryRateSnapshot => ({
    date,
    year2: 4.5,
    year10,
});

function baseWith(getTreasury: EconomyProvider['getTreasury']) {
    return {
        getIndicator: vi.fn(async () => ({ name: 'x', points: [] }) as never),
        getCalendar: vi.fn(async () => []),
        getTreasury: vi.fn(getTreasury),
    } satisfies EconomyProvider;
}

const NOW = new Date('2026-10-23T01:38:00Z'); // 2026-10-22 21:38 ET

describe('OfficialTreasuryEconomyProvider.getTreasury', () => {
    it('FMP가 이틀 늦으면 재무부의 더 최근 값을 낸다(2026-10-23 실측 상황)', async () => {
        const official = vi.fn(async () => snap('2026-10-22', 4.96));
        const p = new OfficialTreasuryEconomyProvider(
            baseWith(async () => snap('2026-10-20', 5.12)),
            official,
            () => NOW
        );
        expect(await p.getTreasury()).toEqual(snap('2026-10-22', 4.96));
        expect(official).toHaveBeenCalledWith(NOW);
    });

    it('FMP가 더 최근이면 FMP, 같은 날이면 재무부', async () => {
        const newerVendor = new OfficialTreasuryEconomyProvider(
            baseWith(async () => snap('2026-10-23', 4.9)),
            async () => snap('2026-10-22', 4.96),
            () => NOW
        );
        expect((await newerVendor.getTreasury())?.date).toBe('2026-10-23');
        const sameDay = new OfficialTreasuryEconomyProvider(
            baseWith(async () => snap('2026-10-22', 4.97)),
            async () => snap('2026-10-22', 4.96),
            () => NOW
        );
        expect((await sameDay.getTreasury())?.year10).toBe(4.96);
    });

    it('재무부가 실패하면 FMP 값으로 물러나고 오류 이름만 남긴다', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const p = new OfficialTreasuryEconomyProvider(
            baseWith(async () => snap('2026-10-20', 5.12)),
            async () => {
                throw new TypeError('fetch failed');
            },
            () => NOW
        );
        expect(await p.getTreasury()).toEqual(snap('2026-10-20', 5.12));
        expect(warn).toHaveBeenCalledWith(
            '[economy] treasury.gov read failed',
            {
                error: 'TypeError',
            }
        );
        warn.mockRestore();
    });

    it('FMP가 실패해도 재무부 값이 있으면 그 값을 내고 FMP 실패 이름을 남긴다', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const p = new OfficialTreasuryEconomyProvider(
            baseWith(async () => {
                throw new Error('fmp down');
            }),
            async () => snap('2026-10-22', 4.96),
            () => NOW
        );
        expect((await p.getTreasury())?.date).toBe('2026-10-22');
        expect(warn).toHaveBeenCalledWith(
            '[economy] FMP treasury-rates read failed',
            { error: 'Error' }
        );
        warn.mockRestore();
    });

    it('재무부가 상한 시간 안에 답하지 않으면 기다리지 않고 FMP 값을 낸다', async () => {
        vi.useFakeTimers();
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const p = new OfficialTreasuryEconomyProvider(
            baseWith(async () => snap('2026-10-20', 5.12)),
            () => new Promise(() => {}), // never settles
            () => NOW,
            6_000
        );
        const pending = p.getTreasury();
        await vi.advanceTimersByTimeAsync(6_000);
        expect(await pending).toEqual(snap('2026-10-20', 5.12));
        expect(warn).toHaveBeenCalledWith(
            '[economy] treasury.gov read failed',
            {
                error: 'OfficialTreasuryTimeoutError',
            }
        );
        vi.useRealTimers();
        warn.mockRestore();
    });

    it('둘 다 값이 없고 FMP가 실패했으면 FMP 오류를 그대로 던진다', async () => {
        const boom = new Error('fmp down');
        const p = new OfficialTreasuryEconomyProvider(
            baseWith(async () => {
                throw boom;
            }),
            async () => null,
            () => NOW
        );
        await expect(p.getTreasury()).rejects.toBe(boom);
    });

    it('재무부가 200인데 쓸 행이 없으면 경고를 남기고 FMP 값을 낸다', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const p = new OfficialTreasuryEconomyProvider(
            baseWith(async () => snap('2026-10-20', 5.12)),
            async () => null,
            () => NOW
        );
        expect((await p.getTreasury())?.date).toBe('2026-10-20');
        expect(warn).toHaveBeenCalledWith(
            '[economy] treasury.gov returned no usable row'
        );
        warn.mockRestore();
    });

    it('둘 다 실패하면 FMP 오류를 던진다', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const boom = new Error('fmp down');
        const p = new OfficialTreasuryEconomyProvider(
            baseWith(async () => {
                throw boom;
            }),
            async () => {
                throw new TypeError('fetch failed');
            },
            () => NOW
        );
        await expect(p.getTreasury()).rejects.toBe(boom);
        warn.mockRestore();
    });

    it('HTTP 오류는 상태 코드를 함께 남긴다', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const err = Object.assign(new Error('treasury.gov 403'), {
            name: 'TreasuryGovHttpError',
            status: 403,
        });
        const p = new OfficialTreasuryEconomyProvider(
            baseWith(async () => snap('2026-10-20', 5.12)),
            async () => {
                throw err;
            },
            () => NOW
        );
        await p.getTreasury();
        expect(warn).toHaveBeenCalledWith(
            '[economy] treasury.gov read failed',
            {
                error: 'TreasuryGovHttpError',
                status: 403,
            }
        );
        warn.mockRestore();
    });

    it('지표·캘린더는 그대로 위임한다', async () => {
        const base = baseWith(async () => null);
        const p = new OfficialTreasuryEconomyProvider(base, async () => null);
        await p.getIndicator('GDP');
        await p.getCalendar('2026-10-01', '2026-10-31');
        expect(base.getIndicator).toHaveBeenCalledWith('GDP');
        expect(base.getCalendar).toHaveBeenCalledWith(
            '2026-10-01',
            '2026-10-31'
        );
    });
});

describe('pickTreasury', () => {
    it('10년물이 빈 더 새 행은 완전한 행을 이기지 않는다', () => {
        const official = snap('2026-10-22', 4.96);
        const vendor = { date: '2026-10-23', year2: 4.6, year10: null };
        expect(pickTreasury(official, vendor)).toEqual(official);
    });

    it('같은 날이면 재무부를 쓰되 빈 2년물은 FMP 값으로 채운다', () => {
        expect(
            pickTreasury(
                { date: '2026-10-22', year2: null, year10: 4.96 },
                { date: '2026-10-22', year2: 4.65, year10: 4.97 }
            )
        ).toEqual({ date: '2026-10-22', year2: 4.65, year10: 4.96 });
    });

    it('날짜가 다르면 2년물을 다른 날 값으로 채우지 않는다', () => {
        expect(
            pickTreasury(
                { date: '2026-10-22', year2: null, year10: 4.96 },
                { date: '2026-10-20', year2: 4.79, year10: 5.12 }
            )
        ).toEqual({ date: '2026-10-22', year2: null, year10: 4.96 });
    });

    it('둘 다 10년물이 없으면 있는 쪽을 그대로 낸다', () => {
        const partial = { date: '2026-10-22', year2: 4.6, year10: null };
        expect(pickTreasury(null, partial)).toEqual(partial);
        expect(pickTreasury(null, null)).toBeNull();
    });
});

import type { TreasuryRateSnapshot } from '@y0ngha/siglens-core';
import { describe, expect, it, vi } from 'vitest';
import type { EconomyProvider } from '../EconomyProvider';
import {
    easternYear,
    OfficialTreasuryEconomyProvider,
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
        expect(official).toHaveBeenCalledWith(2026);
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

    it('FMP가 실패해도 재무부 값이 있으면 그 값을 낸다', async () => {
        const p = new OfficialTreasuryEconomyProvider(
            baseWith(async () => {
                throw new Error('fmp down');
            }),
            async () => snap('2026-10-22', 4.96),
            () => NOW
        );
        expect((await p.getTreasury())?.date).toBe('2026-10-22');
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

describe('easternYear', () => {
    it('UTC로는 새해여도 ET 자정 전이면 전년도', () => {
        expect(easternYear(new Date('2027-01-01T03:00:00Z'))).toBe(2026);
        expect(easternYear(new Date('2027-01-01T06:00:00Z'))).toBe(2027);
    });
});

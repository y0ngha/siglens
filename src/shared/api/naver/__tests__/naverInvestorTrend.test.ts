import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
    fetchNaverInvestorTrend,
    parseNaverInvestorTrend,
    parseNaverNumber,
} from '@/shared/api/naver/naverInvestorTrend';

const item = (bizdate: string, over: Record<string, unknown> = {}) => ({
    itemCode: '005930',
    bizdate,
    foreignerPureBuyQuant: '-868,997',
    foreignerHoldRatio: '46.11%',
    organPureBuyQuant: '+627,670',
    individualPureBuyQuant: '-61,043',
    closePrice: '213,500',
    accumulatedTradingVolume: '16,019,854',
    ...over,
});

describe('parseNaverNumber', () => {
    it('strips commas and reads +/- signs', () => {
        expect(parseNaverNumber('-868,997')).toBe(-868_997);
        expect(parseNaverNumber('+627,670')).toBe(627_670);
        expect(parseNaverNumber('213,500')).toBe(213_500);
        expect(parseNaverNumber('0')).toBe(0);
    });

    it('is null for anything that is not a plain number string', () => {
        expect(parseNaverNumber('46.11%')).toBeNull();
        expect(parseNaverNumber('')).toBeNull();
        expect(parseNaverNumber(undefined)).toBeNull();
        expect(parseNaverNumber(12)).toBeNull();
    });
});

describe('parseNaverInvestorTrend', () => {
    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('maps fields, formats the date and orders newest first', () => {
        const rows = parseNaverInvestorTrend([
            item('20261022', { closePrice: '214,500' }),
            item('20261023'),
        ]);
        expect(rows[0]).toEqual({
            date: '2026-10-23',
            foreignNet: -868_997,
            institutionNet: 627_670,
            individualNet: -61_043,
            close: 213_500,
        });
        expect(rows.map(r => r.date)).toEqual(['2026-10-23', '2026-10-22']);
    });

    it('keeps an unreadable individual / close as null', () => {
        const [row] = parseNaverInvestorTrend([
            item('20261023', {
                individualPureBuyQuant: undefined,
                closePrice: 'n/a',
            }),
        ]);
        expect(row!.individualNet).toBeNull();
        expect(row!.close).toBeNull();
    });

    it.each([
        ['non-array', { a: 1 }],
        ['only a bad bizdate', [item('2026-10-23')]],
        [
            'only an unreadable foreign net',
            [item('20261023', { foreignerPureBuyQuant: '-' })],
        ],
        [
            'only an unreadable institution net',
            [item('20261023', { organPureBuyQuant: null })],
        ],
    ])('throws when the body is %s (no readable row)', (_label, body) => {
        expect(() => parseNaverInvestorTrend(body)).toThrow();
    });
});

describe('parseNaverInvestorTrend partial and empty bodies', () => {
    it('an empty array is an empty result, not a failure', () => {
        expect(parseNaverInvestorTrend([])).toEqual([]);
    });

    it('drops an unreadable row, keeps the rest and logs the count once', () => {
        const log = vi.spyOn(console, 'error').mockImplementation(() => {});
        const rows = parseNaverInvestorTrend([
            item('20261023'),
            item('20261022', { foreignerPureBuyQuant: '-' }),
            item('20261021', { organPureBuyQuant: undefined }),
            item('20261020'),
        ]);
        expect(rows.map(r => r.date)).toEqual(['2026-10-23', '2026-10-20']);
        expect(log).toHaveBeenCalledTimes(1);
        log.mockRestore();
    });
});

describe('fetchNaverInvestorTrend', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('requests 20 rows for the code and parses the body', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => [item('20261023')],
        });
        vi.stubGlobal('fetch', fetchMock);
        const rows = await fetchNaverInvestorTrend('005930');
        expect(fetchMock.mock.calls[0]![0]).toBe(
            'https://m.stock.naver.com/api/stock/005930/trend?pageSize=20'
        );
        expect(rows).toHaveLength(1);
    });

    it('throws on a non-OK status and on a malformed body', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({ ok: false, status: 503 })
        );
        await expect(fetchNaverInvestorTrend('005930')).rejects.toThrow('503');
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
        );
        await expect(fetchNaverInvestorTrend('005930')).rejects.toThrow();
    });

    it('rejects a code that is not a 6-char stock code before any request', async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        await expect(fetchNaverInvestorTrend('../x')).rejects.toThrow();
        expect(fetchMock).not.toHaveBeenCalled();
    });
});

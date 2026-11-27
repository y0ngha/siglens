const { getQuotes, getQuote, getCloses } = vi.hoisted(() => ({
    getQuotes: vi.fn(),
    getQuote: vi.fn(),
    getCloses: vi.fn(),
}));
vi.mock('@/shared/api/yahoo/yahooMacroSource', () => ({
    getYahooMacroQuotes: getQuotes,
    getYahooMacroDailyCloses: getCloses,
}));

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    arrayAt,
    keysAt,
    numberAt,
    readAt,
    stringAt,
} from '@/shared/test-utils/readAt';
import {
    AGENT_MACRO_INSTRUMENTS,
    AGENT_MACRO_QUOTES_MAX,
} from '@y0ngha/siglens-core';
import { MACRO_QUOTES_RESULT_MAX_CHARS } from '@/app/api/ai/chat/tools/truncate';
import type {
    YahooDailyClose,
    YahooMacroDaily,
    YahooMacroQuote,
} from '@/shared/api/yahoo/yahooMacroSource';

import { getMacroQuotesTool } from '@/app/api/ai/chat/tools/getMacroQuotes';

const ctx = {
    userId: 'u',
    tier: 'member' as const,
    locale: 'ko' as const,
    signal: new AbortController().signal,
};
const rt = {
    analysisModel: 'deepseek-v4.1-flash' as const,
    ensureSymbolData: async (): Promise<void> => {},
};

/** 2026-11-15 `CL=F` 실측. */
const CL: YahooMacroQuote = {
    name: 'Crude Oil Dec 26',
    price: 88.56,
    changePct: -0.2,
    currency: 'USD',
    delayMinutes: 10,
    timeIso: '2026-11-14T21:59:00.000Z',
    quoteType: 'FUTURE',
    contractExpiryIso: '2026-11-20T00:00:00.000Z',
};
/** 2026-11-15 `KRW=X` 실측. */
const KRW: YahooMacroQuote = {
    name: 'USD/KRW',
    price: 1336.2,
    changePct: 0.1,
    currency: 'KRW',
    delayMinutes: 0,
    timeIso: '2026-11-14T22:00:00.000Z',
    quoteType: 'CURRENCY',
    contractExpiryIso: null,
};

/** 오래된 순 평일 일봉 ~400일(종가는 완만한 파동). */
function dailyCloses(base: number): YahooMacroDaily {
    const rows: YahooDailyClose[] = [];
    const end = Date.parse('2026-11-13T00:00:00Z');
    for (let d = 400; d >= 0; d--) {
        const t = new Date(end - d * 86_400_000);
        if ([0, 6].includes(t.getUTCDay())) continue;
        const close = base * (1 + 0.1 * Math.sin(d / 30));
        rows.push({
            date: t.toISOString().slice(0, 10),
            close,
            high: close * 1.01,
            low: close * 0.99,
        });
    }
    return { timeZone: 'America/New_York', rows };
}

const run = (instruments: unknown) =>
    getMacroQuotesTool({ instruments }, ctx, rt) as Promise<unknown>;

const quoteCallFor = (symbol: string) =>
    getQuote.mock.calls.find(([s]) => s === symbol);

describe('getMacroQuotesTool', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // 기본값은 거부 — 심볼 매핑을 빠뜨린 호출이 조용히 통과하지 않는다.
        getQuote.mockRejectedValue(new Error('unmapped symbol'));
        getCloses.mockRejectedValue(new Error('unmapped symbol'));
        // 묶음 소스의 계약: 심볼별로 시세 또는 null(한 심볼의 실패가 나머지를 비우지 않는다).
        getQuotes.mockImplementation(async (symbols: string[]) => {
            const entries = await Promise.all(
                symbols.map(async s => {
                    try {
                        return [s, await getQuote(s)] as const;
                    } catch {
                        return [s, null] as const;
                    }
                })
            );
            return new Map(entries);
        });
    });

    it('상한은 8이고 17개 키가 전부 매핑돼 있다', async () => {
        expect(AGENT_MACRO_QUOTES_MAX).toBe(8);
        getQuote.mockResolvedValue(KRW);
        getCloses.mockResolvedValue(null);
        for (const key of AGENT_MACRO_INSTRUMENTS) {
            const r = await run([key]);
            expect(readAt(r, 'quotes', 0)).toMatchObject({
                instrument: key,
                found: true,
            });
        }
    });

    it.each([
        ['wti', 'CL=F', 'USD per barrel'],
        ['brent', 'BZ=F', 'USD per barrel'],
        ['gold', 'GC=F', 'USD per troy ounce'],
        ['silver', 'SI=F', 'USD per troy ounce'],
        ['copper', 'HG=F', 'USD per pound'],
        ['natural_gas', 'NG=F', 'USD per MMBtu'],
        ['sp500_futures', 'ES=F', 'index points'],
        ['nasdaq100_futures', 'NQ=F', 'index points'],
        ['dow_futures', 'YM=F', 'index points'],
        ['russell2000_futures', 'RTY=F', 'index points'],
        ['dollar_index', 'DX-Y.NYB', 'index'],
        ['usd_krw', 'KRW=X', 'KRW per USD'],
        ['jpy_krw', 'JPYKRW=X', 'KRW per JPY'],
        ['eur_krw', 'EURKRW=X', 'KRW per EUR'],
        ['cny_krw', 'CNYKRW=X', 'KRW per CNY'],
        ['usd_jpy', 'JPY=X', 'JPY per USD'],
        ['eur_usd', 'EURUSD=X', 'USD per EUR'],
    ])('%s -> %s (%s)', async (key, yahooSymbol, unit) => {
        getQuote.mockResolvedValue(KRW);
        getCloses.mockResolvedValue(null);
        const r = await run([key]);
        expect(quoteCallFor(yahooSymbol)).toBeDefined();
        expect(readAt(r, 'quotes', 0, 'unit')).toBe(unit);
    });

    it('빈 배열·열거 밖 값뿐이면 no_instruments', async () => {
        expect(await run([])).toEqual({ error: 'no_instruments' });
        expect(await run(['nope'])).toEqual({ error: 'no_instruments' });
        expect(await run(undefined)).toEqual({ error: 'no_instruments' });
        expect(getQuote).not.toHaveBeenCalled();
    });

    it('시세는 심볼을 묶어 한 번만 요청한다(항목마다 요청하지 않는다)', async () => {
        getQuote.mockResolvedValue(CL);
        getCloses.mockResolvedValue(null);
        await run(['wti', 'gold', 'usd_krw']);
        expect(getQuotes).toHaveBeenCalledTimes(1);
        expect(getQuotes).toHaveBeenCalledWith(['CL=F', 'GC=F', 'KRW=X']);
    });

    it('묶음 요청 자체가 거부되면 모든 항목이 found:false(도구는 실패하지 않는다)', async () => {
        const err = vi.spyOn(console, 'error').mockImplementation(() => {});
        getQuotes.mockRejectedValue(new Error('429'));
        getCloses.mockResolvedValue(null);
        const r = await run(['wti', 'gold']);
        expect(readAt(r, 'quotes')).toEqual([
            { instrument: 'wti', found: false },
            { instrument: 'gold', found: false },
        ]);
        err.mockRestore();
    });

    it('시세 날짜는 일봉과 같은 시간대로 읽는다: 런던 서머타임 자정 직후의 시세는 현지 7/1 기준', async () => {
        // 2025-06-30T23:30Z = 런던(BST) 2025-07-01 00:30. UTC로 읽으면 6/30이라 1주 전 기준일이 하루 어긋난다.
        getQuote.mockResolvedValue({
            ...KRW,
            timeIso: '2025-06-30T23:30:00.000Z',
        });
        getCloses.mockResolvedValue({
            timeZone: 'Europe/London',
            rows: [
                { date: '2025-06-23', close: 1300, high: 1310, low: 1290 },
                { date: '2025-06-24', close: 1310, high: 1320, low: 1300 },
                { date: '2025-06-30', close: 1330, high: 1340, low: 1320 },
            ],
        });
        const q = readAt(await run(['usd_krw']), 'quotes', 0);
        // 현지 날짜 7/1 − 7일 = 6/24 → 6/24 행이 기준. (UTC 날짜 6/30 − 7일 = 6/23이면 6/23 행이 되었을 것)
        expect(readAt(q, 'changes', '1week')).toMatchObject({
            baseDate: '2025-06-24',
            baseClose: 1310,
        });
    });

    it('중복 제거 후 상한 이하면 처리한다(중복 때문에 거절하지 않는다)', async () => {
        getQuote.mockResolvedValue(CL);
        getCloses.mockResolvedValue(null);
        const r = await run(['wti', 'wti', 'wti']);
        expect(readAt(r, 'quotes')).toHaveLength(1);
        expect(getQuote).toHaveBeenCalledTimes(1);
    });

    it('중복 제거 후 8개 초과면 아무것도 받지 않고 too_many_instruments', async () => {
        const nine = AGENT_MACRO_INSTRUMENTS.slice(0, 9);
        expect(await run(nine)).toEqual({
            error: 'too_many_instruments',
            max: AGENT_MACRO_QUOTES_MAX,
        });
        expect(getQuote).not.toHaveBeenCalled();
        expect(getCloses).not.toHaveBeenCalled();
    });

    it('정확히 8개는 받는다', async () => {
        getQuote.mockResolvedValue(CL);
        getCloses.mockResolvedValue(null);
        const r = await run(AGENT_MACRO_INSTRUMENTS.slice(0, 8));
        expect(readAt(r, 'quotes')).toHaveLength(8);
    });

    it('선물: 계약명·만기(YYYY-MM-DD)·지연·시세 시각을 싣는다', async () => {
        getQuote.mockImplementation(async (s: string) =>
            s === 'CL=F' ? CL : null
        );
        getCloses.mockResolvedValue(dailyCloses(88));
        const r = await run(['wti']);
        expect(readAt(r, 'source')).toBe(
            'Yahoo Finance (futures and FX quotes, delayed)'
        );
        expect(readAt(r, 'quotes', 0)).toMatchObject({
            instrument: 'wti',
            found: true,
            name: 'Crude Oil Dec 26',
            price: 88.56,
            changePct: -0.2,
            unit: 'USD per barrel',
            currency: 'USD',
            contract: { name: 'Crude Oil Dec 26', expiry: '2026-11-20' },
            quoteDelayMinutes: 10,
            asOf: '2026-11-14T21:59:00.000Z',
        });
    });

    it('환율: contract는 null이고 지연 0은 0으로 남는다(null로 바뀌지 않는다)', async () => {
        getQuote.mockResolvedValue(KRW);
        getCloses.mockResolvedValue(null);
        const q = readAt(await run(['usd_krw']), 'quotes', 0);
        expect(readAt(q, 'contract')).toBeNull();
        expect(readAt(q, 'quoteDelayMinutes')).toBe(0);
        expect(readAt(q, 'currency')).toBe('KRW');
    });

    it('지연 정보가 없으면 quoteDelayMinutes는 null', async () => {
        getQuote.mockResolvedValue({ ...KRW, delayMinutes: null });
        getCloses.mockResolvedValue(null);
        expect(
            readAt(await run(['usd_krw']), 'quotes', 0, 'quoteDelayMinutes')
        ).toBeNull();
    });

    it('만기가 없는 선물은 expiry null', async () => {
        getQuote.mockResolvedValue({ ...CL, contractExpiryIso: null });
        getCloses.mockResolvedValue(null);
        expect(readAt(await run(['wti']), 'quotes', 0, 'contract')).toEqual({
            name: 'Crude Oil Dec 26',
            expiry: null,
        });
    });

    it('일봉이 있으면 changes 4종과 range52w를 계산한다', async () => {
        getQuote.mockResolvedValue(CL);
        getCloses.mockResolvedValue(dailyCloses(88));
        const q = readAt(await run(['wti']), 'quotes', 0);
        expect(keysAt(q, 'changes')).toEqual([
            '1week',
            '1month',
            '3months',
            '1year',
        ]);
        expect(readAt(q, 'changes', '1week')).toMatchObject({
            baseDate: expect.any(String),
        });
        expect(
            stringAt(q, 'changes', '1week', 'baseDate') <= '2026-11-07'
        ).toBe(true);
        expect(numberAt(q, 'range52w', 'high')).toBeGreaterThan(
            numberAt(q, 'range52w', 'low')
        );
        expect(readAt(q, 'range52w', 'highDate')).toMatch(
            /^\d{4}-\d{2}-\d{2}$/
        );
    });

    it('일봉을 못 받으면 시세만 돌려주고 changes·range52w는 null', async () => {
        getQuote.mockResolvedValue(CL);
        getCloses.mockResolvedValue(null);
        const q = readAt(await run(['wti']), 'quotes', 0);
        expect(readAt(q, 'found')).toBe(true);
        expect(readAt(q, 'price')).toBe(88.56);
        expect(readAt(q, 'changes')).toBeNull();
        expect(readAt(q, 'range52w')).toBeNull();
    });

    it('시세가 없으면 { instrument, found: false }', async () => {
        getQuote.mockResolvedValue(null);
        getCloses.mockResolvedValue(dailyCloses(1));
        expect(readAt(await run(['gold']), 'quotes', 0)).toEqual({
            instrument: 'gold',
            found: false,
        });
    });

    it('한 항목이 던져도 나머지는 살아 있다', async () => {
        const err = vi.spyOn(console, 'error').mockImplementation(() => {});
        getQuote.mockImplementation(async (s: string) => {
            if (s === 'GC=F') throw new Error('boom');
            return s === 'CL=F' ? CL : KRW;
        });
        getCloses.mockResolvedValue(null);
        const r = await run(['wti', 'gold', 'usd_krw']);
        expect(
            arrayAt(r, 'quotes').map(q => [
                readAt(q, 'instrument'),
                readAt(q, 'found'),
            ])
        ).toEqual([
            ['wti', true],
            ['gold', false],
            ['usd_krw', true],
        ]);
        err.mockRestore();
    });

    it('8종목 실제 형태 결과가 전용 상한(MACRO_QUOTES_RESULT_MAX_CHARS) 안이다', async () => {
        const keys = AGENT_MACRO_INSTRUMENTS.slice(0, 8);
        getQuote.mockImplementation(async (s: string) =>
            s.endsWith('=X')
                ? KRW
                : { ...CL, price: 1234.5678, name: `Front Month ${s} Dec 26` }
        );
        getCloses.mockImplementation(async () => dailyCloses(1234.5678));
        const size = JSON.stringify(await run(keys)).length;
        // 2026-11-15 실측: 8종목 5,627자(truncate.ts 주석과 같은 값).
        expect(size).toBeLessThan(MACRO_QUOTES_RESULT_MAX_CHARS);
        expect(size).toBeGreaterThan(4_000);
    });
});

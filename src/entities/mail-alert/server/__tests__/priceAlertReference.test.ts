const m = vi.hoisted(() => ({
    getQuote: vi.fn(),
    bars: vi.fn(),
}));
vi.mock('@/shared/api/market/getCachedMarketDataProvider', () => ({
    getCachedMarketDataProvider: () => ({ getQuote: m.getQuote }),
}));
vi.mock('@/entities/bars/server/barsDataCache', () => ({
    getCachedBarsWithIndicators: m.bars,
}));

import { readPriceAlertReference } from '@/entities/mail-alert/server/priceAlertReference';

const NOW = new Date('2026-11-25T15:00:00Z');
const input = {
    symbol: 'AAPL',
    quoteSymbol: 'AAPL',
    profile: 'us-equity' as const,
    startsAfterSession: '2026-11-24',
    now: NOW,
};
const bar = (date: string, close: number) => ({
    time: Date.parse(`${date}T00:00:00Z`) / 1000,
    open: close,
    high: close,
    low: close,
    close,
    volume: 1,
});
const sec = (iso: string) => Math.floor(Date.parse(iso) / 1000);

beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('readPriceAlertReference', () => {
    it('기준 종가는 시작 세션의 일봉 종가다 — 장중 +70% 시세여도 분할 판정과 같은 척도다', async () => {
        m.getQuote.mockResolvedValue({
            price: 170,
            changesPercentage: 70,
            timestamp: sec('2026-11-25T14:50:00Z'),
        });
        m.bars.mockResolvedValue({
            bars: [
                bar('2026-11-23', 99),
                bar('2026-11-24', 100),
                bar('2026-11-25', 170),
            ],
        });

        const reference = await readPriceAlertReference(input);

        expect(reference).toEqual({
            price: 170,
            quoteAt: '2026-11-25T14:50:00.000Z',
            referenceClose: 100,
        });
        // 발송기: 지금 읽은 일봉의 그 세션 종가 / 저장된 기준 종가가 1이라 가드에 걸리지 않는다.
        expect(100 / (reference?.referenceClose ?? 1)).toBe(1);
    });

    it('시세가 일봉 읽기 인자(시세 심볼)와 일봉 주기로 일봉을 읽는다', async () => {
        m.getQuote.mockResolvedValue({ price: 10, changesPercentage: 0 });
        m.bars.mockResolvedValue({ bars: [bar('2026-11-24', 9)] });

        await readPriceAlertReference({ ...input, quoteSymbol: '^GSPC' });

        expect(m.bars).toHaveBeenCalledWith(
            expect.anything(),
            'AAPL',
            '1Day',
            '^GSPC',
            expect.anything()
        );
    });

    it('시작 세션의 봉이 없으면 장중 시세를 등락률로 거꾸로 계산해 전 세션 종가를 쓴다', async () => {
        m.getQuote.mockResolvedValue({
            price: 170,
            changesPercentage: 70,
            timestamp: sec('2026-11-25T14:50:00Z'),
        });
        m.bars.mockResolvedValue({ bars: [bar('2026-11-20', 90)] });

        const reference = await readPriceAlertReference(input);

        expect(reference?.referenceClose).toBeCloseTo(100, 6);
    });

    it('봉을 못 읽어도(던짐) 같은 대체를 쓴다', async () => {
        m.getQuote.mockResolvedValue({
            price: 110,
            changesPercentage: 10,
            timestamp: sec('2026-11-25T14:50:00Z'),
        });
        m.bars.mockRejectedValue(new Error('bars down'));

        const reference = await readPriceAlertReference(input);

        expect(reference?.referenceClose).toBeCloseTo(100, 6);
    });

    it('시세가 시작 세션 마감 이후의 것이면(장 마감 후) 시세 자체가 그 종가다', async () => {
        m.getQuote.mockResolvedValue({
            price: 150,
            changesPercentage: 5,
            timestamp: sec('2026-11-24T21:30:00Z'),
        });
        m.bars.mockResolvedValue({ bars: [] });

        const reference = await readPriceAlertReference(input);

        expect(reference?.referenceClose).toBe(150);
    });

    it.each([
        ['시세 없음', null],
        ['0 이하 가격', { price: 0, changesPercentage: 0 }],
    ])('%s → null', async (_label, quote) => {
        m.getQuote.mockResolvedValue(quote);
        m.bars.mockResolvedValue({ bars: [bar('2026-11-24', 100)] });

        await expect(readPriceAlertReference(input)).resolves.toBeNull();
    });

    it('시세 읽기가 던지면 null이고 던지지 않는다', async () => {
        m.getQuote.mockRejectedValue(new Error('provider down'));

        await expect(readPriceAlertReference(input)).resolves.toBeNull();
    });

    it('종가를 알 수 없으면(봉 없음, 등락률 -100% 이하) null이다', async () => {
        m.getQuote.mockResolvedValue({
            price: 10,
            changesPercentage: -100,
            timestamp: sec('2026-11-25T14:50:00Z'),
        });
        m.bars.mockResolvedValue({ bars: [] });

        await expect(readPriceAlertReference(input)).resolves.toBeNull();
    });
});

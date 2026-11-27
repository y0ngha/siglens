import type { Bar, MarketQuote } from '@y0ngha/siglens-core';
import { PacedMarketProvider } from '@/shared/api/market/PacedMarketProvider';
import type {
    QuoteSnapshot,
    SiglensMarketProvider,
} from '@/shared/api/market/marketProvider.types';
import type { StartSpacer } from '@/shared/lib/startSpacer';

const BAR: Bar = {
    time: 1,
    open: 1,
    high: 1,
    low: 1,
    close: 1,
    volume: 1,
};
const QUOTE = { price: 1 } as MarketQuote;
const SNAPSHOT: QuoteSnapshot = { quote: QUOTE, todayBar: BAR };

function setup() {
    const inner: SiglensMarketProvider = {
        getBars: vi.fn(async () => [BAR]),
        getQuote: vi.fn(async () => QUOTE),
        getTodayBar: vi.fn(async () => BAR),
        getQuoteSnapshot: vi.fn(async () => SNAPSHOT),
    };
    const spacer: StartSpacer = {
        next: vi.fn(async () => {}),
    };
    return { inner, spacer, paced: new PacedMarketProvider(inner, spacer) };
}

describe('PacedMarketProvider', () => {
    it('모든 메서드가 안쪽 provider의 결과를 그대로 돌려준다', async () => {
        const { paced } = setup();

        await expect(
            paced.getBars({ symbol: 'A', timeframe: '1Day' })
        ).resolves.toEqual([BAR]);
        await expect(paced.getQuote('A')).resolves.toBe(QUOTE);
        await expect(paced.getTodayBar('A')).resolves.toBe(BAR);
        await expect(paced.getQuoteSnapshot('A')).resolves.toBe(SNAPSHOT);
    });

    it('호출마다 안쪽을 부르기 전에 간격 자리를 기다린다', async () => {
        const { inner, spacer, paced } = setup();

        await paced.getBars({ symbol: 'A', timeframe: '1Day' });

        const [spacerOrder] = vi.mocked(spacer.next).mock.invocationCallOrder;
        const [innerOrder] = vi.mocked(inner.getBars).mock.invocationCallOrder;
        expect(spacerOrder).toBeLessThan(innerOrder ?? 0);
    });

    it('안쪽으로 내보낸 호출 수를 센다', async () => {
        const { paced } = setup();
        expect(paced.upstreamCalls()).toBe(0);

        await paced.getBars({ symbol: 'A', timeframe: '1Day' });
        await paced.getQuote('A');
        await paced.getQuoteSnapshot('A');
        await paced.getTodayBar('A');

        expect(paced.upstreamCalls()).toBe(4);
    });

    it('안쪽의 거절을 그대로 넘기고 오류를 더하지 않는다', async () => {
        const { inner, paced } = setup();
        const failure = new Error('429');
        vi.mocked(inner.getBars).mockRejectedValue(failure);

        await expect(
            paced.getBars({ symbol: 'A', timeframe: '1Day' })
        ).rejects.toBe(failure);
        expect(paced.upstreamCalls()).toBe(1);
    });

    it('안쪽이 null을 돌려주면 null 그대로다', async () => {
        const { inner, paced } = setup();
        vi.mocked(inner.getQuote).mockResolvedValue(null);

        await expect(paced.getQuote('A')).resolves.toBeNull();
    });
});

vi.mock('@/shared/lib/sleep', () => ({
    sleep: vi.fn().mockResolvedValue(undefined),
}));

import { FmpNewsClient, SOURCE_UNKNOWN_FALLBACK } from '../lib/fmpNewsClient';
import { MS_PER_DAY } from '@/shared/config/time';

const mockFetch = vi.fn();

const TEST_API_KEY = 'test-api-key';

/** Fixed "now" for time-dependent tests. */
const FIXED_NOW_MS = new Date('2024-06-01T12:00:00Z').getTime();

describe('FmpNewsClient', () => {
    const originalFetch = global.fetch;
    const originalEnv = process.env.FMP_API_KEY;

    beforeEach(() => {
        global.fetch = mockFetch as unknown as typeof fetch;
        mockFetch.mockReset();
        process.env.FMP_API_KEY = TEST_API_KEY;
        vi.spyOn(Date, 'now').mockReturnValue(FIXED_NOW_MS);
    });

    afterEach(() => {
        global.fetch = originalFetch;
        process.env.FMP_API_KEY = originalEnv;
        vi.restoreAllMocks();
    });

    /** Helper — resolve fetch with a JSON array. */
    function mockOk(body: unknown): void {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => body,
        });
    }

    /** Helper — resolve fetch with a non-2xx status. */
    function mockError(status: number): void {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status,
            headers: new Headers(),
        });
    }

    describe('FMP_API_KEY missing', () => {
        it('throws when FMP_API_KEY is not set', async () => {
            delete process.env.FMP_API_KEY;
            const client = new FmpNewsClient();
            await expect(
                client.fetchNewsForPeriod('AAPL', MS_PER_DAY)
            ).rejects.toThrow('FMP_API_KEY');
        });
    });

    describe('non-2xx HTTP response', () => {
        it('throws with status in message', async () => {
            mockError(404);
            const client = new FmpNewsClient();
            await expect(
                client.fetchNewsForPeriod('AAPL', 7 * MS_PER_DAY)
            ).rejects.toThrow('404');
        });
    });

    /** Field mapping / date normalization through the client's only fetch path. */
    describe('fetchNewsForPeriod — mapping (1-day window)', () => {
        // FIXED_NOW_MS = 2024-06-01T12:00:00Z → 1-day cutoff = 2024-05-31T12:00:00Z
        const withinWindow = {
            symbol: 'AAPL',
            publishedDate: '2024-06-01T08:00:00Z', // inside 24h window
            title: 'Apple Q2 Results',
            site: 'Reuters',
            text: 'Apple reported...',
            url: 'https://reuters.com/aapl-q2',
        };

        it('maps FMP field names to domain NewsItem shape', async () => {
            mockOk([withinWindow]);
            const client = new FmpNewsClient();
            const result = await client.fetchNewsForPeriod('AAPL', MS_PER_DAY);
            const item = result[0]!;
            expect(item.symbol).toBe('AAPL');
            expect(item.source).toBe('Reuters'); // site → source
            expect(item.publishedAt).toBe('2024-06-01T08:00:00.000Z'); // publishedDate → publishedAt
            expect(item.titleEn).toBe('Apple Q2 Results'); // title → titleEn
            expect(item.bodyEn).toBe('Apple reported...'); // text → bodyEn
            expect(item.url).toBe('https://reuters.com/aapl-q2');
        });

        /**
         * [회귀] `bodyTruncated`의 소스 필드를 아무 테스트도 안 잡고 있었다 —
         * `raw.text` 대신 `raw.title`을 넣어도 전건 통과했다(감사 라운드 12).
         * 이 플래그의 유일한 소비자는 core의 카드 분석 프롬프트다: 잘리지 않았다고
         * 알리면 모델이 잘려 나간 수치를 보존하라는 지시를 받아 날조를 유도한다.
         *
         * 두 케이스가 본문과 제목의 판정을 서로 반대로 만든다 — 제목에서 파생하면
         * 둘 다 뒤집힌다.
         */
        it('bodyTruncated는 제목이 아니라 본문에서 판정한다', async () => {
            mockOk([
                {
                    ...withinWindow,
                    // 제목은 40자를 넘기며 기능어로 끊겨 truncated로 판정된다,
                    title: 'Apple Q2 Results beat expectations across every segment driven by',
                    // 본문은 40자를 넘기면서 마침표로 끝난다 — 완결.
                    text: 'Apple reported record quarterly revenue driven by services growth.',
                },
            ]);
            const complete = (
                await new FmpNewsClient().fetchNewsForPeriod('AAPL', MS_PER_DAY)
            )[0]!;
            expect(complete.bodyTruncated).toBe(false);

            mockOk([
                {
                    ...withinWindow,
                    // 제목은 마침표로 끝나 완결로 보이고,
                    title: 'Apple posts record revenue.',
                    // 본문은 문장 중간에서 끊긴다.
                    text: 'Apple reported record quarterly revenue during the quarter. Apple makes',
                },
            ]);
            const truncated = (
                await new FmpNewsClient().fetchNewsForPeriod('AAPL', MS_PER_DAY)
            )[0]!;
            expect(truncated.bodyTruncated).toBe(true);
        });

        it('passes symbols and apikey in the URL', async () => {
            mockOk([]);
            const client = new FmpNewsClient();
            await client.fetchNewsForPeriod('TSLA', 7 * MS_PER_DAY);
            const url: string = mockFetch.mock.calls[0][0] as string;
            expect(url).toContain('symbols=TSLA');
            expect(url).toContain(`apikey=${TEST_API_KEY}`);
        });

        it('requests news/stock path by default (equity)', async () => {
            mockOk([]);
            const client = new FmpNewsClient('stock');
            await client.fetchNewsForPeriod('AAPL', MS_PER_DAY);
            const url: string = mockFetch.mock.calls[0][0] as string;
            expect(url).toContain('news/stock');
        });

        it('requests news/crypto path when newsSource is "crypto"', async () => {
            mockOk([]);
            const client = new FmpNewsClient('crypto');
            await client.fetchNewsForPeriod('BTCUSD', MS_PER_DAY);
            const url: string = mockFetch.mock.calls[0][0] as string;
            expect(url).toContain('news/crypto');
        });

        it('maps null text to bodyEn: null', async () => {
            mockOk([{ ...withinWindow, text: null }]);
            const client = new FmpNewsClient();
            const result = await client.fetchNewsForPeriod('AAPL', MS_PER_DAY);
            expect(result[0]!.bodyEn).toBeNull();
        });

        it('normalizes zone-less FMP publishedDate from New York time to UTC', async () => {
            mockOk([
                {
                    ...withinWindow,
                    publishedDate: '2024-06-01 08:00:00',
                },
            ]);
            const client = new FmpNewsClient();
            const result = await client.fetchNewsForPeriod('AAPL', MS_PER_DAY);
            expect(result[0]!.publishedAt).toBe('2024-06-01T12:00:00.000Z');
        });
    });

    describe('fetchNewsForPeriod', () => {
        // FIXED_NOW_MS = 2024-06-01T12:00:00Z
        // lookbackMs = 7 * MS_PER_DAY → cutoff = 2024-05-25T12:00:00Z
        const SEVEN_DAYS_MS = 7 * MS_PER_DAY;

        const withinPeriod = {
            symbol: 'AAPL',
            publishedDate: '2024-05-30T08:00:00Z',
            title: 'Apple within period',
            site: 'Reuters',
            text: 'Within period body.',
            url: 'https://reuters.com/aapl-period',
        };
        const outsidePeriod = {
            symbol: 'AAPL',
            publishedDate: '2024-05-20T08:00:00Z', // before 7d cutoff
            title: 'Old article',
            site: 'Bloomberg',
            text: 'Old news.',
            url: 'https://bloomberg.com/old-period',
        };

        it('passes from date and limit=1000 in the URL', async () => {
            mockOk([]);
            const client = new FmpNewsClient();
            await client.fetchNewsForPeriod('TSLA', SEVEN_DAYS_MS);
            const url: string = mockFetch.mock.calls[0][0] as string;
            expect(url).toContain('from=2024-05-25');
            expect(url).toContain('limit=1000');
            expect(url).toContain('symbols=TSLA');
        });

        it('filters out articles published before the cutoff', async () => {
            mockOk([withinPeriod, outsidePeriod]);
            const client = new FmpNewsClient();
            const result = await client.fetchNewsForPeriod(
                'AAPL',
                SEVEN_DAYS_MS
            );
            expect(result).toHaveLength(1);
            expect(result[0]!.titleEn).toBe('Apple within period');
        });

        it('maps FMP fields to NewsItem shape', async () => {
            mockOk([withinPeriod]);
            const client = new FmpNewsClient();
            const result = await client.fetchNewsForPeriod(
                'AAPL',
                SEVEN_DAYS_MS
            );
            const item = result[0]!;
            expect(item.symbol).toBe('AAPL');
            expect(item.source).toBe('Reuters');
            expect(item.titleEn).toBe('Apple within period');
            expect(item.bodyEn).toBe('Within period body.');
        });

        it('generates a stable 32-char SHA-256 ID from the URL', async () => {
            mockOk([withinPeriod]);
            const client = new FmpNewsClient();
            const result = await client.fetchNewsForPeriod(
                'AAPL',
                SEVEN_DAYS_MS
            );
            expect(result[0]!.id).toHaveLength(32);
            expect(result[0]!.id).toMatch(/^[A-Za-z0-9_-]+$/);
        });

        it('returns empty array when all articles are outside the period', async () => {
            mockOk([outsidePeriod]);
            const client = new FmpNewsClient();
            const result = await client.fetchNewsForPeriod(
                'AAPL',
                SEVEN_DAYS_MS
            );
            expect(result).toEqual([]);
        });

        it('skips malformed publishedDate without failing the whole fetch', async () => {
            mockOk([
                { ...withinPeriod, publishedDate: 'not-a-date' },
                withinPeriod,
            ]);
            const client = new FmpNewsClient();
            const result = await client.fetchNewsForPeriod(
                'AAPL',
                SEVEN_DAYS_MS
            );
            expect(result).toHaveLength(1);
            expect(result[0]!.titleEn).toBe('Apple within period');
        });
    });
});

describe('FmpNewsClient — null site fallback (F2)', () => {
    // Shared within-window article base with a valid URL so hostname can be derived.
    const FIXED_NOW_MS_FOR_SUITE = new Date('2024-06-01T12:00:00Z').getTime();
    const originalFetch = global.fetch;

    beforeEach(() => {
        global.fetch = mockFetch as unknown as typeof fetch;
        mockFetch.mockReset();
        process.env.FMP_API_KEY = 'test-api-key';
        vi.spyOn(Date, 'now').mockReturnValue(FIXED_NOW_MS_FOR_SUITE);
    });

    afterEach(() => {
        global.fetch = originalFetch;
        vi.restoreAllMocks();
    });

    function mockOkSuite(data: unknown): void {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => data,
        });
    }

    it('falls back to URL hostname when site is null (crypto news)', async () => {
        mockOkSuite([
            {
                symbol: 'BTCUSD',
                publishedDate: '2024-06-01T08:00:00Z',
                title: 'BTC price update',
                site: null, // FMP crypto news sometimes omits site
                text: 'Bitcoin hits new high.',
                url: 'https://coindesk.com/btc-price-update',
            },
        ]);
        const client = new FmpNewsClient('crypto');
        const result = await client.fetchNewsForPeriod('BTCUSD', MS_PER_DAY);
        expect(result).toHaveLength(1);
        // source must be derived from URL hostname, not empty/null
        expect(result[0]!.source).toBe('coindesk.com');
    });

    it('falls back to URL hostname when site is an empty string', async () => {
        mockOkSuite([
            {
                symbol: 'ETHUSD',
                publishedDate: '2024-06-01T08:00:00Z',
                title: 'ETH update',
                site: '',
                text: 'Ethereum news.',
                url: 'https://cointelegraph.com/eth-update',
            },
        ]);
        const client = new FmpNewsClient('crypto');
        const result = await client.fetchNewsForPeriod('ETHUSD', MS_PER_DAY);
        expect(result).toHaveLength(1);
        expect(result[0]!.source).toBe('cointelegraph.com');
    });

    it('uses "unknown" fallback when both site is null and URL is invalid', async () => {
        mockOkSuite([
            {
                symbol: 'BTCUSD',
                publishedDate: '2024-06-01T08:00:00Z',
                title: 'BTC article',
                site: null,
                text: 'Body.',
                url: 'not-a-valid-url',
            },
        ]);
        const client = new FmpNewsClient('crypto');
        const result = await client.fetchNewsForPeriod('BTCUSD', MS_PER_DAY);
        expect(result).toHaveLength(1);
        expect(result[0]!.source).toBe(SOURCE_UNKNOWN_FALLBACK);
    });

    it('uses site directly when site is a non-empty string (non-regression)', async () => {
        mockOkSuite([
            {
                symbol: 'AAPL',
                publishedDate: '2024-06-01T08:00:00Z',
                title: 'AAPL article',
                site: 'Reuters',
                text: 'Body.',
                url: 'https://reuters.com/aapl',
            },
        ]);
        const client = new FmpNewsClient();
        const result = await client.fetchNewsForPeriod('AAPL', MS_PER_DAY);
        expect(result).toHaveLength(1);
        expect(result[0]!.source).toBe('Reuters');
    });
});

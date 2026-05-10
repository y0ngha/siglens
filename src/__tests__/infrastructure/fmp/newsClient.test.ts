import {
    FmpNewsClient,
    computeCutoff,
    hashUrlToId,
    normalizeFmpPublishedDate,
    toYyyyMmDd,
} from '@/infrastructure/fmp/newsClient';
import { MS_PER_DAY, MS_PER_HOUR } from '@/domain/constants/time';

const mockFetch = jest.fn();

const TEST_API_KEY = 'test-api-key';

/** Fixed "now" for time-dependent tests. */
const FIXED_NOW_MS = new Date('2024-06-01T12:00:00Z').getTime();

describe('toYyyyMmDd', () => {
    it('formats a UTC Date as YYYY-MM-DD', () => {
        expect(toYyyyMmDd(new Date('2024-06-01T12:30:00Z'))).toBe('2024-06-01');
    });

    it('uses UTC date, not local date', () => {
        // At 2024-06-01T00:30:00Z the UTC date is 2024-06-01 even if local TZ
        // is behind (e.g. UTC-5 would show 2024-05-31 locally).
        expect(toYyyyMmDd(new Date('2024-06-01T00:30:00Z'))).toBe('2024-06-01');
    });
});

describe('computeCutoff', () => {
    beforeEach(() => {
        jest.spyOn(Date, 'now').mockReturnValue(FIXED_NOW_MS);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('returns 24 hours before now for "24h"', () => {
        const cutoff = computeCutoff('24h');
        expect(cutoff.getTime()).toBe(FIXED_NOW_MS - 24 * MS_PER_HOUR);
    });

    it('returns 7 days (168 h) before now for "7d"', () => {
        const cutoff = computeCutoff('7d');
        expect(cutoff.getTime()).toBe(FIXED_NOW_MS - 168 * MS_PER_HOUR);
    });

    it('returns 30 days (720 h) before now for "30d"', () => {
        const cutoff = computeCutoff('30d');
        expect(cutoff.getTime()).toBe(FIXED_NOW_MS - 720 * MS_PER_HOUR);
    });
});

describe('hashUrlToId', () => {
    it('returns a string of exactly 32 characters', () => {
        const id = hashUrlToId('https://example.com/article/1');
        expect(id).toHaveLength(32);
    });

    it('is deterministic for the same URL', () => {
        const url = 'https://news.example.com/aapl-earnings-2024';
        expect(hashUrlToId(url)).toBe(hashUrlToId(url));
    });

    it('produces different IDs for different URLs', () => {
        expect(hashUrlToId('https://a.com/1')).not.toBe(
            hashUrlToId('https://b.com/2')
        );
    });

    it('produces different IDs for same-domain URLs (regression: base64-truncation collision)', () => {
        // 같은 도메인 URL들의 앞 24바이트가 동일해도 반드시 다른 ID를 생성해야 한다.
        // 이전 구현(Buffer.from(url).toString('base64url').slice(0,32))은 앞 24바이트에만
        // 의존해 동일 도메인 기사 전체가 같은 ID를 가지는 버그가 있었다.
        const url1 =
            'https://www.globenewswire.com/news-release/2026/05/07/3290250/0/en/SEALSQ-article-1.html';
        const url2 =
            'https://www.globenewswire.com/news-release/2026/04/30/3285542/0/en/WISeKey-article-2.html';
        expect(hashUrlToId(url1)).not.toBe(hashUrlToId(url2));

        const url3 =
            'https://seekingalpha.com/article/4895552-sealsq-quantum-setup.html';
        const url4 =
            'https://seekingalpha.com/article/1234567-tesla-cybertruck.html';
        expect(hashUrlToId(url3)).not.toBe(hashUrlToId(url4));
    });

    it('contains only base64url-safe characters', () => {
        const id = hashUrlToId('https://example.com/some-article?q=value&x=1');
        expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
    });
});

describe('normalizeFmpPublishedDate', () => {
    it('timezone이 없는 FMP 뉴스 시간을 New York summer time 기준 UTC로 변환한다', () => {
        expect(normalizeFmpPublishedDate('2026-05-06 07:35:21')).toBe(
            '2026-05-06T11:35:21.000Z'
        );
    });

    it('timezone이 없는 FMP 뉴스 시간을 New York standard time 기준 UTC로 변환한다', () => {
        expect(normalizeFmpPublishedDate('2026-01-06 07:35:21')).toBe(
            '2026-01-06T12:35:21.000Z'
        );
    });

    it('timezone이 포함된 값은 해당 instant를 그대로 ISO로 정규화한다', () => {
        expect(normalizeFmpPublishedDate('2026-05-06T07:35:21-04:00')).toBe(
            '2026-05-06T11:35:21.000Z'
        );
    });
});

describe('FmpNewsClient', () => {
    const originalFetch = global.fetch;
    const originalEnv = process.env.FMP_API_KEY;

    beforeEach(() => {
        global.fetch = mockFetch as unknown as typeof fetch;
        mockFetch.mockReset();
        process.env.FMP_API_KEY = TEST_API_KEY;
        jest.spyOn(Date, 'now').mockReturnValue(FIXED_NOW_MS);
    });

    afterEach(() => {
        global.fetch = originalFetch;
        process.env.FMP_API_KEY = originalEnv;
        jest.restoreAllMocks();
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
        mockFetch.mockResolvedValueOnce({ ok: false, status });
    }

    // ------------------------------------------------------------------ //
    // API key guard
    // ------------------------------------------------------------------ //

    describe('FMP_API_KEY missing', () => {
        it('fetchNews throws when FMP_API_KEY is not set', async () => {
            delete process.env.FMP_API_KEY;
            const client = new FmpNewsClient();
            await expect(client.fetchNews('AAPL', '24h')).rejects.toThrow(
                'FMP_API_KEY'
            );
        });
    });

    // ------------------------------------------------------------------ //
    // Non-2xx HTTP error
    // ------------------------------------------------------------------ //

    describe('non-2xx HTTP response', () => {
        it('fetchNews throws with status in message', async () => {
            mockError(429);
            const client = new FmpNewsClient();
            await expect(client.fetchNews('AAPL', '7d')).rejects.toThrow('429');
        });

        it('fetchEarningsCalendarAll throws with status in message', async () => {
            mockError(500);
            const client = new FmpNewsClient();
            await expect(client.fetchEarningsCalendarAll()).rejects.toThrow(
                '500'
            );
        });
    });

    // ------------------------------------------------------------------ //
    // fetchNews
    // ------------------------------------------------------------------ //

    describe('fetchNews', () => {
        // Articles used in time-window filter tests.
        // FIXED_NOW_MS = 2024-06-01T12:00:00Z
        // cutoff for '24h' = 2024-05-31T12:00:00Z
        const withinWindow = {
            symbol: 'AAPL',
            publishedDate: '2024-06-01T08:00:00Z', // inside 24h window
            title: 'Apple Q2 Results',
            site: 'Reuters',
            text: 'Apple reported...',
            url: 'https://reuters.com/aapl-q2',
        };
        const outsideWindow = {
            symbol: 'AAPL',
            publishedDate: '2024-05-30T10:00:00Z', // before 24h cutoff
            title: 'Old article',
            site: 'Bloomberg',
            text: 'Old news.',
            url: 'https://bloomberg.com/old',
        };

        it('filters out articles published before the cutoff date', async () => {
            mockOk([withinWindow, outsideWindow]);
            const client = new FmpNewsClient();
            const result = await client.fetchNews('AAPL', '24h');
            expect(result).toHaveLength(1);
            expect(result[0]!.titleEn).toBe('Apple Q2 Results');
        });

        it('maps FMP field names to domain NewsItem shape', async () => {
            mockOk([withinWindow]);
            const client = new FmpNewsClient();
            const result = await client.fetchNews('AAPL', '24h');
            const item = result[0]!;
            expect(item.symbol).toBe('AAPL');
            expect(item.source).toBe('Reuters'); // site → source
            expect(item.publishedAt).toBe('2024-06-01T08:00:00.000Z'); // publishedDate → publishedAt
            expect(item.titleEn).toBe('Apple Q2 Results'); // title → titleEn
            expect(item.bodyEn).toBe('Apple reported...'); // text → bodyEn
            expect(item.url).toBe('https://reuters.com/aapl-q2');
        });

        it('generates a stable 32-char ID from the article URL', async () => {
            mockOk([withinWindow]);
            const client = new FmpNewsClient();
            const result = await client.fetchNews('AAPL', '24h');
            const id = result[0]!.id;
            expect(id).toHaveLength(32);
            expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
        });

        it('passes limit=30 for "24h" range', async () => {
            mockOk([]);
            const client = new FmpNewsClient();
            await client.fetchNews('AAPL', '24h');
            const url: string = mockFetch.mock.calls[0][0] as string;
            expect(url).toContain('limit=30');
        });

        it('passes limit=100 for "7d" range', async () => {
            mockOk([]);
            const client = new FmpNewsClient();
            await client.fetchNews('AAPL', '7d');
            const url: string = mockFetch.mock.calls[0][0] as string;
            expect(url).toContain('limit=100');
        });

        it('passes limit=300 for "30d" range', async () => {
            mockOk([]);
            const client = new FmpNewsClient();
            await client.fetchNews('AAPL', '30d');
            const url: string = mockFetch.mock.calls[0][0] as string;
            expect(url).toContain('limit=300');
        });

        it('passes symbols and apikey in the URL', async () => {
            mockOk([]);
            const client = new FmpNewsClient();
            await client.fetchNews('TSLA', '7d');
            const url: string = mockFetch.mock.calls[0][0] as string;
            expect(url).toContain('symbols=TSLA');
            expect(url).toContain(`apikey=${TEST_API_KEY}`);
        });

        it('returns empty array when all articles are outside the window', async () => {
            mockOk([outsideWindow]);
            const client = new FmpNewsClient();
            const result = await client.fetchNews('AAPL', '24h');
            expect(result).toEqual([]);
        });

        it('maps null text to bodyEn: null', async () => {
            mockOk([{ ...withinWindow, text: null }]);
            const client = new FmpNewsClient();
            const result = await client.fetchNews('AAPL', '24h');
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
            const result = await client.fetchNews('AAPL', '24h');
            expect(result[0]!.publishedAt).toBe('2024-06-01T12:00:00.000Z');
        });

        it('skips malformed publishedDate articles without failing the whole fetch', async () => {
            mockOk([
                { ...withinWindow, publishedDate: 'not-a-date' },
                withinWindow,
            ]);
            const client = new FmpNewsClient();
            const result = await client.fetchNews('AAPL', '24h');
            expect(result).toHaveLength(1);
            expect(result[0]!.titleEn).toBe('Apple Q2 Results');
        });
    });

    // ------------------------------------------------------------------ //
    // fetchNewsForPeriod
    // ------------------------------------------------------------------ //

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

    // ------------------------------------------------------------------ //
    // fetchEarningsCalendarAll
    // ------------------------------------------------------------------ //

    describe('fetchEarningsCalendarAll', () => {
        it('maps FMP earnings calendar fields to EarningsCalendarItem', async () => {
            mockOk([
                {
                    symbol: 'AAPL',
                    date: '2024-08-01',
                    epsActual: 1.52,
                    epsEstimated: 1.48,
                    revenueActual: 90_753_000_000,
                    revenueEstimated: 89_000_000_000,
                    lastUpdated: '2024-07-30',
                },
            ]);
            const client = new FmpNewsClient();
            const result = await client.fetchEarningsCalendarAll();
            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
                symbol: 'AAPL',
                earningsDate: '2024-08-01', // date → earningsDate
                epsActual: 1.52, // eps → epsActual
                epsEstimated: 1.48,
                revenueActual: 90_753_000_000, // revenue → revenueActual
                revenueEstimated: 89_000_000_000,
                lastUpdated: '2024-07-30',
            });
        });

        it('supports legacy eps/revenue/updatedFromDate field names', async () => {
            mockOk([
                {
                    symbol: 'AAPL',
                    date: '2024-08-01',
                    eps: 1.52,
                    epsEstimated: 1.48,
                    revenue: 90_753_000_000,
                    revenueEstimated: 89_000_000_000,
                    updatedFromDate: '2024-07-30',
                },
            ]);
            const client = new FmpNewsClient();
            const result = await client.fetchEarningsCalendarAll();
            expect(result[0]).toMatchObject({
                epsActual: 1.52,
                revenueActual: 90_753_000_000,
                lastUpdated: '2024-07-30',
            });
        });

        it('handles null eps/revenue values', async () => {
            mockOk([
                {
                    symbol: 'XYZ',
                    date: '2024-09-15',
                    eps: null,
                    epsEstimated: 0.8,
                    revenue: null,
                    revenueEstimated: null,
                    updatedFromDate: '2024-09-14',
                },
            ]);
            const client = new FmpNewsClient();
            const result = await client.fetchEarningsCalendarAll();
            expect(result[0]!.epsActual).toBeNull();
            expect(result[0]!.revenueActual).toBeNull();
            expect(result[0]!.revenueEstimated).toBeNull();
        });

        it('returns empty array when FMP returns empty', async () => {
            mockOk([]);
            const client = new FmpNewsClient();
            expect(await client.fetchEarningsCalendarAll()).toEqual([]);
        });
    });

    // ------------------------------------------------------------------ //
    // fetchEarningsReport
    // ------------------------------------------------------------------ //

    describe('fetchEarningsReport', () => {
        it('returns the first earnings report', async () => {
            mockOk([
                { symbol: 'AAPL', date: '2024-08-01' },
                { symbol: 'AAPL', date: '2024-05-02' },
            ]);
            const client = new FmpNewsClient();
            const result = await client.fetchEarningsReport('AAPL');
            expect(result).toEqual({
                symbol: 'AAPL',
                earningsDate: '2024-08-01',
            });
        });

        it('supports legacy earningsDate field name', async () => {
            mockOk([{ symbol: 'AAPL', earningsDate: '2024-08-01' }]);
            const client = new FmpNewsClient();
            expect(await client.fetchEarningsReport('AAPL')).toEqual({
                symbol: 'AAPL',
                earningsDate: '2024-08-01',
            });
        });

        it('returns null when array is empty', async () => {
            mockOk([]);
            const client = new FmpNewsClient();
            expect(await client.fetchEarningsReport('X')).toBeNull();
        });

        it('passes symbol and apikey in the URL', async () => {
            mockOk([{ symbol: 'MSFT', earningsDate: '2024-07-25' }]);
            const client = new FmpNewsClient();
            await client.fetchEarningsReport('MSFT');
            const url: string = mockFetch.mock.calls[0][0] as string;
            expect(url).toContain('symbol=MSFT');
            expect(url).toContain(`apikey=${TEST_API_KEY}`);
        });
    });
});

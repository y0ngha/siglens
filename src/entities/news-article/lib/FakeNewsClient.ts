import type {
    EarningsReport,
    NewsItem,
    NewsTimeRange,
} from '@y0ngha/siglens-core';
import type { NewsClientPort } from './getNewsClient';

/**
 * E2E-only news client mirroring `FmpNewsClient`'s public surface, returning
 * deterministic fixture articles instead of calling FMP. Reached only when
 * E2E_TEST=1 (see getNewsClient). Reads NO env keys and performs NO network I/O.
 *
 * Returns a small set of recent `NewsItem`s + a fake earnings report so the
 * news page renders without crashing. Timestamps are anchored near the frozen
 * E2E clock (2026-05-30) so they survive any lookback-window filtering.
 */

/** Deterministic earnings date returned by the fake (well past the frozen E2E clock). */
const FAKE_EARNINGS_DATE = '2026-07-30';

const FAKE_NEWS: ReadonlyArray<NewsItem> = [
    {
        id: 'e2e-news-1',
        symbol: 'AAPL',
        source: 'E2E Wire',
        url: 'http://localhost:4300/e2e/news/1',
        publishedAt: '2026-05-29T14:00:00.000Z',
        titleEn: 'E2E fixture headline one',
        bodyEn: 'Deterministic fixture body for the first E2E news article.',
    },
    {
        id: 'e2e-news-2',
        symbol: 'AAPL',
        source: 'E2E Wire',
        url: 'http://localhost:4300/e2e/news/2',
        publishedAt: '2026-05-28T09:30:00.000Z',
        titleEn: 'E2E fixture headline two',
        bodyEn: 'Deterministic fixture body for the second E2E news article.',
    },
];

function withSymbol(symbol: string): NewsItem[] {
    const upper = symbol.toUpperCase();
    return FAKE_NEWS.map(item => ({ ...item, symbol: upper }));
}

export class FakeNewsClient implements NewsClientPort {
    async fetchNews(
        symbol: string,
        _range: NewsTimeRange
    ): Promise<NewsItem[]> {
        return withSymbol(symbol);
    }

    async fetchNewsForPeriod(
        symbol: string,
        _lookbackMs: number
    ): Promise<NewsItem[]> {
        return withSymbol(symbol);
    }

    async fetchEarningsReport(symbol: string): Promise<EarningsReport | null> {
        return {
            symbol: symbol.toUpperCase(),
            earningsDate: FAKE_EARNINGS_DATE,
        };
    }
}

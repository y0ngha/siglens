import type { NewsItem } from '@y0ngha/siglens-core';
import type { NewsClientPort } from './newsClientPort';

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

/**
 * E2E 전용 뉴스 클라이언트. FMP 대신 결정적인 고정 기사를 돌려준다(`getNewsClient`가
 * E2E_TEST=1일 때만 만든다). 환경 변수를 읽지 않고 네트워크 I/O도 하지 않는다.
 *
 * 뉴스 페이지가 깨지지 않을 만큼의 최근 기사 몇 건을 주며, 발행 시각은 고정된 E2E
 * 시계(2026-05-30) 근처라 30일·180일 조회 창 필터를 통과한다.
 */
export class FakeNewsClient implements NewsClientPort {
    /** 조회 창과 무관하게 같은 고정 기사를, 요청한 심볼(대문자)로 돌려준다. */
    async fetchNewsForPeriod(
        symbol: string,
        _lookbackMs: number
    ): Promise<NewsItem[]> {
        return withSymbol(symbol);
    }
}

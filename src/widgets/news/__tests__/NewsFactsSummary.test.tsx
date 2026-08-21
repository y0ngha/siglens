// @vitest-environment jsdom

import { render, screen, within } from '@testing-library/react';
import type { NewsDisplayItem } from '@/shared/lib/types';
import { formatNewsPublishedAt } from '@/shared/lib/timeFormat';
import { NewsFactsSummary } from '@/widgets/news/NewsFactsSummary';
import { withLocale } from '@/shared/test-utils/intlRenderWrapper';

function makeNewsItem(
    id: string,
    overrides: Partial<NewsDisplayItem>
): NewsDisplayItem {
    return {
        id,
        publishedAt: '2026-05-06T00:00:00.000Z',
        titleEn: `English headline ${id}`,
        titleKo: `한국어 헤드라인 ${id}`,
        sentiment: null,
        category: null,
        bodyKo: null,
        summaryKo: null,
        priceImpact: null,
        url: `https://example.com/${id}`,
        source: 'Example',
        ...overrides,
    };
}

describe('NewsFactsSummary', () => {
    it('renders factual counts, latest date, sentiment distribution, and up to five headlines', () => {
        const latestPublishedAt = '2026-05-07T02:30:00.000Z';
        const items: NewsDisplayItem[] = [
            makeNewsItem('news-1', {
                titleKo: '애플, 신제품 공개',
                sentiment: 'bullish',
            }),
            makeNewsItem('news-2', {
                publishedAt: latestPublishedAt,
                titleKo: null,
                titleEn: 'Apple suppliers prepare for launch',
                sentiment: 'neutral',
            }),
            makeNewsItem('news-3', {
                titleKo: '규제 리스크 재부각',
                sentiment: 'bearish',
            }),
            makeNewsItem('news-4', {
                titleKo: '서비스 매출 성장',
                sentiment: 'bullish',
            }),
            makeNewsItem('news-5', {
                titleKo: '분석 대기 기사',
                sentiment: null,
            }),
            makeNewsItem('news-6', {
                titleKo: '여섯 번째 기사는 표시하지 않음',
                sentiment: 'neutral',
            }),
        ];

        render(
            <NewsFactsSummary
                displayName="Apple Inc. (AAPL)"
                assetClass="equity"
                items={items}
            />
        );

        const section = screen.getByRole('region', {
            name: 'Apple Inc. (AAPL) 최근 뉴스 데이터 요약',
        });
        expect(section).toHaveTextContent(
            'Apple Inc. (AAPL) 페이지는 최근 뉴스 6건을 표시합니다.'
        );
        expect(section).toHaveTextContent(
            `최신 기사는 ${formatNewsPublishedAt(latestPublishedAt, 'ko')} 기준입니다.`
        );
        expect(section).toHaveTextContent(
            'AI 뉴스 카드 분석은 5건 완료됐습니다.'
        );
        expect(section).toHaveTextContent(
            '분위기 분포는 긍정 2건, 중립 2건, 부정 1건입니다.'
        );
        expect(
            within(section).getByText('Apple suppliers prepare for launch')
        ).toBeInTheDocument();
        expect(
            within(section).getByText('애플, 신제품 공개')
        ).toBeInTheDocument();
        expect(
            within(section).getByText('규제 리스크 재부각')
        ).toBeInTheDocument();
        expect(
            within(section).getByText('서비스 매출 성장')
        ).toBeInTheDocument();
        expect(within(section).getByText('분석 대기 기사')).toBeInTheDocument();
        expect(
            within(section).queryByText('여섯 번째 기사는 표시하지 않음')
        ).not.toBeInTheDocument();
        expect(section).toHaveTextContent(
            '뉴스 흐름과 함께 어닝 일정, 최근 실적, 애널리스트 등급 변경을 이어서 확인할 수 있습니다.'
        );
    });

    it('renders an honest empty state without fabricated analysis', () => {
        render(
            <NewsFactsSummary
                displayName="Apple Inc. (AAPL)"
                assetClass="equity"
                items={[]}
            />
        );

        const section = screen.getByRole('region', {
            name: 'Apple Inc. (AAPL) 최근 뉴스 데이터 요약',
        });
        expect(section).toHaveTextContent(
            'Apple Inc. (AAPL) 최신 뉴스 데이터가 아직 준비되지 않았습니다. 뉴스 카드가 분석되면 최근 기사와 분위기 요약이 이 영역에 표시됩니다.'
        );
        expect(section).not.toHaveTextContent('AI 뉴스 카드 분석은');
        expect(section).not.toHaveTextContent('분위기 분포는');
    });

    it('hides optional factual sections for degraded non-empty news items', () => {
        const items: NewsDisplayItem[] = [
            makeNewsItem('degraded-1', {
                publishedAt: 'not-a-date',
                titleKo: null,
                titleEn: null as unknown as string,
                sentiment: null,
            }),
            makeNewsItem('degraded-2', {
                publishedAt: undefined as unknown as string,
                titleKo: undefined as unknown as string | null,
                titleEn: undefined as unknown as string,
                sentiment: null,
            }),
        ];

        render(
            <NewsFactsSummary
                displayName="Apple Inc. (AAPL)"
                assetClass="equity"
                items={items}
            />
        );

        const section = screen.getByRole('region', {
            name: 'Apple Inc. (AAPL) 최근 뉴스 데이터 요약',
        });
        expect(section).toHaveTextContent(
            'Apple Inc. (AAPL) 페이지는 최근 뉴스 2건을 표시합니다.'
        );
        expect(section).toHaveTextContent(
            'AI 뉴스 카드 분석은 0건 완료됐습니다.'
        );
        expect(section).toHaveTextContent(
            '뉴스 흐름과 함께 어닝 일정, 최근 실적, 애널리스트 등급 변경을 이어서 확인할 수 있습니다.'
        );
        expect(section).not.toHaveTextContent('최신 기사는');
        expect(section).not.toHaveTextContent('분위기 분포는');
        expect(
            within(section).queryByRole('heading', { name: '최근 기사 제목' })
        ).not.toBeInTheDocument();
        expect(within(section).queryByRole('list')).not.toBeInTheDocument();
    });

    it('renders crypto support copy for crypto assets', () => {
        render(
            <NewsFactsSummary
                displayName="Bitcoin"
                assetClass="crypto"
                items={[
                    makeNewsItem('crypto-1', {
                        titleKo: '비트코인 ETF 자금 유입',
                        sentiment: 'bullish',
                    }),
                ]}
            />
        );

        const section = screen.getByRole('region', {
            name: 'Bitcoin 최근 뉴스 데이터 요약',
        });
        expect(section).toHaveTextContent(
            '코인 뉴스의 핵심 이슈와 분위기를 함께 확인할 수 있습니다.'
        );
        expect(section).not.toHaveTextContent('어닝 일정');
    });
});

/**
 * 헤드라인은 `resolveNewsTitle(item, locale)`을 거쳐야 한다.
 *
 * 여기에 로케일이 안 걸리면 `/en/AAPL/news`가 영어 제목(`titleEn`)을 놔두고
 * 한국어 제목을 렌더한다 — 페이지의 나머지는 전부 영어인 채로.
 * 예전에는 이 자리에서 `useResolvedLocale()`을 `'ko'` 상수로 바꿔도
 * 테스트가 전부 통과했다(로케일별 단언이 하나도 없었다).
 */
describe('NewsFactsSummary — 로케일별 헤드라인', () => {
    const items = [
        makeNewsItem('1', {
            titleKo: '애플 신제품 공개',
            titleEn: 'Apple unveils new product',
        }),
    ];

    it.each(['ko', 'en', 'ja', 'zh'] as const)(
        '%s: 티커가 두 번 나오지 않는다',
        locale => {
            // `displayName`이 이미 `(AAPL)`을 품는데 `symbol`을 또 넘겨
            // `Apple Inc. (AAPL) (AAPL)`로 렌더됐다 — 네 로케일 전부.
            render(
                withLocale(
                    <NewsFactsSummary
                        displayName="Apple Inc. (AAPL)"
                        assetClass="equity"
                        items={items}
                    />,
                    locale
                )
            );

            const body = document.body.textContent ?? '';
            expect(body).toContain('Apple Inc. (AAPL)');
            expect(body).not.toMatch(/\(AAPL\)\s*[（(]AAPL[)）]/);
        }
    );

    it('ko에서는 한국어 제목을 쓴다', () => {
        render(
            <NewsFactsSummary
                displayName="Apple Inc. (AAPL)"
                assetClass="equity"
                items={items}
            />
        );

        expect(screen.getByText('애플 신제품 공개')).toBeInTheDocument();
    });

    it.each(['en', 'ja', 'zh'] as const)(
        '%s에서는 영어 제목을 쓴다',
        locale => {
            render(
                withLocale(
                    <NewsFactsSummary
                        displayName="Apple Inc. (AAPL)"
                        assetClass="equity"
                        items={items}
                    />,
                    locale
                )
            );

            expect(
                screen.getByText('Apple unveils new product')
            ).toBeInTheDocument();
            expect(
                screen.queryByText('애플 신제품 공개')
            ).not.toBeInTheDocument();
        }
    );
});

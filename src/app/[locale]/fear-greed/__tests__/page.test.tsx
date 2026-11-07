import { render, screen } from '@testing-library/react';
import {
    describe,
    it,
    expect,
    vi,
    beforeEach,
    type MockedFunction,
} from 'vitest';

vi.mock('@/widgets/market-fear-greed/MarketFearGreedPage', () => ({
    MarketFearGreedPage: () => null,
}));

vi.mock('@/entities/market-fear-greed/api/marketFearGreedStaticCache', () => ({
    getMarketFearGreedStatic: vi.fn(),
}));

import FearGreedRoutePage, {
    generateMetadata,
    revalidate,
} from '@/app/[locale]/fear-greed/page';
import { getMarketFearGreedStatic } from '@/entities/market-fear-greed/api/marketFearGreedStaticCache';
import type { MarketFearGreedView } from '@/entities/market-fear-greed/model';
import { SITE_URL } from '@/shared/lib/seo';
import { clampSeoDescription } from '@/shared/lib/seoClamp';
import { INDEXABLE_PAGE_ROBOTS } from '@/shared/test-utils/indexablePageRobots';

const mockGetMarketFearGreedStatic = getMarketFearGreedStatic as MockedFunction<
    typeof getMarketFearGreedStatic
>;

const SAMPLE_SNAPSHOT: MarketFearGreedView = {
    snapshot: {
        score: 62,
        label: 'GREED',
        factors: [],
        confidence: 'normal',
        sampleSize: 200,
        asOf: '2026-08-14',
    },
    comparisons: [],
};

describe('/fear-greed page', () => {
    beforeEach(() => {
        mockGetMarketFearGreedStatic.mockResolvedValue({
            snapshot: null,
            comparisons: [],
        });
    });

    describe('ISR route config', () => {
        it('exports revalidate = 3600 (literal — required for Next.js static analysis)', () => {
            // src/app/CLAUDE.md#AP-1: route segment config must be a literal, not an imported constant
            expect(revalidate).toBe(3600);
        });
    });

    describe('generateMetadata', () => {
        it('판독값이 있으면 점수·단계·기준일을 담은 제목을 브랜드 접미사 없이 쓴다', async () => {
            mockGetMarketFearGreedStatic.mockResolvedValue(SAMPLE_SNAPSHOT);
            const metadata = await generateMetadata({
                params: Promise.resolve({ locale: 'ko' }),
            });
            expect(metadata.title).toEqual({
                absolute: '미국 공포탐욕지수 62점(탐욕) 8월 14일 기준',
            });
        });

        it('판독값이 없으면 템플릿 제목으로 돌아간다', async () => {
            const metadata = await generateMetadata({
                params: Promise.resolve({ locale: 'ko' }),
            });
            expect(String(metadata.title)).toContain('공포 탐욕 지수');
        });

        it('runs the description through clampSeoDescription (idempotent under the clamp)', async () => {
            mockGetMarketFearGreedStatic.mockResolvedValue(SAMPLE_SNAPSHOT);
            const metadata = await generateMetadata({
                params: Promise.resolve({ locale: 'ko' }),
            });
            const description = String(metadata.description);
            expect(description.length).toBeGreaterThan(0);
            // If the description were not already clamped, clamping it again would change it.
            expect(clampSeoDescription(description)).toBe(description);
        });

        it('sets the static /og-image.png as the OG/Twitter image', async () => {
            mockGetMarketFearGreedStatic.mockResolvedValue(SAMPLE_SNAPSHOT);
            const metadata = await generateMetadata({
                params: Promise.resolve({ locale: 'ko' }),
            });
            expect(metadata.openGraph?.images).toEqual([
                expect.objectContaining({ url: '/og-image.png' }),
            ]);
            expect(metadata.twitter?.images).toEqual(['/og-image.png']);
        });

        describe('when a snapshot is available', () => {
            beforeEach(() => {
                mockGetMarketFearGreedStatic.mockResolvedValue(SAMPLE_SNAPSHOT);
            });

            it('sets canonical to /fear-greed', async () => {
                const metadata = await generateMetadata({
                    params: Promise.resolve({ locale: 'ko' }),
                });
                expect(metadata.alternates?.canonical).toBe(
                    `${SITE_URL}/fear-greed`
                );
            });

            it('does not set noindex — the page is meant to be crawled', async () => {
                const metadata = await generateMetadata({
                    params: Promise.resolve({ locale: 'ko' }),
                });
                expect(metadata.robots).toMatchObject(INDEXABLE_PAGE_ROBOTS);
            });
        });

        describe('when degraded (snapshot: null)', () => {
            beforeEach(() => {
                mockGetMarketFearGreedStatic.mockResolvedValue({
                    snapshot: null,
                    comparisons: [],
                });
            });

            it('self-canonical만 내고 hreflang 군집은 싣지 않는다', async () => {
                const metadata = await generateMetadata({
                    params: Promise.resolve({ locale: 'ko' }),
                });
                // degraded(noindex)도 self-canonical — null로 비우면 신호가 사라진다. hreflang은 없다.
                expect(metadata.alternates).toEqual({
                    canonical: 'https://siglens.io/fear-greed',
                });
            });

            it('sets noindex, follow', async () => {
                const metadata = await generateMetadata({
                    params: Promise.resolve({ locale: 'ko' }),
                });
                expect(metadata.robots).toEqual({
                    index: false,
                    follow: true,
                });
            });
        });

        it('degrades to noindex when getMarketFearGreedStatic rejects, without throwing', async () => {
            mockGetMarketFearGreedStatic.mockRejectedValue(
                new Error('redis down')
            );
            const consoleSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => undefined);

            const metadata = await generateMetadata({
                params: Promise.resolve({ locale: 'ko' }),
            });

            expect(metadata.robots).toEqual({ index: false, follow: true });
            // degraded(noindex)도 self-canonical — null로 비우면 신호가 사라진다. hreflang은 없다.
            expect(metadata.alternates).toEqual({
                canonical: 'https://siglens.io/fear-greed',
            });
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining(
                    '[FearGreedRoute] getMarketFearGreedStatic failed (metadata):'
                ),
                expect.any(Error)
            );

            consoleSpy.mockRestore();
        });
    });

    describe('page body', () => {
        it('renders a single h1 and passes the fetched view to the widget', async () => {
            render(
                await FearGreedRoutePage({
                    params: Promise.resolve({ locale: 'ko' }),
                })
            );
            expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(
                1
            );
        });

        it('renders the 공포탐욕지수 읽는 법 guide with all five score bands', async () => {
            render(
                await FearGreedRoutePage({
                    params: Promise.resolve({ locale: 'ko' }),
                })
            );
            expect(
                screen.getByText('공포탐욕지수 읽는 법')
            ).toBeInTheDocument();
            expect(screen.getByText(/0~24점/)).toBeInTheDocument();
            expect(screen.getByText(/25~44점/)).toBeInTheDocument();
            expect(screen.getByText(/45~54점/)).toBeInTheDocument();
            expect(screen.getByText(/55~74점/)).toBeInTheDocument();
            expect(screen.getByText(/75~100점/)).toBeInTheDocument();
        });

        it('renders a visible 자주 묻는 질문 section with all three FAQ questions', async () => {
            render(
                await FearGreedRoutePage({
                    params: Promise.resolve({ locale: 'ko' }),
                })
            );
            expect(screen.getByText('자주 묻는 질문')).toBeInTheDocument();
            expect(
                screen.getByText('시장 공포 탐욕 지수는 무엇을 측정하나요?')
            ).toBeInTheDocument();
            expect(
                screen.getByText('CNN의 Fear & Greed Index와 같은 지수인가요?')
            ).toBeInTheDocument();
            expect(
                screen.getByText('점수는 얼마나 자주 갱신되나요?')
            ).toBeInTheDocument();
        });
    });

    describe('JSON-LD', () => {
        it('renders WebPage, BreadcrumbList, and FAQPage JSON-LD blocks', async () => {
            mockGetMarketFearGreedStatic.mockResolvedValue(SAMPLE_SNAPSHOT);
            const { container } = render(
                await FearGreedRoutePage({
                    params: Promise.resolve({ locale: 'ko' }),
                })
            );
            const scripts = Array.from(
                container.querySelectorAll('script[type="application/ld+json"]')
            );
            const types = scripts.map(
                s => JSON.parse(s.textContent ?? '{}')['@type']
            );
            expect(types).toContain('WebPage');
            expect(types).toContain('BreadcrumbList');
            expect(types).toContain('FAQPage');

            // 이름까지 고정한다 — @type만 보면 `미국`이 떨어져 나가도 통과한다.
            const breadcrumb = scripts
                .map(s => JSON.parse(s.textContent ?? '{}'))
                .find(d => d['@type'] === 'BreadcrumbList');
            expect(breadcrumb.itemListElement.at(-1).name).toBe(
                '미국 공포 탐욕 지수'
            );
        });

        it('one FAQ answer states the index is computed independently from CNN', async () => {
            const { container } = render(
                await FearGreedRoutePage({
                    params: Promise.resolve({ locale: 'ko' }),
                })
            );
            const scripts = Array.from(
                container.querySelectorAll('script[type="application/ld+json"]')
            );
            const faq = scripts
                .map(s => JSON.parse(s.textContent ?? '{}'))
                .find(d => d['@type'] === 'FAQPage');
            expect(faq).toBeDefined();

            const answers = (
                faq.mainEntity as {
                    acceptedAnswer: { text: string };
                }[]
            ).map(q => q.acceptedAnswer.text);
            expect(
                answers.some(
                    text => text.includes('CNN') && text.includes('독립')
                )
            ).toBe(true);
        });

        it('sets WebPage dateModified to snapshot.asOf when a snapshot exists', async () => {
            mockGetMarketFearGreedStatic.mockResolvedValue(SAMPLE_SNAPSHOT);
            const { container } = render(
                await FearGreedRoutePage({
                    params: Promise.resolve({ locale: 'ko' }),
                })
            );
            const scripts = Array.from(
                container.querySelectorAll('script[type="application/ld+json"]')
            );
            const webPage = scripts
                .map(s => JSON.parse(s.textContent ?? '{}'))
                .find(d => d['@type'] === 'WebPage');
            expect(webPage.dateModified).toBe(SAMPLE_SNAPSHOT.snapshot?.asOf);
        });

        it('snapshot이 있으면 dateModified에 그 세션 날짜를 쓴다', async () => {
            mockGetMarketFearGreedStatic.mockResolvedValue(SAMPLE_SNAPSHOT);
            const { container } = render(
                await FearGreedRoutePage({
                    params: Promise.resolve({ locale: 'ko' }),
                })
            );
            const webPage = Array.from(
                container.querySelectorAll('script[type="application/ld+json"]')
            )
                .map(s => JSON.parse(s.textContent ?? '{}'))
                .find(d => d['@type'] === 'WebPage');
            expect(webPage.dateModified).toBe('2026-08-14');
        });

        /**
         * 표본이 부족하면 `generateMetadata`가 noindex를 건다(canonical은 self, hreflang 없음).
         * 그 상태에서 WebPage/Breadcrumb을 그대로 내면 "색인하지 말라"면서
         * "이 URL이 정식 WebPage"라고 주장하는 모순이 된다. FAQ는 질문·답변이
         * 화면에 그대로 있으므로 예외다.
         */
        it('표본이 없으면 FAQ만 남기고 나머지 구조화데이터를 빼다', async () => {
            mockGetMarketFearGreedStatic.mockResolvedValue({
                snapshot: null,
                comparisons: [],
            });
            const { container } = render(
                await FearGreedRoutePage({
                    params: Promise.resolve({ locale: 'ko' }),
                })
            );
            const types = Array.from(
                container.querySelectorAll('script[type="application/ld+json"]')
            ).map(s => JSON.parse(s.textContent ?? '{}')['@type']);

            expect(types).toEqual(['FAQPage']);
        });
    });

    describe('ISR degrade guard', () => {
        it('getMarketFearGreedStatic rejecting degrades to a 200 render instead of throwing', async () => {
            mockGetMarketFearGreedStatic.mockRejectedValue(
                new Error('redis down')
            );
            const consoleSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => undefined);

            const element = await FearGreedRoutePage({
                params: Promise.resolve({ locale: 'ko' }),
            });
            render(element);

            expect(
                screen.getByRole('heading', { level: 1 })
            ).toBeInTheDocument();
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining(
                    '[FearGreedRoute] getMarketFearGreedStatic failed:'
                ),
                expect.any(Error)
            );

            consoleSpy.mockRestore();
        });

        it('an empty reading (snapshot: null) still renders a normal page — no notFound()', async () => {
            mockGetMarketFearGreedStatic.mockResolvedValue({
                snapshot: null,
                comparisons: [],
            });

            render(
                await FearGreedRoutePage({
                    params: Promise.resolve({ locale: 'ko' }),
                })
            );
            expect(
                screen.getByRole('heading', { level: 1 })
            ).toBeInTheDocument();
        });
    });
});

/**
 * 가시 브레드크럼은 `BreadcrumbList`의 `name`(`copy.heading`)과 **같은 문자열**을
 * 그려야 한다 — 여기는 h1(`copy.title`)이 그것과 다르므로, 브레드크럼이 h1을
 * 따라가면 마크업과 화면이 조용히 갈린다.
 */
describe('/fear-greed 가시 브레드크럼', () => {
    it('BreadcrumbList와 같은 마디를 그린다', async () => {
        mockGetMarketFearGreedStatic.mockResolvedValue(SAMPLE_SNAPSHOT);

        const { expectVisibleBreadcrumbMatchesJsonLdDom } =
            await import('@/__tests__/utils/expectVisibleBreadcrumb');
        const { koMessage } = await import('@/shared/test-utils/koMessage');

        const { container } = render(
            await FearGreedRoutePage({
                params: Promise.resolve({ locale: 'ko' }),
            })
        );

        expectVisibleBreadcrumbMatchesJsonLdDom(
            container,
            koMessage('shared.ui.Breadcrumb.46c31f')
        );
    });
});

const ANSWER_SNAPSHOT = {
    // 운영 판독값처럼 반올림 전 실수 — 문장·제목·Dataset은 화면처럼 정수로 말해야 한다.
    score: 24.48367166813769,
    label: 'EXTREME_FEAR',
    factors: [],
    confidence: 'normal',
    sampleSize: 200,
    asOf: '2026-11-05',
} as const satisfies NonNullable<MarketFearGreedView['snapshot']>;

const ANSWER_VIEW: MarketFearGreedView = {
    snapshot: ANSWER_SNAPSHOT,
    comparisons: [
        {
            key: 'now',
            date: '2026-11-05',
            score: 24.48367166813769,
            label: 'EXTREME_FEAR',
        },
        { key: '1w', date: '2026-10-29', score: 35.6, label: 'FEAR' },
        {
            key: '1m',
            date: '2026-10-06',
            score: 51.2,
            label: 'NEUTRAL',
        },
        { key: '1y', date: '2025-11-05', score: 33.7, label: 'FEAR' },
    ],
};

const ANSWER =
    '미국 시장 공포 탐욕 지수는 11월 5일 종가 기준 24점(극심한 공포)입니다. 1주 전 36점, 1개월 전 51점, 1년 전 34점이었습니다.';

/**
 * 판독값이 있으면 허브가 오늘 점수를 한 문장으로 먼저 말한다 — AI 검색이 인용하는 답 문장이다.
 * 같은 문장이 본문 첫 문단·meta·og·twitter 설명·WebPage description에 실린다.
 */
describe('/fear-greed 답 문장', () => {
    beforeEach(() => {
        mockGetMarketFearGreedStatic.mockResolvedValue(ANSWER_VIEW);
    });

    it('본문 설명 문단보다 먼저 답 문장을 그린다', async () => {
        const { container } = render(
            await FearGreedRoutePage({
                params: Promise.resolve({ locale: 'ko' }),
            })
        );
        const firstParagraph = container.querySelector('main section p');
        expect(firstParagraph?.textContent).toBe(ANSWER);
    });

    it('요인 백분위가 양쪽에 걸치면 답 문장 다음 문단에 가장 공포·탐욕 쪽 요인을 말한다', async () => {
        mockGetMarketFearGreedStatic.mockResolvedValue({
            ...ANSWER_VIEW,
            snapshot: {
                ...ANSWER_SNAPSHOT,
                factors: [
                    { key: 'momentum', rawValue: -0.03, percentile: 13 },
                    { key: 'breadth', rawValue: 0.07, percentile: 100 },
                ],
            },
        });
        const { container } = render(
            await FearGreedRoutePage({
                params: Promise.resolve({ locale: 'ko' }),
            })
        );
        const [first, second] = Array.from(
            container.querySelectorAll('main section p')
        );
        expect(first?.textContent).toBe(ANSWER);
        expect(second?.textContent).toMatch(
            /^지금 가장 공포 쪽에 있는 요인은 .+\(백분위 13\)이고, 가장 탐욕 쪽에 있는 요인은 .+\(백분위 100\)입니다\.$/
        );
    });

    it('WebPage JSON-LD 이름이 점수형 제목과 같다', async () => {
        const { container } = render(
            await FearGreedRoutePage({
                params: Promise.resolve({ locale: 'ko' }),
            })
        );
        const webPage = Array.from(
            container.querySelectorAll('script[type="application/ld+json"]')
        )
            .map(el => JSON.parse(el.textContent ?? '{}'))
            .find(d => d['@type'] === 'WebPage');
        expect(webPage.name).toContain(
            '미국 공포탐욕지수 24점(극심한 공포) 11월 5일 기준'
        );
    });

    it('meta·og·twitter 설명이 같은 답 문장이다', async () => {
        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'ko' }),
        });
        expect(metadata.description).toBe(ANSWER);
        const og = metadata.openGraph as Record<string, unknown>;
        expect(og.description).toBe(ANSWER);
        const twitter = metadata.twitter as Record<string, unknown>;
        expect(twitter.description).toBe(ANSWER);
    });

    it('Dataset JSON-LD가 판독일·기간·점수를 싣는다', async () => {
        const { container } = render(
            await FearGreedRoutePage({
                params: Promise.resolve({ locale: 'ko' }),
            })
        );
        const blocks = Array.from(
            container.querySelectorAll('script[type="application/ld+json"]')
        ).map(s => JSON.parse(s.textContent ?? '{}'));
        const dataset = blocks.find(d => d['@type'] === 'Dataset');
        expect(dataset).toMatchObject({
            url: `${SITE_URL}/fear-greed`,
            dateModified: '2026-11-05',
            temporalCoverage: '2025-11-05/2026-11-05',
            variableMeasured: { minValue: 0, maxValue: 100, value: 24 },
            license: `${SITE_URL}/terms`,
        });
        const webPage = blocks.find(d => d['@type'] === 'WebPage');
        expect(webPage.description).toBe(ANSWER);
    });

    it('Dataset url·creator는 로케일 주소와 인라인 조직이다', async () => {
        const { container } = render(
            await FearGreedRoutePage({
                params: Promise.resolve({ locale: 'en' }),
            })
        );
        const dataset = Array.from(
            container.querySelectorAll('script[type="application/ld+json"]')
        )
            .map(s => JSON.parse(s.textContent ?? '{}'))
            .find(d => d['@type'] === 'Dataset');
        expect(dataset.url).toBe(`${SITE_URL}/en/fear-greed`);
        expect(dataset.creator).toMatchObject({
            '@type': 'Organization',
            name: 'SIGLENS',
            url: SITE_URL,
        });
    });

    it('판독값이 없으면 답 문장·Dataset 없이 템플릿 설명으로 떨어진다', async () => {
        mockGetMarketFearGreedStatic.mockResolvedValue({
            snapshot: null,
            comparisons: [],
        });
        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'ko' }),
        });
        expect(metadata.description).not.toContain('점(');
        const { container } = render(
            await FearGreedRoutePage({
                params: Promise.resolve({ locale: 'ko' }),
            })
        );
        expect(container.textContent).not.toContain('종가 기준 24점');
        const types = Array.from(
            container.querySelectorAll('script[type="application/ld+json"]')
        ).map(s => JSON.parse(s.textContent ?? '{}')['@type']);
        expect(types).not.toContain('Dataset');
    });
});

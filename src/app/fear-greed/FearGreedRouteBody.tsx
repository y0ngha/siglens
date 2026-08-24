import { MARKET_FEAR_GREED_FACTOR_KEYS } from '@y0ngha/siglens-core';
import { MarketFearGreedPage } from '@/widgets/market-fear-greed';
import type { MarketFearGreedView } from '@/entities/market-fear-greed';
import { RegionTabs } from '@/shared/ui/RegionTabs';
import { JsonLd } from '@/shared/ui/JsonLd';
import { buildBreadcrumbJsonLd, SITE_NAME, SITE_URL } from '@/shared/lib/seo';
import {
    MARKET_FACTOR_DESCRIPTION,
    MARKET_FACTOR_LABEL,
    type FearGreedMarketId,
} from '@/shared/lib/marketFearGreedLabels';
import { FEAR_GREED_BANDS, FEAR_GREED_COPY } from './copy';

interface FearGreedRouteBodyProps {
    readonly market: FearGreedMarketId;
    readonly view: MarketFearGreedView;
}

/**
 * 미국·한국 공포·탐욕 라우트가 공유하는 본문.
 *
 * 두 페이지는 구조(지역 탭 → h1 → 설명 → 게이지·요인 → 읽는 법 → FAQ)가 완전히
 * 같고 문장만 다르다. 라우트마다 250줄을 복사하면 한쪽만 고쳐지는 순간
 * "읽는 법"이 실제 계산과 어긋나는데, 그건 화면상 아무 표시도 나지 않는다.
 * 문장은 `copy.ts`가, 구조는 여기가 소유한다.
 *
 * 서버 컴포넌트 — 활성 지역은 라우트가 알고 있으므로 `usePathname`이 필요 없다.
 */
export function FearGreedRouteBody({ market, view }: FearGreedRouteBodyProps) {
    const copy = FEAR_GREED_COPY[market];
    const factorLabel = MARKET_FACTOR_LABEL[market];
    const factorDescription = MARKET_FACTOR_DESCRIPTION[market];
    const url = `${SITE_URL}${copy.path}`;
    /*
     * 표본이 부족하면 이 페이지는 설명문만 남고 판독값이 없다. 그 상태에서
     * `generateMetadata`는 canonical을 비우고 noindex를 건다 — 구조화데이터가
     * 그대로 나가면 "색인하지 말라"면서 "이 URL이 정식 WebPage"라고 주장하는
     * 모순이 된다. `/news/[category]`가 같은 상태에서 JSON-LD를 통째로 빼는 규칙을
     * 이미 쓴다.
     *
     * FAQ는 예외다 — 질문·답변이 판독값과 무관하게 화면에 그대로 있다.
     */
    const degraded = view.snapshot === null;

    const webPageJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        '@id': `${url}#webpage`,
        name: `${copy.title} | ${SITE_NAME}`,
        description: copy.description,
        url,
        inLanguage: 'ko',
        isPartOf: { '@type': 'WebSite', '@id': `${SITE_URL}#website` },
        // snapshot이 있을 때만 실제 세션 날짜를 노출한다 — 표본 부족(snapshot: null)
        // 상태에서는 가짜 날짜를 지어내지 않고 필드 자체를 생략한다.
        ...(view.snapshot ? { dateModified: view.snapshot.asOf } : {}),
    };

    const breadcrumbJsonLd = buildBreadcrumbJsonLd([
        { name: copy.heading, url },
    ]);

    const faqJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: copy.faq.map(({ question, answer }) => ({
            '@type': 'Question',
            name: question,
            acceptedAnswer: { '@type': 'Answer', text: answer },
        })),
    };

    return (
        <>
            {!degraded && (
                <>
                    <JsonLd data={webPageJsonLd} />
                    <JsonLd data={breadcrumbJsonLd} />
                </>
            )}
            <JsonLd data={faqJsonLd} />
            <main className="flex-1">
                <div className="page-container pt-6">
                    <RegionTabs
                        vertical="fear-greed"
                        active={market}
                        currentPath={copy.path}
                    />
                </div>
                <h1 className="page-container pt-6 text-2xl font-bold tracking-tight text-balance text-secondary-100 sm:text-3xl">
                    {copy.title}
                </h1>
                <section className="page-container space-y-3 pt-4 text-sm leading-relaxed text-secondary-400 sm:text-base">
                    {copy.intro.map(paragraph => (
                        <p key={paragraph}>{paragraph}</p>
                    ))}
                </section>
                <div className="page-container">
                    <MarketFearGreedPage view={view} market={market} />
                </div>
                {/* 컨테이너가 폭과 좌우 여백을 소유하고, 카드 장식(보더·배경·
                    패딩)은 안쪽 div가 갖는다. 컨테이너에 보더를 직접 걸면
                    1200px 전폭을 두르게 되어 형제 섹션과 어긋난다. */}
                <div className="page-container mt-6">
                    <section
                        aria-labelledby="market-fear-greed-guide-heading"
                        className="space-y-4 rounded-lg border border-secondary-800 bg-secondary-800/30 p-5"
                    >
                        <h2
                            id="market-fear-greed-guide-heading"
                            className="text-base font-semibold text-secondary-300"
                        >
                            공포탐욕지수 읽는 법
                        </h2>
                        <ul className="space-y-1 text-sm leading-relaxed text-secondary-400">
                            {FEAR_GREED_BANDS.map(band => (
                                <li key={band.label}>
                                    {band.min}~{band.max}점 — {band.label}
                                </li>
                            ))}
                        </ul>
                        <ul className="space-y-1 text-sm leading-relaxed text-secondary-400">
                            {MARKET_FEAR_GREED_FACTOR_KEYS.map(key => (
                                <li key={key}>
                                    {factorLabel[key]} —{' '}
                                    {factorDescription[key]}
                                </li>
                            ))}
                        </ul>
                    </section>
                </div>
                <section
                    aria-labelledby="market-fear-greed-faq-heading"
                    className="page-container pt-6"
                >
                    <h2
                        id="market-fear-greed-faq-heading"
                        className="text-base font-semibold text-secondary-300"
                    >
                        자주 묻는 질문
                    </h2>
                    <dl className="mt-3 space-y-4 text-sm leading-relaxed text-secondary-400">
                        {copy.faq.map(({ question, answer }) => (
                            <div key={question}>
                                <dt className="font-medium text-secondary-300">
                                    {question}
                                </dt>
                                <dd className="mt-1">{answer}</dd>
                            </div>
                        ))}
                    </dl>
                </section>
            </main>
        </>
    );
}

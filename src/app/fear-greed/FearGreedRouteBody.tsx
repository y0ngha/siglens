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
            <JsonLd data={webPageJsonLd} />
            <JsonLd data={breadcrumbJsonLd} />
            <JsonLd data={faqJsonLd} />
            <main className="flex-1">
                <div className="px-6 pt-6 lg:px-[15vw]">
                    <RegionTabs vertical="fear-greed" active={market} />
                </div>
                <h1 className="px-6 pt-6 text-2xl font-bold tracking-tight text-balance text-secondary-100 sm:text-3xl lg:px-[15vw]">
                    {copy.title}
                </h1>
                <section className="space-y-3 px-6 pt-4 text-sm leading-relaxed text-secondary-400 sm:text-base lg:px-[15vw]">
                    {copy.intro.map(paragraph => (
                        <p key={paragraph}>{paragraph}</p>
                    ))}
                </section>
                <div className="px-6 lg:px-[15vw]">
                    <MarketFearGreedPage view={view} market={market} />
                </div>
                <section
                    aria-labelledby="market-fear-greed-guide-heading"
                    className="mx-6 mt-6 space-y-4 rounded-lg border border-secondary-800 bg-secondary-800/30 p-5 lg:mx-[15vw]"
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
                                {factorLabel[key]} — {factorDescription[key]}
                            </li>
                        ))}
                    </ul>
                </section>
                <section
                    aria-labelledby="market-fear-greed-faq-heading"
                    className="px-6 pt-6 lg:px-[15vw]"
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

import type { Metadata } from 'next';
import {
    FEAR_GREED_LABEL_CUTOFFS,
    MARKET_FEAR_GREED_FACTOR_KEYS,
} from '@y0ngha/siglens-core';
import { MarketFearGreedPage } from '@/widgets/market-fear-greed';
import { getMarketFearGreedStatic } from '@/entities/market-fear-greed/api/marketFearGreedStaticCache';
import type { MarketFearGreedView } from '@/entities/market-fear-greed';
import {
    buildBreadcrumbJsonLd,
    clampSeoDescription,
    SITE_NAME,
    SITE_URL,
} from '@/shared/lib/seo';
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from '@/shared/lib/og';
import { JsonLd } from '@/shared/ui/JsonLd';
import {
    MARKET_FACTOR_DESCRIPTION,
    MARKET_FACTOR_LABEL,
} from '@/shared/lib/marketFearGreedLabels';

// 1h — mirrors /market's single-page revalidate (see docs/architecture/ISR_REVALIDATE.md).
// getMarketFearGreedStatic itself already caches the reading at 1h, so this bounds the
// page shell's own background regen without adding extra staleness.
// literal required — importing a constant breaks Next's static analysis, see src/app/CLAUDE.md
export const revalidate = 3600;

const FEAR_GREED_PATH = '/fear-greed';
const FEAR_GREED_URL = `${SITE_URL}${FEAR_GREED_PATH}`;

// Root layout template appends "| Siglens" — exclude brand name to prevent duplication.
const FEAR_GREED_TITLE = '오늘 미국 증시 심리, 공포 탐욕 지수로 확인';
const FEAR_GREED_FULL_TITLE = `${FEAR_GREED_TITLE} | ${SITE_NAME}`;
const FEAR_GREED_DESCRIPTION = clampSeoDescription(
    'S&P500·VIX·장기국채·회사채·동일가중 지수의 최근 흐름을 묶어 미국 증시 전체의 매수 심리를 0~100 점수와 5단계 라벨로 보여줍니다.'
);
const FEAR_GREED_KEYWORDS = [
    '공포 탐욕 지수',
    '시장 심리 지수',
    '미국 증시 심리',
    'Fear and Greed Index',
    'VIX 지수',
    '증시 매수 심리',
];

/**
 * Score band → Korean label. Derived from `FEAR_GREED_LABEL_CUTOFFS` (core) rather than
 * hard-coded twice, so this guide never drifts from the boundaries `scoreToLabel` actually uses.
 */
const FEAR_GREED_BANDS = [
    {
        label: '극심한 공포',
        min: 0,
        max: FEAR_GREED_LABEL_CUTOFFS.EXTREME_FEAR_MAX - 1,
    },
    {
        label: '공포',
        min: FEAR_GREED_LABEL_CUTOFFS.EXTREME_FEAR_MAX,
        max: FEAR_GREED_LABEL_CUTOFFS.FEAR_MAX - 1,
    },
    {
        label: '중립',
        min: FEAR_GREED_LABEL_CUTOFFS.FEAR_MAX,
        max: FEAR_GREED_LABEL_CUTOFFS.NEUTRAL_MAX - 1,
    },
    {
        label: '탐욕',
        min: FEAR_GREED_LABEL_CUTOFFS.NEUTRAL_MAX,
        max: FEAR_GREED_LABEL_CUTOFFS.GREED_MAX - 1,
    },
    {
        label: '극심한 탐욕',
        min: FEAR_GREED_LABEL_CUTOFFS.GREED_MAX,
        max: 100,
    },
] as const;

/**
 * The three visible FAQ Q&As, shared between the JSON-LD `FAQPage` block and
 * the rendered 자주 묻는 질문 section below — Google requires FAQPage structured
 * data to correspond to content actually visible on the page, so both must be
 * built from this single source rather than kept in sync by hand.
 */
const FEAR_GREED_FAQ = [
    {
        question: '시장 공포 탐욕 지수는 무엇을 측정하나요?',
        answer: 'S&P500·VIX·장기국채·하이일드/투자등급 회사채·동일가중 지수, 5개 요인의 최근 종가 흐름을 묶어 미국 증시 전체의 단기 매수 심리를 0~100 점수로 나타냅니다.',
    },
    {
        question: 'CNN의 Fear & Greed Index와 같은 지수인가요?',
        answer: '이 지수는 CNN과는 독립적으로, 일별 종가 데이터만으로 자체 5개 요인(모멘텀·변동성·안전자산 선호·정크본드 수요·시장 폭)을 산출해 계산합니다. 옵션 Put/Call 비율 등 CNN이 쓰는 일부 지표는 포함하지 않으므로 공포·탐욕의 방향은 대체로 비슷하게 움직이지만, 계산 방식(construction)이 달라 정확한 점수는 CNN 지수와 일치하지 않습니다.',
    },
    {
        question: '점수는 얼마나 자주 갱신되나요?',
        answer: '정규장 마감 종가를 기준으로 세션 단위(하루 한 번)로 갱신되며, 페이지 자체는 최대 1시간 캐시됩니다.',
    },
] as const;

export async function generateMetadata(): Promise<Metadata> {
    // 외부 I/O(Redis/FMP) 오류는 graceful 처리 — null이면 degraded 경로로 폴백.
    // getMarketFearGreedStatic은 React.cache + unstable_cache로 이중 래핑되어
    // 있어 페이지 본문에서 다시 호출해도 fetch가 한 번만 실행된다.
    const view = await getMarketFearGreedStatic().catch((e: unknown) => {
        console.error(
            // 접두사를 페이지 본문 로그와 통일한다 — CloudWatch 메트릭 필터
            // (`siglens-fear-greed-loader-failed`)가 이 문자열 하나만 본다.
            '[FearGreedRoute] getMarketFearGreedStatic failed (metadata):',
            e
        );
        return null;
    });
    const degraded = view === null || view.snapshot === null;

    return {
        title: FEAR_GREED_TITLE,
        description: FEAR_GREED_DESCRIPTION,
        keywords: FEAR_GREED_KEYWORDS,
        // degraded 시 canonical을 null로 비워 크롤러가 표본 부족(~600자 explainer만
        // 있는) 상태를 색인하지 않도록 한다. follow: true는 유지해 링크 주스가
        // 내부 링크로 계속 흐르게 한다.
        alternates: { canonical: degraded ? null : FEAR_GREED_URL },
        robots: degraded ? { index: false, follow: true } : undefined,
        openGraph: {
            title: FEAR_GREED_FULL_TITLE,
            description: FEAR_GREED_DESCRIPTION,
            url: FEAR_GREED_URL,
            siteName: SITE_NAME,
            locale: 'ko_KR',
            type: 'website',
            images: [
                {
                    url: '/og-image.png',
                    width: OG_IMAGE_WIDTH,
                    height: OG_IMAGE_HEIGHT,
                    alt: FEAR_GREED_FULL_TITLE,
                },
            ],
        },
        twitter: {
            card: 'summary_large_image',
            title: FEAR_GREED_FULL_TITLE,
            description: FEAR_GREED_DESCRIPTION,
            images: ['/og-image.png'],
        },
    };
}

export default async function FearGreedRoutePage() {
    // 외부 I/O(Redis/FMP) 오류는 graceful 처리 — 빈 캐시 동결 방지를 위해 throw 대신
    // empty snapshot으로 폴백한다(/market 페이지와 동일 패턴). MarketFearGreedPage는
    // snapshot === null을 "표본 부족"으로 정상 렌더한다 — notFound()는 여기서 절대 쓰지
    // 않는다(Suspense 안 notFound가 soft-404를 만든 이력이 있다).
    const view: MarketFearGreedView = await getMarketFearGreedStatic().catch(
        (e: unknown) => {
            console.error(
                '[FearGreedRoute] getMarketFearGreedStatic failed:',
                e
            );
            return { snapshot: null, comparisons: [] };
        }
    );

    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        '@id': `${FEAR_GREED_URL}#webpage`,
        name: FEAR_GREED_FULL_TITLE,
        description: FEAR_GREED_DESCRIPTION,
        url: FEAR_GREED_URL,
        inLanguage: 'ko',
        isPartOf: { '@type': 'WebSite', '@id': `${SITE_URL}#website` },
        // snapshot이 있을 때만 실제 세션 날짜를 노출한다 — 표본 부족(snapshot: null)
        // 상태에서는 가짜 날짜를 지어내지 않고 필드 자체를 생략한다.
        ...(view.snapshot ? { dateModified: view.snapshot.asOf } : {}),
    };

    const breadcrumbJsonLd = buildBreadcrumbJsonLd([
        { name: '미국 공포·탐욕 지수', url: FEAR_GREED_URL },
    ]);

    const faqJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: FEAR_GREED_FAQ.map(({ question, answer }) => ({
            '@type': 'Question',
            name: question,
            acceptedAnswer: { '@type': 'Answer', text: answer },
        })),
    };

    return (
        <>
            <JsonLd data={jsonLd} />
            <JsonLd data={breadcrumbJsonLd} />
            <JsonLd data={faqJsonLd} />
            <main className="flex-1">
                <h1 className="px-6 pt-10 text-2xl font-bold tracking-tight text-balance text-secondary-100 sm:text-3xl lg:px-[15vw]">
                    {FEAR_GREED_TITLE}
                </h1>
                <section className="space-y-3 px-6 pt-4 text-sm leading-relaxed text-secondary-400 sm:text-base lg:px-[15vw]">
                    <p>
                        시장 공포 탐욕 지수는 S&amp;P500, VIX, 장기국채,
                        회사채(하이일드·투자등급), 동일가중 지수의 최근 종가
                        흐름을 묶어 미국 증시 전체의 단기 매수 심리를 0~100
                        점수로 나타냅니다.
                    </p>
                    <p>
                        5개 요인을 각각 과거 분포 안에서 백분위로 환산한 뒤 동일
                        가중으로 평균해 산출하며, 점수가 낮을수록 공포, 높을수록
                        탐욕 심리가 강하다는 뜻입니다.
                    </p>
                </section>
                <div className="px-6 lg:px-[15vw]">
                    <MarketFearGreedPage view={view} />
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
                                {MARKET_FACTOR_LABEL[key]} —{' '}
                                {MARKET_FACTOR_DESCRIPTION[key]}
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
                        {FEAR_GREED_FAQ.map(({ question, answer }) => (
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

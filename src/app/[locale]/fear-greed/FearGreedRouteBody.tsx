import { useTranslations } from 'next-intl';
import {
    CRYPTO_FEAR_GREED_FACTOR_KEYS,
    MARKET_FEAR_GREED_FACTOR_KEYS,
} from '@y0ngha/siglens-core';
import type {
    MarketFearGreedView,
    MarketFearGreedViewSnapshot,
} from '@/entities/market-fear-greed/model';
import { MarketFearGreedPage } from '@/widgets/market-fear-greed/MarketFearGreedPage';
import { useMarketFactorLabels } from '@/shared/hooks/useMarketFactorLabels';
import type { Locale } from '@/shared/i18n/locales';
import { brandTitle } from '@/shared/lib/brandName';
import { cn } from '@/shared/lib/cn';
import { METHODOLOGY_PATH, TERMS_PATH } from '@/shared/lib/legal';
import type { FearGreedMarketId } from '@/shared/lib/marketFearGreedLabels';
import {
    buildBreadcrumbJsonLd,
    buildFaqJsonLd,
    buildWebPageJsonLd,
    localizedAbsoluteUrl,
    ORGANIZATION_JSON_LD_ID,
    SITE_URL,
} from '@/shared/lib/seo';
import { SITE_NAME } from '@/shared/config/brand';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { Breadcrumb } from '@/shared/ui/Breadcrumb';
import { JsonLd } from '@/shared/ui/JsonLd';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { RegionTabs } from '@/shared/ui/RegionTabs';
import { FEAR_GREED_BANDS, fearGreedCopyFor } from './copy';
import type { FearGreedSymbolLink } from './fearGreedRoute';
import { composeMarketFearGreedAnswer } from './_lib/marketFearGreedAnswer';

interface FearGreedRouteBodyProps {
    readonly market: FearGreedMarketId;
    readonly view: MarketFearGreedView<MarketFearGreedViewSnapshot>;
    /**
     * 훅이 아니라 prop으로 받는다 — 테스트가 이 컴포넌트를 함수로 직접
     * 호출하고 그 자리에는 React 컨텍스트가 없어 `useLocale()`이 던진다.
     */
    readonly locale: Locale;
    /**
     * 허브 하단 "종목별 공포·탐욕 지수" 목록(그 시장의 색인 종목). 서버 페이지가 미리
     * 읽어 넘긴다 — 이 컴포넌트는 함수로 직접 호출되는 동기 컴포넌트라 자기 I/O를 갖지
     * 않는다. 비면 섹션을 생략한다.
     */
    readonly symbolLinks?: readonly FearGreedSymbolLink[];
}

/**
 * "읽는 법"이 나열할 요인. 판독값이 없어도(표본 부족) 설명은 그대로 보여야 하므로
 * 스냅샷이 아니라 시장에서 정한다. 암호화폐는 요인 집합 자체가 다르다.
 */
const FACTOR_KEYS: Record<FearGreedMarketId, readonly string[]> = {
    us: MARKET_FEAR_GREED_FACTOR_KEYS,
    kr: MARKET_FEAR_GREED_FACTOR_KEYS,
    crypto: CRYPTO_FEAR_GREED_FACTOR_KEYS,
};

/**
 * 미국·한국·암호화폐 공포·탐욕 라우트가 공유하는 본문.
 *
 * 세 페이지는 구조(지역 탭 → h1 → 설명 → 게이지·요인 → 읽는 법 → FAQ → 종목 목록)가 같고
 * 문장만 다르다. 라우트마다 복사하면 한쪽만 고쳐지는 순간 "읽는 법"이 실제 계산과
 * 어긋나는데, 그건 화면상 아무 표시도 나지 않는다. 문장은 `copy.ts`가, 구조는 여기가 소유한다.
 *
 * 서버 컴포넌트 — 활성 지역은 라우트가 알고 있으므로 `usePathname`이 필요 없다.
 */
export function FearGreedRouteBody({
    market,
    view,
    locale,
    symbolLinks = [],
}: FearGreedRouteBodyProps) {
    const t = useTranslations('app.fear-greed');
    const tSeo = useTranslations('shared.seo');
    const tLabel = useTranslations('shared.enumLabel');
    const copy = fearGreedCopyFor(market, tSeo);
    const { label: factorLabel, description: factorDescription } =
        useMarketFactorLabels(market);
    const url = `${SITE_URL}${copy.path}`;
    /*
     * 표본이 부족하면 이 페이지는 설명문만 남고 판독값이 없다. 그 상태에서
     * `generateMetadata`는 noindex를 건다(canonical은 self, hreflang 없음) — 구조화데이터가
     * 그대로 나가면 "색인하지 말라"면서 "이 URL이 정식 WebPage"라고 주장하는
     * 모순이 된다. `/news/[category]`가 같은 상태에서 JSON-LD를 통째로 빼는 규칙을
     * 이미 쓴다.
     *
     * FAQ는 예외다 — 질문·답변이 판독값과 무관하게 화면에 그대로 있다.
     */
    const degraded = view.snapshot === null;
    // 오늘 점수를 말하는 답 문장 — 첫 문단과 meta 설명(`fearGreedMetadata`)이 같은 문장이다.
    const answer = composeMarketFearGreedAnswer(
        view,
        copy.answerSubject,
        tSeo,
        tLabel
    );

    const webPageJsonLd = {
        ...buildWebPageJsonLd({
            url,
            name: brandTitle(copy.title, locale),
            description: answer ?? copy.description,
            locale,
        }),
        // snapshot이 있을 때만 실제 세션 날짜를 노출한다 — 표본 부족(snapshot: null)
        // 상태에서는 가짜 날짜를 지어내지 않고 필드 자체를 생략한다.
        ...(view.snapshot ? { dateModified: view.snapshot.asOf } : {}),
    };

    /*
     * 지수 자체를 데이터셋으로 선언한다 — 이 사이트가 직접 계산하는 1차 데이터라 AI 검색·
     * 데이터셋 검색이 출처로 집을 수 있는 유일한 표면이다. 다운로드 파일은 아직 없어
     * `distribution`은 싣지 않는다(공개 API를 열 때 함께 붙인다). 기간은 화면의 비교 시점 중
     * 가장 이른 세션부터 최신 판독일까지 — 화면이 실제로 보여 주는 범위만 말한다.
     */
    const earliestDate = view.comparisons
        .map(point => point.date)
        .toSorted()
        .at(0);
    const datasetJsonLd = view.snapshot && {
        '@context': 'https://schema.org',
        '@type': 'Dataset',
        name: copy.heading,
        description: copy.description,
        // 로케일별 URL — 같은 Dataset을 네 URL이 각자 자기 주소로 선언해야 크롤러가 언어
        // 클러스터를 하나로 접지 않는다(`backtestingJsonLd.ts`와 같은 이유).
        url: localizedAbsoluteUrl(url, locale),
        // 리치 결과 검사기는 다른 페이지에 정의된 `@id`를 따라가지 않는다 — 이름·종류를 인라인으로.
        creator: {
            '@type': 'Organization',
            '@id': ORGANIZATION_JSON_LD_ID,
            name: SITE_NAME,
            url: SITE_URL,
        },
        isAccessibleForFree: true,
        license: `${SITE_URL}${TERMS_PATH}`,
        measurementTechnique: `${SITE_URL}${METHODOLOGY_PATH}`,
        dateModified: view.snapshot.asOf,
        temporalCoverage: `${earliestDate ?? view.snapshot.asOf}/${view.snapshot.asOf}`,
        variableMeasured: {
            '@type': 'PropertyValue',
            name: copy.heading,
            minValue: 0,
            maxValue: 100,
            value: view.snapshot.score,
        },
    };

    const breadcrumbJsonLd = buildBreadcrumbJsonLd(
        [{ name: copy.heading, url }],
        locale
    );

    // 화면 `<dl>`과 같은 배열(`copy.faq`)에서 만든다 — 두 벌이면 한쪽만 고쳐져 리치 결과 자격을 잃는다.
    const faqJsonLd = buildFaqJsonLd(copy.faq);

    return (
        <>
            {!degraded && (
                <>
                    <JsonLd data={webPageJsonLd} />
                    <JsonLd data={breadcrumbJsonLd} />
                    {datasetJsonLd && <JsonLd data={datasetJsonLd} />}
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
                <div className="page-container pt-6">
                    {/* 가시 브레드크럼 — 텍스트가 BreadcrumbList JSON-LD의 `name`
                        (`copy.heading`)과 같아야 마크업이 무시되지 않는다. */}
                    <Breadcrumb trail={[{ label: copy.heading }]} />
                    <h1 className="text-2xl font-bold tracking-tight text-balance text-secondary-50 sm:text-3xl">
                        {copy.title}
                    </h1>
                </div>
                <section className="page-container space-y-3 pt-4 text-sm leading-relaxed text-secondary-400 sm:text-base">
                    {/* 답 문장이 정의 문단보다 먼저 온다 — 질문에 대한 답을 첫 문장에서 찾는
                        독자·AI 검색 모두를 위해서다. 판독값이 없으면 정의 문단만 남는다. */}
                    {answer && (
                        <p className="font-medium text-secondary-200">
                            {answer}
                        </p>
                    )}
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
                        className={cn('space-y-4 p-5', SURFACE_CARD)}
                    >
                        <h2
                            id="market-fear-greed-guide-heading"
                            className={HEADING_SECTION}
                        >
                            {t('FearGreedRouteBody.350c3b')}
                        </h2>
                        <ul className="space-y-1 text-sm leading-relaxed text-secondary-400">
                            {FEAR_GREED_BANDS.map(band => (
                                <li key={band.labelKey}>
                                    {t('bandRange', {
                                        v0: band.min,
                                        v1: band.max,
                                        v2: tLabel(band.labelKey),
                                    })}
                                </li>
                            ))}
                        </ul>
                        <ul className="space-y-1 text-sm leading-relaxed text-secondary-400">
                            {FACTOR_KEYS[market].map(key => (
                                <li key={key}>
                                    {factorLabel(key)}: {factorDescription(key)}
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
                        className={HEADING_SECTION}
                    >
                        {t('FearGreedRouteBody.ae2ce9')}
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
                {symbolLinks.length > 0 && (
                    <section
                        aria-labelledby="market-fear-greed-symbols-heading"
                        className="page-container pt-6 pb-8"
                    >
                        <h2
                            id="market-fear-greed-symbols-heading"
                            className={HEADING_SECTION}
                        >
                            {t('symbolListTitle')}
                        </h2>
                        <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-4">
                            {symbolLinks.map(item => (
                                <li key={item.symbol} className="min-w-0">
                                    <Link
                                        href={`/${item.symbol}/fear-greed`}
                                        // 허브당 수백 개 링크 — prefetch가 붙으면 진입만으로
                                        // 수백 개 `_rsc` 요청이 나간다.
                                        prefetch={false}
                                        className="block truncate rounded text-sm text-secondary-300 transition-colors hover:text-primary-400 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                                    >
                                        {item.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}
            </main>
        </>
    );
}

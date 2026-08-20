import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { DEFAULT_LOCALE, isLocale } from '@/shared/i18n/locales';
import {
    localeAlternatesFrom,
    localeCanonical,
    localeOpenGraph,
    localeRobots,
} from '@/shared/lib/seoAlternates';
import { Suspense } from 'react';

import {
    EconomicCalendar,
    EconomySkeleton,
    KrEconomicIndicatorGrid,
} from '@/widgets/economy';
// entities/economy/api/*는 server-only(`@upstash/redis` + `next/cache`) 의존이라
// 슬라이스 barrel에서 의도적으로 제외돼 있다. app 레이어가 server-only 모듈을 직접
// import하는 것은 클라이언트 번들 누출 위험이 없으므로 허용된다.
import {
    getKrIndicatorCards,
    type KrIndicatorCard,
} from '@/entities/economy/api/getKrIndicatorCards';
import { getCalendarFromDb } from '@/entities/economy/api/getCalendarFromDb';
import { resolveIndicatorLabels } from '@/entities/economy/api/resolveIndicatorLabels';
import { etDateOf, kstDateOf } from '@/entities/economy/lib/calendarWindow';
import { cache } from 'react';
import { CALENDAR_COUNTRY_KR } from '@/entities/economy/lib/economyCalendarConstants';
import { RegionTabs } from '@/shared/ui/RegionTabs';
import {
    buildBreadcrumbJsonLd,
    clampSeoDescription,
    ROOT_KEYWORDS,
    SITE_NAME,
    SITE_URL,
} from '@/shared/lib/seo';
import { TERMS_PATH } from '@/shared/lib/legal';
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from '@/shared/lib/og';
import { JsonLd } from '@/shared/ui/JsonLd';
import { KR_ECONOMY_INDICATORS } from '@/shared/config/economyIndicatorsKr';

import { KR_ECONOMY_TITLE } from '../constants';

// 24h — ISR. 거시 지표는 월·분기 단위로 변하고, 신선도는 캘린더 인제스션의
// `revalidateTag('economy:calendar')`가 책임진다. 시간 기반은 상한만 정한다.
// 리터럴 강제 — 상수를 import하면 Next의 정적 분석이 깨진다(src/app/CLAUDE.md).
export const revalidate = 86400;

const ECONOMY_KR_URL = `${SITE_URL}/economy/kr`;
const ECONOMY_KR_FULL_TITLE = `${KR_ECONOMY_TITLE} | ${SITE_NAME}`;
const ECONOMY_KR_DESCRIPTION = clampSeoDescription(
    '한국 경제 지표를 한 페이지에서 확인해요. 기준금리·소비자물가·고용률·GDP 성장률 같은 핵심 지표부터 국고채 금리, 수출 증가율까지 모아서 보여드리고, 다가오는 국내 경제 발표 일정도 함께 안내해드려요.'
);
const ECONOMY_KR_KEYWORDS = [
    ...ROOT_KEYWORDS,
    '한국 경제 지표',
    '한국은행 기준금리',
    '국내 소비자물가',
    '한국 실업률',
    '한국 GDP 성장률',
    '국고채 금리',
    '국내 경제 캘린더',
    '수출 증가율',
];

/**
 * 이 요청의 "지금". **`generateMetadata`와 본문이 같은 인스턴트를 봐야 한다.**
 *
 * 각자 `new Date()`를 부르면 ET 자정 경계에서 두 앵커가 갈리고, 로더의
 * `React.cache` 메모가 앵커를 키로 삼으므로 DB를 두 번 읽는다. 더 나쁜 건
 * metadata가 판정한 degraded(=noindex)와 실제로 렌더된 내용이 어긋날 수 있다는
 * 점이다 — 색인되는 페이지가 빈 상태를 보여주거나 그 반대가 된다.
 */
const requestNow = cache(() => new Date());

interface LocaleMetadataParams {
    readonly params: Promise<{ locale: string }>;
}

export async function generateMetadata({
    params,
}: LocaleMetadataParams): Promise<Metadata> {
    const { locale } = await params;
    const resolvedLocale = isLocale(locale) ? locale : DEFAULT_LOCALE;
    const ogLocale = localeOpenGraph(resolvedLocale);
    // og:url도 로케일별이어야 한다 — 소셜 언퍼널이 ko URL로 되돌린다.
    const localizedUrl = localeCanonical(resolvedLocale, '/economy/kr');
    /*
     * degrade 판정은 **본문과 완전히 같은 식**이어야 한다.
     *
     * 지표만 비고 캘린더는 찬 상태가 첫 크롤의 가장 흔한 모습이다 — 캘린더는 인제스션
     * 직후 다가오는 일정이 바로 들어오지만, 지표 카드는 과거 `actual`이 쌓여야 나온다.
     * 이때 지표 개수만 보면 **꽉 찬 페이지에 noindex**가 붙는다.
     *
     * 두 로더 모두 `React.cache`로 감싸여 있어 본문에서 다시 호출해도 왕복은 한 번이다.
     */
    const todayEt = etDateOf(requestNow());
    const [cards, calendarEvents] = await Promise.all([
        getKrIndicatorCards(todayEt).catch((e: unknown) => {
            console.error(
                '[economy.kr.generateMetadata] indicators failed:',
                e
            );
            return [] as KrIndicatorCard[];
        }),
        getCalendarFromDb(todayEt, CALENDAR_COUNTRY_KR).catch((e: unknown) => {
            console.error('[economy.kr.generateMetadata] calendar failed:', e);
            return [];
        }),
    ]);
    const degraded = cards.length === 0 && calendarEvents.length === 0;

    return {
        title: KR_ECONOMY_TITLE,
        description: ECONOMY_KR_DESCRIPTION,
        keywords: ECONOMY_KR_KEYWORDS,
        // degraded 시 canonical을 비우고 noindex — 지표가 하나도 없는 임시 상태를
        // 색인시키지 않는다. follow는 유지해 내부 링크로 주스가 계속 흐르게 한다.
        alternates: await localeAlternatesFrom(params, '/economy/kr', {
            // canonical은 넘기지 않는다 — `localeAlternatesFrom`이 로케일별
            // 자기참조 URL을 만든다. ko 절대 URL을 넘기면 `/en/…`이 ko를
            // canonical로 가리켜 hreflang 상호참조가 깨진다.
            canonical: degraded ? null : undefined,
        }),
        robots: degraded
            ? { index: false, follow: true }
            : localeRobots(resolvedLocale),
        openGraph: {
            title: ECONOMY_KR_FULL_TITLE,
            description: ECONOMY_KR_DESCRIPTION,
            url: localizedUrl,
            siteName: SITE_NAME,
            ...ogLocale,
            type: 'website',
            images: [
                {
                    url: '/og-image.png',
                    width: OG_IMAGE_WIDTH,
                    height: OG_IMAGE_HEIGHT,
                    alt: ECONOMY_KR_FULL_TITLE,
                },
            ],
        },
        twitter: {
            card: 'summary_large_image',
            title: ECONOMY_KR_FULL_TITLE,
            description: ECONOMY_KR_DESCRIPTION,
            images: ['/og-image.png'],
        },
    };
}

/** cold-gen(ISR 정적 생성 컨텍스트)에서 dynamic API(`cookies`/`headers`/`connection()`) 금지. */
async function KrEconomyContent() {
    const now = requestNow();
    const todayEt = etDateOf(now);
    // 그리드 기본 선택일 = 현재 인스턴트의 KST 달력일. 그리드가 이벤트를 ET-인스턴트의
    // kstDateKey로 그룹화하므로 앵커도 같은 KST keyspace여야 한다.
    const todayKstKey = kstDateOf(now);

    // 지표와 캘린더는 서로 독립이라 병렬로 기다린다. 라벨 조회는 캘린더 결과를
    // 소비하므로 그 뒤에 이어진다 — `Promise.all`로 올리면 깨진다.
    //
    // 로더마다 `.catch`를 단다. 지금은 둘 다 내부에서 오류를 삼키지만, 그 계약이
    // 여기 적혀 있지 않으면 나중에 로더가 하나 더 붙을 때 `Promise.all`이 통째로
    // reject한다 — 그러면 `economy/error.tsx`(클라 컴포넌트)가 뜨는데 거기서는
    // noindex를 낼 수 없어 200짜리 에러 페이지가 색인 후보가 된다. 미국 라우트가
    // 이미 로더마다 catch를 다는 이유가 그것이다.
    const [cards, calendarEvents] = await Promise.all([
        getKrIndicatorCards(todayEt).catch((e: unknown) => {
            console.error('[KrEconomyContent] getKrIndicatorCards failed:', e);
            return [];
        }),
        getCalendarFromDb(todayEt, CALENDAR_COUNTRY_KR).catch((e: unknown) => {
            console.error('[KrEconomyContent] getCalendarFromDb failed:', e);
            return [];
        }),
    ]);

    // dict → DB 캐시 → 영어 fallback 체인. 미매핑은 클라 훅이 AI 트리거(미국과 동일).
    const indicatorLabels = await resolveIndicatorLabels(calendarEvents).catch(
        (e: unknown) => {
            console.error(
                '[KrEconomyContent] resolveIndicatorLabels failed:',
                e
            );
            // empty object is always a valid Record<string, string>
            return {} as Record<string, string>;
        }
    );

    /*
     * **캘린더는 비어 있어도 항상 렌더한다.**
     *
     * KR 인제스션을 트리거하는 `useEconomicCalendarTrigger`가 `EconomicCalendarGrid`
     * 안에 있다. 데이터가 없을 때 캘린더를 통째로 빼면 트리거가 마운트되지 않아
     * 수집이 영영 돌지 않고, 그 빈 결과가 24시간 ISR에 굳는다 — 배포 직후
     * `economic_calendar`에 KR 행이 하나도 없는 상태가 정확히 그 조건이라
     * 기능이 죽은 채로 나간다(실측 확인). 그리드는 자체 빈 상태를 갖고 있다.
     */
    /*
     * 구조화데이터를 **여기서** 낸다.
     *
     * 지표도 캘린더도 없는 상태에서는 `generateMetadata`가 canonical을 비우고
     * noindex를 건다. 그때 Dataset/WebPage를 그대로 내보내면 "색인하지 말라"면서
     * "이 URL은 지표 N종을 6개월치 담은 데이터셋"이라고 주장하는 모순이 된다.
     * `/news/[category]`가 같은 상태에서 JSON-LD를 빼는 규칙을 이미 쓴다.
     *
     * 페이지 최상단이 아니라 이 컴포넌트에 두는 이유: 여기가 데이터를 가진 유일한
     * 지점이다. 위로 올리면 정적 셸이 로더를 기다리게 된다.
     */
    const degraded = cards.length === 0 && calendarEvents.length === 0;

    return (
        <div className="space-y-6">
            {!degraded && (
                <>
                    <JsonLd data={WEB_PAGE_JSON_LD} />
                    <JsonLd data={BREADCRUMB_JSON_LD} />
                    <JsonLd data={DATASET_JSON_LD} />
                </>
            )}
            {cards.length === 0 ? (
                <KrEconomyDegraded />
            ) : (
                <KrEconomicIndicatorGrid cards={cards} />
            )}
            <EconomicCalendar
                events={calendarEvents}
                today={todayKstKey}
                labels={indicatorLabels}
                country={CALENDAR_COUNTRY_KR}
            />
        </div>
    );
}

/**
 * 지표 카드가 아직 하나도 없을 때. 인제스션이 막 시작돼 과거 `actual`이 덜 쌓인
 * 콜드 스타트가 대표 사례라, "실패"가 아니라 "준비 중"으로 말한다.
 * 캘린더는 이 아래에 그대로 렌더된다(수집 트리거가 거기 있다).
 */
function KrEconomyDegraded() {
    const t = useTranslations('app.economy');
    return (
        <section
            aria-label={t('page.03f79d')}
            className="rounded-xl border border-secondary-700 bg-secondary-800 p-6"
        >
            <p className="text-sm text-secondary-400">{t('page.99ee99')}</p>
        </section>
    );
}

/**
 * Dataset 구조화 데이터 — 검색 엔진이 페이지의 데이터셋 성격을 인식하도록 한다.
 * `temporalCoverage`를 미국판(P1Y)보다 짧게 잡은 것은 사실 반영이다: FMP 캘린더
 * 조회 상한이 과거 ~180일이라 초기 이력이 그만큼이다.
 */
const DATASET_JSON_LD = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: 'Korean Macroeconomic Indicators — Policy Rate, CPI, Unemployment, etc.',
    description: ECONOMY_KR_DESCRIPTION,
    variableMeasured: `한국 거시 경제 지표 (기준금리·소비자물가·GDP·실업률 등 ${KR_ECONOMY_INDICATORS.length}종)`,
    temporalCoverage: 'P6M',
    creator: { '@type': 'Organization', name: SITE_NAME },
    license: `${SITE_URL}${TERMS_PATH}`,
    url: ECONOMY_KR_URL,
};

/**
 * FAQ 원문 — JSON-LD와 화면 `<dl>`의 **단일 소스**.
 *
 * 구글은 FAQPage 구조화데이터에 대응하는 내용이 페이지에 실제로 보일 것을 요구한다.
 * 두 벌로 두면 한쪽만 고쳐져 리치 결과 자격을 잃는다 — `/fear-greed` 계열이 이미
 * 이 패턴을 쓴다(`fear-greed/copy.ts`).
 */
const ECONOMY_KR_FAQ = [
    {
        question: '한국 기준금리는 누가 정하나요?',
        answer: '한국은행 금융통화위원회가 연 8회 회의를 열어 기준금리를 결정합니다. 이 페이지의 "한국 기준금리" 카드가 가장 최근 결정치를 보여줍니다.',
    },
    {
        question: '국고채 낙찰금리는 무엇인가요?',
        answer: '정부가 국고채를 발행할 때 입찰로 정해지는 금리입니다. 3년물은 단기, 10년물은 장기 시장금리의 기준으로 읽히며, 둘의 차이가 커질수록 경기 확장 기대가 크다는 뜻으로 해석되기도 합니다.',
    },
    {
        question: '이 데이터는 어디서 가져오나요?',
        answer: 'FMP(Financial Modeling Prep) 경제 캘린더의 한국 발표 이력을 기준으로 수집합니다. 지표 카드는 각 지표의 최근 발표값이며, 발표가 있을 때마다 갱신됩니다.',
    },
] as const;

const FAQ_JSON_LD = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: ECONOMY_KR_FAQ.map(({ question, answer }) => ({
        '@type': 'Question',
        name: question,
        acceptedAnswer: { '@type': 'Answer', text: answer },
    })),
};

const WEB_PAGE_JSON_LD = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${ECONOMY_KR_URL}#webpage`,
    name: ECONOMY_KR_FULL_TITLE,
    description: ECONOMY_KR_DESCRIPTION,
    url: ECONOMY_KR_URL,
    inLanguage: 'ko',
    isPartOf: { '@type': 'WebSite', '@id': `${SITE_URL}#website` },
};

const BREADCRUMB_JSON_LD = buildBreadcrumbJsonLd([
    { name: '한국 경제', url: ECONOMY_KR_URL },
]);

export default async function EconomyKrPage({
    params,
}: {
    readonly params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    // 정적 렌더 활성화. 이 호출이 없으면 next-intl의 서버 API가 `headers()`로
    // 폴백해 **이 라우트의 ISR이 통째로 꺼진다**(빌드 route 표에서 `●` → `ƒ`).
    // 실측으로 확인했다 — Next 16.2는 `next/root-params` 미지원이라 이 경로가 유일하다.
    setRequestLocale(locale);
    const t = await getTranslations('app.economy');
    return (
        <>
            {/* FAQ는 로더 결과와 무관하게 화면에 그대로 있으므로 항상 낸다.
                나머지 구조화데이터는 데이터가 있을 때만 — `KrEconomyContent` 참조. */}
            <JsonLd data={FAQ_JSON_LD} />
            <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
                <RegionTabs
                    vertical="economy"
                    active="kr"
                    currentPath="/economy/kr"
                />
                <h1 className="text-2xl font-bold tracking-tight text-balance text-secondary-100 sm:text-3xl">
                    {KR_ECONOMY_TITLE}
                </h1>
                {/*
                    한국 레지스트리를 넘긴다 — 기본값(미국)은 국채 카드 3장을 포함한
                    12장짜리라, 국채 카드가 없고 고용이 1장뿐인 이 화면에서는 자리를
                    과하게 예약해 콘텐츠 도착 시 위로 당겨진다.
                */}
                <Suspense fallback={<EconomySkeleton variant="kr" />}>
                    <KrEconomyContent />
                </Suspense>
                <section aria-labelledby="economy-kr-faq-heading">
                    <h2
                        id="economy-kr-faq-heading"
                        className="text-base font-semibold text-secondary-300"
                    >
                        {t('page.ae2ce9')}
                    </h2>
                    <dl className="mt-3 space-y-4 text-sm leading-relaxed text-secondary-400">
                        {ECONOMY_KR_FAQ.map(({ question, answer }) => (
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

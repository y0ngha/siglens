import type { Metadata } from 'next';
import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server';
import { DEFAULT_LOCALE, isLocale, type Locale } from '@/shared/i18n/locales';
import {
    localeAlternatesFrom,
    localeCanonical,
    localeOpenGraph,
    localeRobots,
} from '@/shared/lib/seoAlternates';
import { Suspense } from 'react';

import {
    EconomicCalendar,
    EconomicIndicatorGrid,
    EconomyMacroFacts,
    EconomySkeleton,
    MacroBriefing,
    TREASURY_CARD_META,
} from '@/widgets/economy';
// entities/economy/api/*는 server-only(`@upstash/redis` + `next/cache`) 의존이라
// entities/CLAUDE.md "barrel 제외 대상" 일반 규칙대로 슬라이스 barrel(index.ts)에서
// 의도적으로 제외돼 있다. app 레이어가 server-only 모듈을 직접 import하는 것은
// 클라이언트 번들 누출 위험이 없으므로 허용된다.
import { getEconomySnapshotStatic } from '@/entities/economy/api/economySnapshotStaticCache';
import { peekMacroBriefingStatic } from '@/entities/economy/api/macroBriefingStaticCache';
import { getCalendarFromDb } from '@/entities/economy/api/getCalendarFromDb';
import { resolveIndicatorLabels } from '@/entities/economy/api/resolveIndicatorLabels';
import { etDateOf, kstDateOf } from '@/entities/economy/lib/calendarWindow';
import { CALENDAR_COUNTRY } from '@/entities/economy/lib/economyCalendarConstants';
import { isEmptyEconomySnapshot } from '@/entities/economy';
import {
    buildBreadcrumbJsonLd,
    buildFaqJsonLd,
    buildWebPageJsonLd,
    clampSeoDescription,
    localizedAbsoluteUrl,
    ROOT_KEYWORDS,
    SITE_NAME,
    SITE_URL,
    type FaqItem,
    type SeoTranslator,
} from '@/shared/lib/seo';
import { TERMS_PATH } from '@/shared/lib/legal';
import { SECONDS_PER_HOUR } from '@/shared/config/time';
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from '@/shared/lib/og';
import { JsonLd } from '@/shared/ui/JsonLd';
import { FaqSection } from '@/shared/ui/FaqSection';
import { RegionTabs } from '@/shared/ui/RegionTabs';

import { ECONOMY_INDICATORS } from '@/shared/config/economyIndicators';

import { economyTitle } from './constants';
import { EconomyDegraded } from './EconomyDegraded';

/** 페이지 최상단 h1 — Suspense 위에 렌더되어 ready와 degraded 양 경로에서 항상 표시된다. */
function EconomyHeroH1({ title }: { title: string }) {
    return (
        <h1 className="text-2xl font-bold tracking-tight text-balance text-secondary-50 sm:text-3xl">
            {title}
        </h1>
    );
}

// 24h — ISR. 거시 지표는 월·분기 단위로 변하고 신선도는 클라 refetch가 책임진다.
// `FmpEconomyProvider`의 `ECONOMY_REVALIDATE_SECONDS`(= `SECONDS_PER_DAY` = 86400)와
// 동일 값으로 양 계층 TTL 일치시킨다. 출처 상수를 import하면 Next의 정적 분석이
// 깨져 config가 무시되므로(MISTAKES §16.5 단일 출처 + src/app/CLAUDE.md ISR 규약)
// 리터럴 강제하고, 변경 시 두 곳을 함께 갱신한다.
export const revalidate = 86400;

/**
 * FAQ 텍스트에서 사용하는 갱신 주기(시간). `revalidate`에서 파생해
 * revalidate 값이 바뀌면 FAQ 문구도 자동으로 동기화된다.
 */
const REVALIDATE_HOURS = revalidate / SECONDS_PER_HOUR;

/**
 * 1-hour bucket tag used as `unstable_cache` key granularity — must align with
 * the bucket core's `peekMacroBriefingCache` computes internally so the two
 * caches stay in lockstep.
 *
 * `'YYYY-MM-DDTHH'` (length 13) → `new Date().toISOString().slice(0, 13)` gives
 * the current UTC hour string (e.g. `'2026-06-17T14'`).
 */
const ISO_DATE_HOUR_SLICE_END = 13;

function economyDescription(t: SeoTranslator): string {
    return clampSeoDescription(t('economy.us.description'));
}
const ECONOMY_URL = `${SITE_URL}/economy`;
const ECONOMY_KEYWORDS = [
    ...ROOT_KEYWORDS,
    '미국 경제 지표',
    '미국 기준금리',
    'FOMC 일정',
    'CPI 발표',
    '미국 실업률',
    '경제 캘린더',
    '장단기 금리차',
    '미국 경기침체',
    '2s10s 스프레드',
    '10년물 국채 금리',
];

interface LocaleMetadataParams {
    readonly params: Promise<{ locale: string }>;
}

export async function generateMetadata({
    params,
}: LocaleMetadataParams): Promise<Metadata> {
    const { locale } = await params;
    const resolvedLocale = isLocale(locale) ? locale : DEFAULT_LOCALE;
    const tSeo = await getTranslations({
        locale: resolvedLocale,
        namespace: 'shared.seo',
    });
    const title = economyTitle(tSeo);
    const description = economyDescription(tSeo);
    const fullTitle = `${title} | ${SITE_NAME}`;
    const ogLocale = localeOpenGraph(resolvedLocale);
    // og:url도 로케일별이어야 한다 — 소셜 언퍼널이 ko URL로 되돌린다.
    const localizedUrl = localeCanonical(resolvedLocale, '/economy');
    // metadata와 본문이 동일한 isEmpty 판정을 봐서 degrade와 noindex가 일치한다.
    // 외부 I/O 오류(Redis 등)는 graceful 처리 — null이면 degraded 경로로 폴백.
    const snapshot = await getEconomySnapshotStatic().catch(e => {
        console.error('[economy.generateMetadata] snapshot failed:', e);
        return null;
    });
    const degraded = snapshot === null || isEmptyEconomySnapshot(snapshot);
    return {
        title,
        description,
        keywords: ECONOMY_KEYWORDS,
        // degraded 시 canonical을 null로 비워 크롤러가 임시 상태를 색인하지 않도록 한다.
        // follow: true는 유지해 링크 주스가 내부 링크로 계속 흐르게 한다.
        alternates: await localeAlternatesFrom(params, '/economy', {
            // canonical은 넘기지 않는다 — `localeAlternatesFrom`이 로케일별
            // 자기참조 URL을 만든다. ko 절대 URL을 넘기면 `/en/…`이 ko를
            // canonical로 가리켜 hreflang 상호참조가 깨진다.
            canonical: degraded ? null : undefined,
        }),
        robots: degraded
            ? { index: false, follow: true }
            : localeRobots(resolvedLocale),
        openGraph: {
            title: fullTitle,
            description,
            url: localizedUrl,
            siteName: SITE_NAME,
            ...ogLocale,
            type: 'website',
            images: [
                {
                    url: '/og-image.png',
                    width: OG_IMAGE_WIDTH,
                    height: OG_IMAGE_HEIGHT,
                    alt: fullTitle,
                },
            ],
        },
        twitter: {
            card: 'summary_large_image',
            title: fullTitle,
            description,
            images: ['/og-image.png'],
        },
    };
}

/** cold-gen(ISR 정적 생성 컨텍스트)에서 dynamic API(`cookies`/`headers`/`connection()`) 금지. */
async function EconomyContent() {
    // setRequestLocale은 이 컴포넌트를 감싸는 EconomyPage에서 이미 호출됐으므로
    // 로케일을 다시 넘기지 않아도 요청 스코프에서 찾는다(login/page.tsx 본문과 동일 패턴).
    const tSeo = await getTranslations('shared.seo');
    const requestLocale = await getLocale();
    const locale = isLocale(requestLocale) ? requestLocale : DEFAULT_LOCALE;
    // 외부 I/O 오류(Redis 등)는 graceful 처리 — 빈 캐시 동결을 막기 위해 throw 대신
    // null로 폴백해 EconomyDegraded를 반환한다. generateMetadata와 동일한 catch 패턴.
    const snapshot = await getEconomySnapshotStatic().catch(e => {
        console.error('[EconomyContent] snapshot failed:', e);
        return null;
    });
    if (snapshot === null || isEmptyEconomySnapshot(snapshot))
        return <EconomyDegraded />;

    /*
     * 구조화데이터를 **여기서** 낸다(FAQ는 예외 — 셸에 남는다).
     *
     * 위 degrade 분기를 지난 시점에만 도달하므로, `generateMetadata`가 noindex를
     * 건 렌더에서는 이 블록이 아예 실행되지 않는다. 셸에서 무조건 내보내면
     * "색인하지 말라"면서 "이 URL은 1년치 거시 지표 데이터셋"이라고 주장하는
     * 모순이 된다. `/economy/kr`과 `/news/[category]`가 같은 규칙을 쓴다.
     */

    // 1-hour date-hour 버킷 키로 macro briefing peek seed 조회. miss는 null → 클라가 submit.
    const dateHour = new Date().toISOString().slice(0, ISO_DATE_HOUR_SLICE_END);
    // 외부 I/O 오류는 graceful 처리하되 silent하게 삼키지 않는다(MISTAKES §Infra §4).
    const peekSeed = await peekMacroBriefingStatic(snapshot, dateHour).catch(
        e => {
            console.error(
                '[EconomyContent] peekMacroBriefingStatic failed:',
                e
            );
            return null;
        }
    );

    // 캘린더는 Redis 스냅샷이 아니라 DB-backed 이력 레이어에서 읽는다(SP-A). 지표/treasury는
    // 스냅샷 그대로. ET-오늘을 1회 계산해 reader 앵커 + 그리드 기본 선택일로 공유한다
    // (ISR 안전: 결정론적 Intl 변환, dynamic API 미사용).
    const now = new Date();
    const todayEt = etDateOf(now);
    // 그리드 기본 선택일 = 현재 인스턴트의 KST 달력일. 그리드가 이벤트를 ET-인스턴트의
    // kstDateKey로 그룹화하므로(EconomicCalendarGrid groupEventsByKstDay) 앵커도 같은 KST
    // keyspace여야 한다. 정오-ET 합성은 KST 다음날로 밀려 오늘 그룹을 건너뛰므로 금지.
    const todayKstKey = kstDateOf(now);
    const calendarEvents = await getCalendarFromDb(
        todayEt,
        CALENDAR_COUNTRY,
        locale
    ).catch((e: unknown) => {
        console.error('[EconomyContent] getCalendarFromDb failed:', e);
        return [];
    });

    // `analyzedAt`은 `EconomicCalendarGrid`(클라이언트)에서 역참조되지 않는다. 타입에서
    // 빼는 것만으로는 런타임 값이 그대로 flight에 실리므로 여기서 실제로 떼어낸다.
    const calendarEventsForClient = calendarEvents.map(
        ({ analyzedAt: _analyzedAt, ...rest }) => rest
    );

    // dict → DB 캐시 → 영어 fallback 체인. 미매핑은 클라 훅이 AI 트리거(SP-B 설계).
    const indicatorLabels = await resolveIndicatorLabels(
        calendarEvents,
        locale
    ).catch((e: unknown) => {
        console.error('[EconomyContent] resolveIndicatorLabels failed:', e);
        // empty object is always a valid Record<string, string>
        return {} as Record<string, string>;
    });

    return (
        <div className="space-y-6">
            <JsonLd data={buildEconomyWebPageJsonLd(tSeo, locale)} />
            <JsonLd data={buildEconomyBreadcrumbJsonLd(tSeo, locale)} />
            <JsonLd data={buildEconomyDatasetJsonLd(tSeo, locale)} />
            {/* SSR 크롤 텍스트 — MacroBriefing은 'use client'라 크롤러에 빈 HTML을
                반환한다. EconomyMacroFacts가 서버사이드에서 핵심 수치를 텍스트로
                노출해 검색 엔진이 수치 데이터를 색인할 수 있도록 한다. */}
            <EconomyMacroFacts snapshot={snapshot} />
            <MacroBriefing peekSeed={peekSeed} />
            <EconomicIndicatorGrid snapshot={snapshot} />
            <EconomicCalendar
                events={calendarEventsForClient}
                today={todayKstKey}
                labels={indicatorLabels}
                country={CALENDAR_COUNTRY}
            />
        </div>
    );
}

/**
 * Dataset 구조화 데이터 — 검색 엔진이 페이지의 데이터셋 성격을 인식할 수 있도록 한다.
 * Schema.org/Dataset 타입으로 레지스트리 지표 N종 + 국채금리 2종을 명시.
 *
 * `as const`를 제거한 이유: 문자열이 런타임에 `ECONOMY_INDICATORS.length`로 파생되므로
 * 객체 리터럴 내 `as const`로는 좁혀지지 않는다. JsonLd 사용 측이 타입을 요구하지
 * 않으므로 plain const로 충분하다.
 */
/** ISO 8601 기간 — 데이터셋의 시간적 범위(1년 lookback). */
const DATASET_TEMPORAL_COVERAGE = 'P1Y'; // ISO 8601 — 1년 lookback
// TREASURY_CARD_META의 키 수에서 파생 — EconomicIndicatorGrid와 동기.
const TREASURY_MATURITY_COUNT = Object.keys(TREASURY_CARD_META).length;
/**
 * `license`는 GSC "license 누락" 경고를 없애려고 넣은 필드다. 렌더 위치는
 * degrade 게이팅 때문에 `EconomyContent` 안으로 옮겨졌지만, 계약 자체는
 * 페이로드에 있으므로 테스트가 함수를 직접 호출해 확인한다 — 그래서 export한다.
 * `description`만 로케일에 따라 바뀌고 나머지 필드는 고정이다.
 */
export function buildEconomyDatasetJsonLd(t: SeoTranslator, locale: Locale) {
    return {
        '@context': 'https://schema.org',
        '@type': 'Dataset',
        name: 'US Macroeconomic Indicators — Federal Funds, CPI, Unemployment, etc.',
        description: economyDescription(t),
        variableMeasured: t('economy.us.datasetVariableMeasured', {
            v0: ECONOMY_INDICATORS.length,
            v1: TREASURY_MATURITY_COUNT,
        }),
        temporalCoverage: DATASET_TEMPORAL_COVERAGE,
        creator: { '@type': 'Organization', name: SITE_NAME },
        license: `${SITE_URL}${TERMS_PATH}`,
        // 로케일별 URL — 네 언어가 같은 주소를 선언하면 한 문서로 접힌다.
        url: localizedAbsoluteUrl(ECONOMY_URL, locale),
    };
}

/**
 * FAQ 원문 — JSON-LD와 화면 `<FaqSection>`의 단일 소스. 4건.
 *
 * 구글은 FAQPage 구조화데이터에 대응하는 내용이 페이지에 실제로 보일 것을 요구한다.
 * 예전에는 이 배열이 JSON-LD 리터럴로만 있고 화면에는 대응하는 텍스트가 없었다 —
 * `/economy/kr`(`ECONOMY_KR_FAQ`)이 이미 쓰는 단일 소스 패턴을 그대로 따른다. 9개
 * 종목 탭이 쓰는 `<FaqSection>` 컴포넌트를 재사용한다 — `/economy/kr`처럼 `<dl>`을
 * 손으로 새로 짜지 않아도 같은 계약(단일 배열 → JSON-LD + 화면)을 만족한다.
 */
function buildEconomyFaq(t: SeoTranslator): readonly FaqItem[] {
    // 모듈 상수가 아니라 빌더인 이유: 질문·답변이 한국어 리터럴이면
    // `/en/economy`가 영어 페이지에 한국어 FAQ 리치 스니펫을 실어 보낸다.
    // 구글은 구조화데이터가 페이지 언어와 맞기를 요구한다.
    return [0, 1, 2, 3].map(i => ({
        question: t(`economy.us.faq${i}q`),
        // 마지막 항목만 갱신 주기를 값으로 받는다. 나머지는 추가 값을 무시한다.
        answer: t(`economy.us.faq${i}a`, { v0: REVALIDATE_HOURS }),
    }));
}

function buildEconomyWebPageJsonLd(t: SeoTranslator, locale: Locale) {
    const fullTitle = `${economyTitle(t)} | ${SITE_NAME}`;
    return {
        // dateModified 제거: SITE_BUILD_DATE는 모듈 로드 시점에 고정되어
        // 24h ISR 갱신 주기를 반영하지 못한다. /financials 등 peer 페이지와 동일하게 제외.
        ...buildWebPageJsonLd({
            url: ECONOMY_URL,
            name: fullTitle,
            description: economyDescription(t),
            locale,
        }),
    };
}

/**
 * 모듈 스코프 상수였다. 그 자리에서는 로케일을 알 수 없어 breadcrumb URL이
 * 항상 기본 로케일을 가리키고 이름도 한국어로 굳었다 — 렌더 시점으로 옮긴다.
 */
function buildEconomyBreadcrumbJsonLd(
    t: SeoTranslator,
    locale: Locale
): Record<string, unknown> {
    return buildBreadcrumbJsonLd(
        [{ name: economyTitle(t), url: ECONOMY_URL }],
        locale
    );
}

export default async function EconomyPage({
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
    const tSeo = await getTranslations('shared.seo');
    // JSON-LD와 화면 `<FaqSection>`의 단일 소스 — 두 번 만들지 않는다.
    const faq = buildEconomyFaq(tSeo);
    return (
        <>
            {/* FAQ 질문·답변은 아래에 항상 렌더되므로 로더 결과와 무관하게
                구조화데이터도 항상 낸다. 나머지는 데이터가 있을 때만 —
                `EconomyContent` 참조. */}
            <JsonLd data={buildFaqJsonLd(faq)} />
            <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
                <RegionTabs
                    vertical="economy"
                    active="us"
                    currentPath="/economy"
                />
                <EconomyHeroH1 title={economyTitle(tSeo)} />
                <Suspense fallback={<EconomySkeleton />}>
                    <EconomyContent />
                </Suspense>
                <FaqSection heading={t('page.ae2ce9')} items={faq} />
            </main>
        </>
    );
}

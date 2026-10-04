import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { type Locale, resolveLocale } from '@/shared/i18n/locales';
import { buildHubMetadata } from '@/shared/lib/seoAlternates';
import { Suspense } from 'react';

import { EconomicCalendarGrid as EconomicCalendar } from '@/widgets/economy/sections/EconomicCalendarGrid';
import { EconomicIndicatorGrid } from '@/widgets/economy/sections/EconomicIndicatorGrid';
import { EconomyMacroFacts } from '@/widgets/economy/sections/EconomyMacroFacts';
import { EconomySkeleton } from '@/widgets/economy/sections/EconomySkeleton';
import { MacroBriefing } from '@/widgets/economy/sections/MacroBriefing';
// entities/economy/api/*는 server-only(`@upstash/redis` + `next/cache`) 의존이다.
// app 레이어(RSC)에서만 import하므로 클라이언트 번들 누출 위험이 없다.
import { getEconomySnapshotStatic } from '@/entities/economy/api/economySnapshotStaticCache';
import { peekMacroBriefingStatic } from '@/entities/economy/api/macroBriefingStaticCache';
import { getCalendarFromDb } from '@/entities/economy/api/getCalendarFromDb';
import { resolveIndicatorLabels } from '@/entities/economy/api/resolveIndicatorLabels';
import { etDateOf } from '@/entities/economy/lib/calendarWindow';
import { kstDateKey } from '@/shared/lib/etTimeUtils';
import { CALENDAR_COUNTRY } from '@/entities/economy/lib/economyCalendarConstants';
import { isEmptyEconomySnapshot } from '@/entities/economy/lib/economyCompleteness';
import {
    buildBreadcrumbJsonLd,
    buildFaqJsonLd,
    buildWebPageJsonLd,
    clampSeoDescription,
    SITE_NAME,
    SITE_URL,
    type FaqItem,
    type SeoTranslator,
} from '@/shared/lib/seo';
import {
    ISO_DATE_HOUR_SLICE_END,
    SECONDS_PER_HOUR,
} from '@/shared/config/time';
import { JsonLd } from '@/shared/ui/JsonLd';
import { Breadcrumb } from '@/shared/ui/Breadcrumb';
import { FaqSection } from '@/shared/ui/FaqSection';
import { RegionTabs } from '@/shared/ui/RegionTabs';

import { economyTitle } from './constants';
import { EconomyDegraded } from './EconomyDegraded';
import { enterLocale } from '@/shared/lib/enterLocale';
import {
    shortenRevalidateIfDatabaseMissingAtBuild,
    shortenRevalidateIfFmpFailedAtBuild,
} from '@/shared/cache/buildDegradedRevalidate';

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

function economyDescription(t: SeoTranslator): string {
    return clampSeoDescription(t('economy.us.description'));
}
const ECONOMY_URL = `${SITE_URL}/economy`;
// 루트 레이아웃이 `ROOT_KEYWORDS`를 선언한다 — 여기엔 페이지 고유 목록만 둔다.
const ECONOMY_KEYWORDS = [
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
    const { locale: rawLocale } = await params;
    const locale = resolveLocale(rawLocale);
    const tSeo = await getTranslations({
        locale,
        namespace: 'shared.seo',
    });
    const title = economyTitle(tSeo);
    const description = economyDescription(tSeo);
    // metadata와 본문이 동일한 isEmpty 판정을 봐서 degrade와 noindex가 일치한다.
    // 외부 I/O 오류(Redis 등)는 graceful 처리 — null이면 degraded 경로로 폴백.
    const snapshot = await getEconomySnapshotStatic().catch(e => {
        console.error('[economy.generateMetadata] snapshot failed:', e);
        return null;
    });
    const degraded = snapshot === null || isEmptyEconomySnapshot(snapshot);
    // degraded 시 canonical을 null로 비워 크롤러가 임시 상태를 색인하지 않도록 한다.
    // follow: true는 유지해 링크 주스가 내부 링크로 계속 흐르게 한다.
    return buildHubMetadata({
        params,
        locale,
        path: '/economy',
        title,
        description,
        keywords: ECONOMY_KEYWORDS,
        degraded,
    });
}

/** cold-gen(ISR 정적 생성 컨텍스트)에서 dynamic API(`cookies`/`headers`/`connection()`) 금지. */
async function EconomyContent() {
    // setRequestLocale은 이 컴포넌트를 감싸는 EconomyPage에서 이미 호출됐으므로
    // 로케일을 다시 넘기지 않아도 요청 스코프에서 찾는다(login/page.tsx 본문과 동일 패턴).
    const tSeo = await getTranslations('shared.seo');
    const requestLocale = await getLocale();
    const locale = resolveLocale(requestLocale);
    // 캘린더는 스냅샷·브리핑과 무관한 DB 조회다. 예전에는 그 둘을 다 기다린 뒤에야
    // 시작해 콜드 렌더가 조회 세 개를 한 줄로 기다렸다. 여기서 먼저 출발시키고 아래에서
    // 받는다. ET-오늘은 1회 계산해 reader 앵커 + 그리드 기본 선택일로 공유한다
    // (ISR 안전: 결정론적 Intl 변환, dynamic API 미사용).
    //
    // 대가: 스냅샷이 degrade면(아래에서 일찍 반환) 이 조회의 결과를 쓰지 않고 버린다.
    // degrade 렌더는 드물고 버리는 것은 캐시된 읽기 한 번이라 감수한다. 두 promise 모두
    // `.catch`가 붙어 있어 미처리 rejection은 남지 않지만, DB 없는 배포 빌드가 FMP까지
    // degrade인 경우 예전에는 없던 `getCalendarFromDb failed` 로그가 한 줄 남을 수 있다.
    const now = new Date();
    const todayEt = etDateOf(now);
    const calendarEventsPromise = getCalendarFromDb(
        todayEt,
        CALENDAR_COUNTRY,
        locale
    ).catch((e: unknown) => {
        console.error('[EconomyContent] getCalendarFromDb failed:', e);
        return [];
    });
    // dict → DB 캐시 → 영어 fallback 체인. 미매핑은 클라 훅이 AI 트리거(SP-B 설계).
    // 캘린더에만 의존하므로 캘린더가 오는 즉시 이어 붙인다.
    const indicatorLabelsPromise = calendarEventsPromise.then(events =>
        resolveIndicatorLabels(events, locale).catch((e: unknown) => {
            console.error('[EconomyContent] resolveIndicatorLabels failed:', e);
            // empty object is always a valid Record<string, string>
            return {} as Record<string, string>;
        })
    );

    // 외부 I/O 오류(Redis 등)는 graceful 처리 — 빈 캐시 동결을 막기 위해 throw 대신
    // null로 폴백해 EconomyDegraded를 반환한다. generateMetadata와 동일한 catch 패턴.
    const snapshot = await getEconomySnapshotStatic().catch(e => {
        console.error('[EconomyContent] snapshot failed:', e);
        return null;
    });
    // 빌드 중 FMP가 실패했으면 이 prerender를 60초 뒤 재생성되게 한다(헬퍼 JSDoc).
    await shortenRevalidateIfFmpFailedAtBuild();
    // 배포 빌드에는 DB가 없어 캘린더가 비어 구워진다 — 같은 방식으로 60초 뒤 재생성한다.
    await shortenRevalidateIfDatabaseMissingAtBuild();
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
    // 스냅샷 그대로. 조회는 위에서 이미 출발했다.
    // 그리드 기본 선택일 = 현재 인스턴트의 KST 달력일. 그리드가 이벤트를 ET-인스턴트의
    // kstDateKey로 그룹화하므로(EconomicCalendarGrid groupEventsByKstDay) 앵커도 같은 KST
    // keyspace여야 한다. 정오-ET 합성은 KST 다음날로 밀려 오늘 그룹을 건너뛰므로 금지.
    const todayKstKey = kstDateKey(now);
    const calendarEvents = await calendarEventsPromise;

    // `analyzedAt`은 `EconomicCalendarGrid`(클라이언트)에서 역참조되지 않는다. 타입에서
    // 빼는 것만으로는 런타임 값이 그대로 flight에 실리므로 여기서 실제로 떼어낸다.
    const calendarEventsForClient = calendarEvents.map(
        ({ analyzedAt: _analyzedAt, ...rest }) => rest
    );

    const indicatorLabels = await indicatorLabelsPromise;

    return (
        <div className="space-y-6">
            <JsonLd data={buildEconomyWebPageJsonLd(tSeo, locale)} />
            <JsonLd data={buildEconomyBreadcrumbJsonLd(tSeo, locale)} />
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
    enterLocale(locale);
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
                {/* 가시 브레드크럼 — 텍스트가 BreadcrumbList JSON-LD의 `name`과
                    같아야 구글이 마크업을 무시하지 않는다. */}
                <Breadcrumb trail={[{ label: economyTitle(tSeo) }]} />
                <EconomyHeroH1 title={economyTitle(tSeo)} />
                <Suspense fallback={<EconomySkeleton />}>
                    <EconomyContent />
                </Suspense>
                <FaqSection heading={t('page.ae2ce9')} items={faq} />
            </main>
        </>
    );
}

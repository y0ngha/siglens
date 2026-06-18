import type { Metadata } from 'next';
import { Suspense } from 'react';

import {
    EconomicCalendar,
    EconomicIndicatorGrid,
    EconomyMacroFacts,
    MacroBriefing,
} from '@/widgets/economy';
// entities/economy/api/*는 server-only(`@upstash/redis` + `next/cache`) 의존이라
// entities/CLAUDE.md "barrel 제외 대상" 일반 규칙대로 슬라이스 barrel(index.ts)에서
// 의도적으로 제외돼 있다. app 레이어가 server-only 모듈을 직접 import하는 것은
// 클라이언트 번들 누출 위험이 없으므로 허용된다.
import { getEconomySnapshotStatic } from '@/entities/economy/api/economySnapshotStaticCache';
import { peekMacroBriefingStatic } from '@/entities/economy/api/macroBriefingStaticCache';
import { isEmptyEconomySnapshot } from '@/entities/economy';
import {
    buildBreadcrumbJsonLd,
    clampSeoDescription,
    ROOT_KEYWORDS,
    SITE_BUILD_DATE,
    SITE_NAME,
    SITE_URL,
} from '@/shared/lib/seo';
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from '@/shared/lib/og';
import { JsonLd } from '@/shared/ui/JsonLd';

import { ECONOMY_TITLE } from './constants';
import { EconomyDegraded } from './EconomyDegraded';

/** 페이지 최상단 h1 — EconomyContent와 Suspense fallback에서 공유한다. */
function EconomyHeroH1() {
    return (
        <h1 className="text-secondary-100 px-6 pt-10 text-2xl font-bold tracking-tight text-balance sm:text-3xl lg:px-[15vw]">
            {ECONOMY_TITLE}
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
const REVALIDATE_HOURS = revalidate / 3600;

/**
 * 1-hour bucket tag used as `unstable_cache` key granularity — must align with
 * the bucket core's `peekMacroBriefingCache` computes internally so the two
 * caches stay in lockstep.
 *
 * `'YYYY-MM-DDTHH'` (length 13) → `new Date().toISOString().slice(0, 13)` gives
 * the current UTC hour string (e.g. `'2026-06-17T14'`).
 */
const ISO_DATE_HOUR_SLICE_END = 13;

// Root layout template appends "| Siglens" — 본문 title은 brand 제외.
const ECONOMY_FULL_TITLE = `${ECONOMY_TITLE} | ${SITE_NAME}`;
const ECONOMY_DESCRIPTION = clampSeoDescription(
    '미국 기준금리·물가·고용·성장 지표와 다가오는 경제 발표 일정을 한 페이지에서 봅니다. AI가 현재 거시 국면을 요약해 드려요.'
);
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

export async function generateMetadata(): Promise<Metadata> {
    // metadata와 본문이 동일한 isEmpty 판정을 봐서 degrade와 noindex가 일치한다.
    // 외부 I/O 오류(Redis 등)는 graceful 처리 — null이면 degraded 경로로 폴백.
    const snapshot = await getEconomySnapshotStatic().catch(e => {
        console.error('[economy.generateMetadata] snapshot failed:', e);
        return null;
    });
    const degraded = snapshot === null || isEmptyEconomySnapshot(snapshot);
    return {
        title: ECONOMY_TITLE,
        description: ECONOMY_DESCRIPTION,
        keywords: ECONOMY_KEYWORDS,
        // degraded 시 canonical을 null로 비워 크롤러가 임시 상태를 색인하지 않도록 한다.
        // follow: true는 유지해 링크 주스가 내부 링크로 계속 흐르게 한다.
        alternates: { canonical: degraded ? null : ECONOMY_URL },
        robots: degraded ? { index: false, follow: true } : undefined,
        openGraph: {
            title: ECONOMY_FULL_TITLE,
            description: ECONOMY_DESCRIPTION,
            url: ECONOMY_URL,
            siteName: SITE_NAME,
            locale: 'ko_KR',
            type: 'website',
            images: [
                {
                    url: '/og-image.png',
                    width: OG_IMAGE_WIDTH,
                    height: OG_IMAGE_HEIGHT,
                    alt: ECONOMY_FULL_TITLE,
                },
            ],
        },
        twitter: {
            card: 'summary_large_image',
            title: ECONOMY_FULL_TITLE,
            description: ECONOMY_DESCRIPTION,
            images: ['/og-image.png'],
        },
    };
}

/** cold-gen(ISR 정적 생성 컨텍스트)에서 dynamic API(`cookies`/`headers`/`connection()`) 금지. */
async function EconomyContent() {
    const snapshot = await getEconomySnapshotStatic();
    if (isEmptyEconomySnapshot(snapshot)) return <EconomyDegraded />;

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

    return (
        <div className="space-y-8 px-6 py-8 lg:px-[15vw]">
            {/* SSR 크롤 텍스트 — MacroBriefing은 'use client'라 크롤러에 빈 HTML을
                반환한다. EconomyMacroFacts가 서버사이드에서 핵심 수치를 텍스트로
                노출해 검색 엔진이 수치 데이터를 색인할 수 있도록 한다. */}
            <EconomyMacroFacts snapshot={snapshot} />
            <MacroBriefing peekSeed={peekSeed} />
            <EconomicIndicatorGrid snapshot={snapshot} />
            <EconomicCalendar events={snapshot.calendar} />
        </div>
    );
}

/**
 * Dataset 구조화 데이터 — 검색 엔진이 페이지의 데이터셋 성격을 인식할 수 있도록 한다.
 * Schema.org/Dataset 타입으로 주요 거시 지표 9종 + 국채금리 2종을 명시.
 */
const DATASET_JSON_LD = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: 'US Macroeconomic Indicators — Federal Funds, CPI, Unemployment, etc.',
    description: ECONOMY_DESCRIPTION,
    variableMeasured:
        '미국 거시 경제 지표 (기준금리·CPI·GDP·실업률 등 9종 + 국채금리 2종)',
    temporalCoverage: 'P1Y',
    creator: { '@type': 'Organization', name: SITE_NAME },
    url: ECONOMY_URL,
} as const;

/**
 * FAQPage 구조화 데이터 — 자주 묻는 질문 4건. 검색 결과에 FAQ 리치 스니펫으로
 * 노출되어 클릭률을 높이고 핵심 개념(2s10s·FOMC·CPI·데이터 출처)을 직접 전달한다.
 */
const FAQ_JSON_LD = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
        {
            '@type': 'Question',
            name: '2s10s 스프레드란 무엇인가요?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: '2년물과 10년물 미국 국채 수익률의 차이입니다. 10년물에서 2년물을 뺀 값으로, 음수가 되면 장단기 금리가 역전된 것으로 경기침체 신호로 해석되기도 합니다.',
            },
        },
        {
            '@type': 'Question',
            name: 'FOMC 발표는 어디서 확인하나요?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: '이 페이지 하단의 경제 캘린더에서 FOMC 회의 및 연방기금금리 결정 일정을 확인할 수 있습니다.',
            },
        },
        {
            '@type': 'Question',
            name: 'CPI는 얼마나 자주 발표되나요?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'CPI(소비자물가지수)는 월 1회, 매월 중순에 미국 노동통계국(BLS)이 발표합니다.',
            },
        },
        {
            '@type': 'Question',
            name: '이 데이터는 어디서 가져오나요?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: `FMP(Financial Modeling Prep) API를 기준으로 수집하며, ${REVALIDATE_HOURS}시간마다 최신 데이터로 갱신됩니다.`,
            },
        },
    ],
} as const;

export default function EconomyPage() {
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        '@id': `${ECONOMY_URL}#webpage`,
        name: ECONOMY_FULL_TITLE,
        description: ECONOMY_DESCRIPTION,
        url: ECONOMY_URL,
        inLanguage: 'ko',
        isPartOf: { '@type': 'WebSite', '@id': `${SITE_URL}#website` },
        dateModified: SITE_BUILD_DATE.toISOString(),
    };

    const breadcrumbJsonLd = buildBreadcrumbJsonLd([
        { name: '미국 경제', url: ECONOMY_URL },
    ]);

    return (
        <>
            <JsonLd data={jsonLd} />
            <JsonLd data={breadcrumbJsonLd} />
            <JsonLd data={DATASET_JSON_LD} />
            <JsonLd data={FAQ_JSON_LD} />
            <main className="flex-1">
                <EconomyHeroH1 />
                <Suspense fallback={null}>
                    <EconomyContent />
                </Suspense>
            </main>
        </>
    );
}

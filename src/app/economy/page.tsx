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
 * 'YYYY-MM-DDTHH' prefix length — ISR renders를 1-hour date-hour 버킷으로 묶는다.
 * `peekMacroBriefingStatic`이 이 키로 cache를 read한다.
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
    const snapshot = await getEconomySnapshotStatic();
    const degraded = isEmptyEconomySnapshot(snapshot);
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
            <main className="flex-1">
                <EconomyHeroH1 />
                <Suspense fallback={null}>
                    <EconomyContent />
                </Suspense>
            </main>
        </>
    );
}

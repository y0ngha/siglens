import type { Metadata } from 'next';
import type { ReactElement } from 'react';
import { Suspense } from 'react';

import {
    EconomicCalendar,
    EconomicIndicatorGrid,
    MacroBriefing,
} from '@/widgets/economy';
import { getEconomySnapshotStatic } from '@/entities/economy/api/economySnapshotStaticCache';
import { peekMacroBriefingStatic } from '@/entities/economy/api/macroBriefingStaticCache';
import { isEmptyEconomySnapshot } from '@/entities/economy/lib/economyCompleteness';
import {
    buildBreadcrumbJsonLd,
    clampSeoDescription,
    ROOT_KEYWORDS,
    SITE_NAME,
    SITE_URL,
} from '@/shared/lib/seo';
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from '@/shared/lib/og';
import { JsonLd } from '@/shared/ui/JsonLd';

import { ECONOMY_TITLE } from './constants';
import { EconomyDegraded } from './EconomyDegraded';

// 24h — ISR. 거시 지표는 월·분기 단위로 변하고 신선도는 클라 refetch가 책임진다.
// literal required — importing a constant breaks Next's static analysis, see src/app/CLAUDE.md
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
];

export async function generateMetadata(): Promise<Metadata> {
    // metadata와 본문이 동일한 isEmpty 판정을 봐서 degrade와 noindex가 일치한다.
    const snapshot = await getEconomySnapshotStatic();
    const degraded = isEmptyEconomySnapshot(snapshot);
    return {
        title: ECONOMY_TITLE,
        description: ECONOMY_DESCRIPTION,
        keywords: ECONOMY_KEYWORDS,
        alternates: { canonical: ECONOMY_URL },
        robots: degraded ? { index: false } : undefined,
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

/** RSC content — 데이터 조회 + 위젯 composition. cold-gen에서 dynamic API 금지. */
async function EconomyContent(): Promise<ReactElement> {
    const snapshot = await getEconomySnapshotStatic();
    if (isEmptyEconomySnapshot(snapshot)) return <EconomyDegraded />;

    // 1-hour date-hour 버킷 키로 macro briefing peek seed 조회. miss는 null → 클라가 submit.
    const dateHour = new Date().toISOString().slice(0, ISO_DATE_HOUR_SLICE_END);
    const peekSeed = await peekMacroBriefingStatic(snapshot, dateHour).catch(
        () => null
    );

    return (
        <main className="flex-1">
            <h1 className="text-secondary-100 px-6 pt-10 text-2xl font-bold tracking-tight text-balance sm:text-3xl lg:px-[15vw]">
                {ECONOMY_TITLE}
            </h1>
            <div className="space-y-8 px-6 py-8 lg:px-[15vw]">
                <MacroBriefing peekSeed={peekSeed} />
                <EconomicIndicatorGrid snapshot={snapshot} />
                <EconomicCalendar events={snapshot.calendar} />
            </div>
        </main>
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
    };

    const breadcrumbJsonLd = buildBreadcrumbJsonLd([
        { name: '미국 경제', url: ECONOMY_URL },
    ]);

    return (
        <>
            <JsonLd data={jsonLd} />
            <JsonLd data={breadcrumbJsonLd} />
            <Suspense
                fallback={
                    <main className="flex-1">
                        <h1 className="text-secondary-100 px-6 pt-10 text-2xl font-bold tracking-tight text-balance sm:text-3xl lg:px-[15vw]">
                            {ECONOMY_TITLE}
                        </h1>
                    </main>
                }
            >
                <EconomyContent />
            </Suspense>
        </>
    );
}

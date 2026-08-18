import type { Metadata } from 'next';
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
    '한국 기준금리·물가·고용·성장 지표와 다가오는 국내 경제 발표 일정을 한 페이지에서 봅니다.'
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

export async function generateMetadata(): Promise<Metadata> {
    // 본문과 동일한 조회로 degrade를 판정한다 — metadata의 noindex와 실제 렌더가
    // 어긋나지 않도록(미국 라우트와 동일 원칙). `getKrIndicatorCards`는 React.cache라
    // 본문에서 다시 호출해도 DB 왕복은 한 번이다.
    const cards = await getKrIndicatorCards(etDateOf(new Date())).catch(
        (e: unknown) => {
            console.error('[economy.kr.generateMetadata] failed:', e);
            return [] as KrIndicatorCard[];
        }
    );
    const degraded = cards.length === 0;

    return {
        title: KR_ECONOMY_TITLE,
        description: ECONOMY_KR_DESCRIPTION,
        keywords: ECONOMY_KR_KEYWORDS,
        // degraded 시 canonical을 비우고 noindex — 지표가 하나도 없는 임시 상태를
        // 색인시키지 않는다. follow는 유지해 내부 링크로 주스가 계속 흐르게 한다.
        alternates: { canonical: degraded ? null : ECONOMY_KR_URL },
        robots: degraded ? { index: false, follow: true } : undefined,
        openGraph: {
            title: ECONOMY_KR_FULL_TITLE,
            description: ECONOMY_KR_DESCRIPTION,
            url: ECONOMY_KR_URL,
            siteName: SITE_NAME,
            locale: 'ko_KR',
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
    // ET-오늘을 1회 계산해 지표 이력 앵커와 캘린더 창이 같은 기준을 쓰게 한다.
    const now = new Date();
    const todayEt = etDateOf(now);
    // 그리드 기본 선택일 = 현재 인스턴트의 KST 달력일. 그리드가 이벤트를 ET-인스턴트의
    // kstDateKey로 그룹화하므로 앵커도 같은 KST keyspace여야 한다.
    const todayKstKey = kstDateOf(now);

    // 세 조회는 서로 독립이라 병렬로 기다린다. 전부 graceful degrade — 하나가 실패해도
    // 나머지 섹션은 그대로 렌더된다(ISR 빈 캐시 동결 방지).
    const [cards, calendarEvents] = await Promise.all([
        getKrIndicatorCards(todayEt),
        getCalendarFromDb(todayEt, CALENDAR_COUNTRY_KR),
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

    if (cards.length === 0 && calendarEvents.length === 0) {
        return <KrEconomyDegraded />;
    }

    return (
        <div className="space-y-6">
            <KrEconomicIndicatorGrid cards={cards} />
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
 * 지표·캘린더가 모두 비었을 때. 인제스션이 아직 한 번도 돌지 않은 콜드 스타트가
 * 대표 사례라, "실패"가 아니라 "준비 중"으로 말한다.
 */
function KrEconomyDegraded() {
    return (
        <section
            aria-label="한국 경제 데이터 없음"
            className="rounded-xl border border-secondary-700 bg-secondary-800 p-6"
        >
            <p className="text-sm text-secondary-400">
                한국 경제 지표를 준비하고 있어요. 잠시 후 다시 확인해 주세요.
            </p>
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

const FAQ_JSON_LD = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
        {
            '@type': 'Question',
            name: '한국 기준금리는 누가 정하나요?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: '한국은행 금융통화위원회가 연 8회 회의를 열어 기준금리를 결정합니다. 이 페이지의 "한국 기준금리" 카드가 가장 최근 결정치를 보여줍니다.',
            },
        },
        {
            '@type': 'Question',
            name: '국고채 낙찰금리는 무엇인가요?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: '정부가 국고채를 발행할 때 입찰로 정해지는 금리입니다. 3년물은 단기, 10년물은 장기 시장금리의 기준으로 읽히며, 둘의 차이가 커질수록 경기 확장 기대가 크다는 뜻으로 해석되기도 합니다.',
            },
        },
        {
            '@type': 'Question',
            name: '이 데이터는 어디서 가져오나요?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'FMP(Financial Modeling Prep) 경제 캘린더의 한국 발표 이력을 기준으로 수집합니다. 지표 카드는 각 지표의 최근 발표값이며, 발표가 있을 때마다 갱신됩니다.',
            },
        },
    ],
} as const;

export default function EconomyKrPage() {
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        '@id': `${ECONOMY_KR_URL}#webpage`,
        name: ECONOMY_KR_FULL_TITLE,
        description: ECONOMY_KR_DESCRIPTION,
        url: ECONOMY_KR_URL,
        inLanguage: 'ko',
        isPartOf: { '@type': 'WebSite', '@id': `${SITE_URL}#website` },
    };

    const breadcrumbJsonLd = buildBreadcrumbJsonLd([
        { name: '한국 경제', url: ECONOMY_KR_URL },
    ]);

    return (
        <>
            <JsonLd data={jsonLd} />
            <JsonLd data={breadcrumbJsonLd} />
            <JsonLd data={DATASET_JSON_LD} />
            <JsonLd data={FAQ_JSON_LD} />
            <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
                <RegionTabs vertical="economy" active="kr" />
                <h1 className="text-2xl font-bold tracking-tight text-balance text-secondary-100 sm:text-3xl">
                    {KR_ECONOMY_TITLE}
                </h1>
                <Suspense fallback={<EconomySkeleton />}>
                    <KrEconomyContent />
                </Suspense>
            </main>
        </>
    );
}

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
// entities/economy/api/*는 server-only(`@upstash/redis` + `next/cache`) 의존이다.
// app 레이어(RSC)에서만 import하므로 클라이언트 번들 누출 위험이 없다.
import { getEconomySnapshotStatic } from '@/entities/economy/api/economySnapshotStaticCache';
import { rssAlternateTypes } from '@/shared/config/rssFeed';
import { SECONDS_PER_HOUR } from '@/shared/config/time';
import { resolveLocale } from '@/shared/i18n/locales';
import { enterLocale } from '@/shared/lib/enterLocale';
import { buildFaqJsonLd } from '@/shared/lib/seo';
import { buildHubMetadata } from '@/shared/lib/seoAlternates';
import { Breadcrumb } from '@/shared/ui/Breadcrumb';
import { FaqSection } from '@/shared/ui/FaqSection';
import { JsonLd } from '@/shared/ui/JsonLd';
import { RegionTabs } from '@/shared/ui/RegionTabs';
import { EconomyContent } from './_components/EconomyContent';
import { hasEconomyData } from './_lib/economyDegraded';
import { buildEconomyFaq } from './_lib/economyJsonLd';
import { economyDescription, economyTitle } from './constants';

// 24h — ISR. 거시 지표는 월·분기 단위로 변하고 신선도는 클라 refetch가 책임진다.
// 이 페이지 ISR과 스냅샷 정적 캐시(`getEconomySnapshotStatic`의 `SECONDS_PER_DAY`
// = 86400) 두 값을 맞춘다. 출처 상수를 import하면 Next의 정적 분석이
// 깨져 config가 무시되므로(CONVENTIONS.md#CS-3 단일 출처 + src/app/CLAUDE.md#AP-1 ISR 규약)
// 리터럴 강제하고, 변경 시 두 곳을 함께 갱신한다.
export const revalidate = 86400;

/** FAQ가 말하는 갱신 주기(시간) — `revalidate`에서 파생해 값이 바뀌면 문구도 따라간다. */
const REVALIDATE_HOURS = revalidate / SECONDS_PER_HOUR;

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

interface EconomyRouteProps {
    readonly params: Promise<{ locale: string }>;
}

/**
 * 본문(`EconomyContent`)과 같은 isEmpty 판정을 봐서 degrade와 noindex가 일치한다.
 * 스냅샷 로더 오류(Redis 등)는 로그를 남기고 degraded로 폴백한다 — `buildHubMetadata`가
 * noindex + self-canonical(hreflang 없음)을 내고 `follow`는 유지한다.
 */
export async function generateMetadata({
    params,
}: EconomyRouteProps): Promise<Metadata> {
    const locale = resolveLocale((await params).locale);
    const tSeo = await getTranslations({ locale, namespace: 'shared.seo' });
    const snapshot = await getEconomySnapshotStatic().catch(e => {
        console.error('[economy.generateMetadata] snapshot failed:', e);
        return null;
    });
    return buildHubMetadata({
        params,
        locale,
        path: '/economy',
        title: economyTitle(tSeo),
        description: economyDescription(tSeo),
        keywords: ECONOMY_KEYWORDS,
        degraded: !hasEconomyData(snapshot),
        alternateTypes: rssAlternateTypes(locale),
    });
}

/**
 * 미국 거시 허브 셸 — 지역 탭·브레드크럼·h1·FAQ는 로더 결과와 무관하게 항상 그리고,
 * 서버 데이터 섹션(`EconomyContent`)은 Suspense 없이 그 사이에 둔다(숨김 청크 방지).
 */
export default async function EconomyPage({ params }: EconomyRouteProps) {
    enterLocale((await params).locale);
    const [t, tSeo] = await Promise.all([
        getTranslations('app.economy'),
        getTranslations('shared.seo'),
    ]);
    const title = economyTitle(tSeo);
    // JSON-LD와 화면 `<FaqSection>`의 단일 소스 — 두 번 만들지 않는다.
    const faq = buildEconomyFaq(tSeo, REVALIDATE_HOURS);
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
                <Breadcrumb trail={[{ label: title }]} />
                <h1 className="text-2xl font-bold tracking-tight text-balance text-secondary-50 sm:text-3xl">
                    {title}
                </h1>
                {/* 서버 데이터(`EconomyContent`)는 Suspense로 감싸지 않는다 — fallback→본문
                    교체가 사라져 CLS도 줄고, raw HTML에 숨김 청크가 남지 않는다. */}
                <EconomyContent />
                <FaqSection heading={t('page.ae2ce9')} items={faq} />
            </main>
        </>
    );
}

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
// entities/economy/api/*는 server-only(`@upstash/redis` + `next/cache`) 의존이다.
// app 레이어(RSC)에서만 import하므로 클라이언트 번들 누출 위험이 없다.
import { getCalendarFromDb } from '@/entities/economy/api/getCalendarFromDb';
import { getKrIndicatorCards } from '@/entities/economy/api/getKrIndicatorCards';
import { etDateOf } from '@/entities/economy/lib/calendarWindow';
import type { KrIndicatorCard } from '@/entities/economy/lib/krIndicatorCards';
import { CALENDAR_COUNTRY_KR } from '@/entities/economy/lib/economyCalendarConstants';
import { resolveLocale } from '@/shared/i18n/locales';
import { enterLocale } from '@/shared/lib/enterLocale';
import { buildFaqJsonLd } from '@/shared/lib/seo';
import { buildHubMetadata } from '@/shared/lib/seoAlternates';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { Breadcrumb } from '@/shared/ui/Breadcrumb';
import { JsonLd } from '@/shared/ui/JsonLd';
import { RegionTabs } from '@/shared/ui/RegionTabs';
import { isKrEconomyDegraded } from '../_lib/economyDegraded';
import { buildEconomyKrFaq } from '../_lib/economyJsonLd';
import { requestNow } from '../_lib/requestNow';
import { economyKrDescription, economyKrTitle } from '../constants';
import { KrEconomyContent } from './_components/KrEconomyContent';

// 24h — ISR. 거시 지표는 월·분기 단위로 변하고, 신선도는 캘린더 인제스션의
// `revalidateTag('economy:calendar')`가 책임진다. 시간 기반은 상한만 정한다.
// 리터럴 강제 — 상수를 import하면 Next의 정적 분석이 깨진다(src/app/CLAUDE.md#AP-1).
export const revalidate = 86400;

// 루트 레이아웃이 `ROOT_KEYWORDS`를 선언한다 — 여기엔 페이지 고유 목록만 둔다.
const ECONOMY_KR_KEYWORDS = [
    '한국 경제 지표',
    '한국은행 기준금리',
    '국내 소비자물가',
    '한국 실업률',
    '한국 GDP 성장률',
    '국고채 금리',
    '국내 경제 캘린더',
    '수출 증가율',
];

interface EconomyKrRouteProps {
    readonly params: Promise<{ locale: string }>;
}

/**
 * degrade 판정은 **본문(`KrEconomyContent`)과 완전히 같은 식**이다 — 지표도 캘린더도 없을 때만.
 *
 * 지표만 비고 캘린더는 찬 상태가 첫 크롤의 가장 흔한 모습이다(캘린더는 인제스션 직후 다가오는
 * 일정이 바로 들어오지만, 지표 카드는 과거 `actual`이 쌓여야 나온다). 지표 개수만 보면 꽉 찬
 * 페이지에 noindex가 붙는다. 두 로더 모두 `React.cache`로 감싸여 본문의 재호출은 왕복이 없다.
 */
export async function generateMetadata({
    params,
}: EconomyKrRouteProps): Promise<Metadata> {
    const locale = resolveLocale((await params).locale);
    const tSeo = await getTranslations({ locale, namespace: 'shared.seo' });
    const todayEt = etDateOf(requestNow());
    const [cards, calendarEvents] = await Promise.all([
        getKrIndicatorCards(todayEt).catch((e: unknown): KrIndicatorCard[] => {
            console.error(
                '[economy.kr.generateMetadata] indicators failed:',
                e
            );
            return [];
        }),
        getCalendarFromDb(todayEt, CALENDAR_COUNTRY_KR, locale).catch(
            (e: unknown) => {
                console.error(
                    '[economy.kr.generateMetadata] calendar failed:',
                    e
                );
                return [];
            }
        ),
    ]);
    // degraded면 noindex + self-canonical(hreflang 없음), `follow`는 유지한다(`buildHubMetadata`).
    return buildHubMetadata({
        params,
        locale,
        path: '/economy/kr',
        title: economyKrTitle(tSeo),
        description: economyKrDescription(tSeo),
        keywords: ECONOMY_KR_KEYWORDS,
        degraded: isKrEconomyDegraded({ cards, calendarEvents }),
    });
}

/**
 * 한국 거시 허브 셸 — 지역 탭·브레드크럼·h1·FAQ는 로더 결과와 무관하게 항상 그리고,
 * 서버 데이터 섹션(`KrEconomyContent`)은 Suspense 없이 그 사이에 둔다(숨김 청크 방지).
 */
export default async function EconomyKrPage({ params }: EconomyKrRouteProps) {
    enterLocale((await params).locale);
    const [t, tSeo] = await Promise.all([
        getTranslations('app.economy'),
        getTranslations('shared.seo'),
    ]);
    const title = economyKrTitle(tSeo);
    // FAQPage 구조화데이터와 화면 `<dl>`의 단일 소스 — 두 벌이면 한쪽만 고쳐져 리치 결과 자격을 잃는다.
    const faq = buildEconomyKrFaq(tSeo);
    return (
        <>
            {/* FAQ는 로더 결과와 무관하게 화면에 그대로 있으므로 항상 낸다.
                나머지 구조화데이터는 데이터가 있을 때만 — `KrEconomyContent` 참조. */}
            <JsonLd data={buildFaqJsonLd(faq)} />
            <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
                <RegionTabs
                    vertical="economy"
                    active="kr"
                    currentPath="/economy/kr"
                />
                {/* 가시 브레드크럼 — 텍스트가 BreadcrumbList JSON-LD의 `name`과
                    같아야 구글이 마크업을 무시하지 않는다. */}
                <Breadcrumb trail={[{ label: title }]} />
                <h1 className="text-2xl font-bold tracking-tight text-balance text-secondary-50 sm:text-3xl">
                    {title}
                </h1>
                {/* 서버 데이터(`KrEconomyContent`)는 Suspense로 감싸지 않는다 — fallback→본문
                    교체가 사라져 CLS도 줄고, raw HTML에 숨김 청크가 남지 않는다. */}
                <KrEconomyContent />
                <section aria-labelledby="economy-kr-faq-heading">
                    <h2 id="economy-kr-faq-heading" className={HEADING_SECTION}>
                        {t('page.ae2ce9')}
                    </h2>
                    <dl className="mt-3 space-y-4 text-sm leading-relaxed text-secondary-400">
                        {faq.map(({ question, answer }) => (
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

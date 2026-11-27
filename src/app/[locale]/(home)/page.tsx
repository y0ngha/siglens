import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PopularTickers } from '@/widgets/home/PopularTickers';
import { HERO_QUICK_LINKS } from '@/widgets/home/utils/heroQuickLinks';
import { toSkillShowcaseItems } from '@/widgets/home/utils/toSkillShowcaseItems';
import { isMailAlertLaunched } from '@/entities/mail-alert/lib/mailAlertConstants';
import { MailAlertCard } from '@/features/mail-alert/ui/MailAlertCard';
import { HomeWatchlistCard } from '@/features/watchlist/ui/HomeWatchlistCard';
import { resolveMeterDailySymbols } from '@/widgets/analysis/utils/meterDailySymbols';
import { loadGuideCategoryCopy } from '@/views/guide/lib/guideCopy';
import { RSS_ALTERNATE_TYPES } from '@/shared/config/rssFeed';
import { DEFAULT_LOCALE, resolveLocale } from '@/shared/i18n/locales';
import { brandName } from '@/shared/lib/brandName';
import { enterLocale } from '@/shared/lib/enterLocale';
import {
    brandIntroName,
    buildFaqJsonLd,
    localizedAbsoluteUrl,
    SITE_URL,
} from '@/shared/lib/seo';
import {
    localeAlternatesFrom,
    localeOpenGraph,
} from '@/shared/lib/seoAlternates';
import { buildTwitterMetadata } from '@/shared/lib/twitterMetadata';
import { FaqSection } from '@/shared/ui/FaqSection';
import { JsonLd } from '@/shared/ui/JsonLd';
import { buildHomeFaq } from './_lib/homeJsonLd';
import { HomeHero } from './_components/HomeHero';
import { HomeMethodBand } from './_components/HomeMethodBand';
import { HomeRadarCta } from './_components/HomeRadarCta';
import { HomeSkillsDisclosure } from './_components/HomeSkillsDisclosure';
import { HomeTodayMarket } from './_components/HomeTodayMarket';
import { buildHomeJsonLdNodes } from './_lib/homeJsonLdNodes';
import { loadHomeTodayMarket } from './_lib/loadHomeTodayMarket';
import { toTodayMarketView } from './_lib/todayMarketView';
import { loadShowcase, loadSkillCounts } from './_lib/homeSkills';

interface HomeRouteProps {
    readonly params: Promise<{ locale: string }>;
}

/**
 * 홈 메타데이터. 루트 레이아웃은 canonical을 깔지 않으므로 홈이 self-canonical을 직접 선언한다.
 *
 * `openGraph`/`twitter`는 **완전히** 선언한다 — Next는 이 최상위 키를 부모와 병합하지 않고
 * 교체하므로, 부분 선언하면 `type`·`url`이 통째로 빠진다. 이미지는 선언하지 않고 같은 세그먼트의
 * `opengraph-image.tsx`·`twitter-image.tsx` 파일 컨벤션이 로케일별 카드를 채운다.
 */
export async function generateMetadata({
    params,
}: HomeRouteProps): Promise<Metadata> {
    const { locale: rawLocale } = await params;
    const locale = resolveLocale(rawLocale);
    const tSeo = await getTranslations({
        locale,
        namespace: 'shared.seo',
    });
    // 브랜드는 인자로 넘긴다 — 한글 표기를 카탈로그 문구에 직접 적으면 ko 문장만 길어져
    // 번역 검증의 길이 게이트가 다른 로케일을 잘린 번역으로 본다(`brandIntroName` 주석).
    const title = tSeo('root.title', { v0: brandIntroName(locale) });
    const description = tSeo('root.description');
    return {
        // `absolute`가 없으면 루트 레이아웃의 `title.template`(ko `%s | 시그렌즈`)이 붙는다 —
        // 홈 제목은 SERP 폭을 위해 접미사 없이 브랜드를 앞에 둔 문구 그대로 나간다.
        title: { absolute: title },
        description,
        // RSS 발견 링크는 색인 로케일(ko)에만 건다. 레이아웃에 두면 이 페이지가
        // `alternates`를 선언하면서 교체해 버려 홈 head에 나가지 않는다.
        alternates: await localeAlternatesFrom(params, '/', {
            types: locale === DEFAULT_LOCALE ? RSS_ALTERNATE_TYPES : undefined,
        }),
        openGraph: {
            type: 'website',
            siteName: brandName(locale),
            title,
            description,
            // 로케일마다 다른 문서다 — 전 로케일이 `og:url`로 ko 루트를 가리키면
            // 공유 카드가 어느 언어에서 눌러도 한국어 페이지로 간다.
            url: localizedAbsoluteUrl(SITE_URL, locale),
            ...localeOpenGraph(locale),
            // `images`는 선언하지 않는다 — 같은 세그먼트의 `opengraph-image.tsx`
            // 파일 컨벤션이 로케일별 공유 카드를 채운다(`twitter-image.tsx`도 같다).
        },
        twitter: buildTwitterMetadata({ title, description }),
    };
}

// 랜딩은 ISR 정적 페이지다 — `?q=` 딥링크는 proxy.ts가 redirect로 처리하므로 이 페이지는
// searchParams 등 dynamic 의존성이 없다. 소비하면 라우트가 dynamic으로 바뀌어 ISR이 꺼진다.
// 1h — "오늘의 시장"(공포탐욕·오늘의 신호)이 하루 안에 바뀐다. 데이터는 `/fear-greed`·`/market`과
// 같은 1h 캐시를 공유하므로 이보다 짧게 잡아도 내용은 더 자주 바뀌지 않는다. 스킬 수는 배포 시 갱신.
export const revalidate = 3600;

/**
 * 홈(`/`). 데이터(스킬 개수·기법 목록·오늘의 시장·번역)를 모으고 섹션을 배치한다.
 *
 * 섹션 순서는 "먼저 하는 일 → 카탈로그" 순이다. 검색(히어로) → 오늘의 시장(공포탐욕·신호 허브·
 * 메일 카드 자리) → 내 관심종목 → 가격대 산정 방식 띠(+닫힌 기법 목록) → 종목 레이더(ko) →
 * 인기 종목(시장 탭) → FAQ(접힘). 카탈로그성 섹션(기법 카드, 업종 카드, FAQ)은 접거나 탭으로 줄이되
 * **내부 링크와 본문은 서버 HTML에 그대로 둔다** — 접힘은 `<details>`와 `display:none`뿐이다.
 *
 * 기법 목록은 `<Suspense>`로 감싼 별도 async 컴포넌트가 아니라 본문에서 스킬 개수와 함께
 * 읽는다 — 서버 데이터 경계는 raw HTML에 스켈레톤과 숨김 청크를 남겨 JS 없는 크롤러에게 본문을
 * 뒤로 밀고 하이드레이션 때 레이아웃을 흔든다. 로드는 파일시스템 읽기라 짧고 ISR이라 문서 셸이
 * 기다려도 비용이 없다.
 *
 * 간격은 한 규칙이다: 히어로 아래 모든 블록은 `mt-8 sm:mt-10`(첫 섹션 안)이거나 `pt-8 sm:pt-10`(이후
 * 섹션)이다.
 */
export default async function Home({ params }: HomeRouteProps) {
    const { locale: rawLocale } = await params;
    const locale = enterLocale(rawLocale);
    // 서로 독립이라 병렬로 푼다. 내비 라벨 키는 완전 수식이라 루트 네임스페이스로 푼다.
    const [t, tNav, tSeo, tJsonLd, tMail] = await Promise.all([
        getTranslations('app.home'),
        getTranslations(),
        getTranslations('shared.seo'),
        getTranslations('app.home.jsonLd'),
        getTranslations('features.mail-alert'),
    ]);
    // 번역 묶음과 합치지 않는다 — 가드(`serverDataSuspenseBoundaries`)가 스킬 개수와 기법 목록을
    // 한 `Promise.all`에서 읽는 구조를 고정하고, 이미 각 묶음 안에서 병렬이다.
    // "오늘의 시장"·가이드 분류 라벨은 그 묶음 바깥에서 병렬로 함께 기다린다 — 안쪽 묶음 모양은 그대로다.
    // react-doctor-disable-next-line react-doctor/server-sequential-independent-await
    const [[skillCounts, showcaseSkills], todayMarket, guideCopy] =
        await Promise.all([
            Promise.all([loadSkillCounts(), loadShowcase()]),
            loadHomeTodayMarket(),
            loadGuideCategoryCopy(locale),
        ]);
    const showcaseItems = toSkillShowcaseItems(showcaseSkills);

    const todayMarketView = toTodayMarketView(todayMarket);
    // JSON-LD와 화면 `<FaqSection>`의 단일 소스 — 두 번 만들지 않는다.
    const homeFaq = buildHomeFaq(tJsonLd, locale);
    const jsonLd = buildHomeJsonLdNodes({
        locale,
        title: tSeo('root.title', { v0: brandIntroName(locale) }),
        description: tSeo('root.description'),
        headline: tSeo('root.headline'),
    });

    return (
        <>
            <JsonLd data={jsonLd.webApplication} />
            <JsonLd data={jsonLd.webPage} />
            <JsonLd data={jsonLd.organization} />
            <JsonLd data={buildFaqJsonLd(homeFaq)} />
            {/* 대상(`#search`)은 `HomeHero`의 검색 영역이다. */}
            <a
                href="#search"
                className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-4 focus-visible:left-4 focus-visible:z-50 focus-visible:rounded focus-visible:bg-primary-600 focus-visible:px-4 focus-visible:py-2 focus-visible:text-white"
            >
                {t('page.24e60c')}
            </a>
            <main className="flex flex-1 flex-col">
                <section className="page-container relative overflow-hidden pt-12 sm:pt-16">
                    <div
                        aria-hidden="true"
                        className="hero-report-lines pointer-events-none absolute inset-0"
                    />
                    <HomeHero
                        locale={locale}
                        copy={{
                            aiTeaser: t('page.aiTeaser'),
                            eyebrow: t('page.eyebrow'),
                            headline: t('page.headline'),
                            intro: t('page.intro', {
                                v0: skillCounts.indicators,
                            }),
                            introTail: t('page.introTail'),
                        }}
                        quickLinks={HERO_QUICK_LINKS.map(
                            ({ href, labelKey }) => ({
                                href,
                                label: tNav(labelKey),
                            })
                        )}
                    />
                    {/* 오늘의 시장 — 날마다 바뀌는 서버 렌더 블록. 검색 다음 두 번째 행동(오늘 무엇이
                        움직였나)을 히어로 바로 아래 둔다. 데이터가 하나도 없으면 아무것도 그리지 않는다. */}
                    {todayMarketView !== null && (
                        <div className="relative mt-8 sm:mt-10">
                            <HomeTodayMarket
                                locale={locale}
                                view={todayMarketView}
                            />
                        </div>
                    )}
                    {/* 메일 카드 — 공개 전에는 아무것도 그리지 않는다. 오늘의 시장 카드 안이 아니라 그
                        뒤의 형제 블록이다(카드 안의 카드 금지). 공포 탐욕 미국 허브를 구독 대상으로 삼고,
                        홈에는 시장을 말해 주는 문맥이 없어 문구에 시장 이름을 넣는다. */}
                    {isMailAlertLaunched() && (
                        <div className="relative mt-4">
                            <MailAlertCard
                                target={{
                                    kind: 'fear_greed',
                                    market: 'us',
                                    marketLabel: tMail('marketUs'),
                                }}
                                showMarketInLine
                            />
                        </div>
                    )}
                    {/* 내 관심종목 — 오늘의 시장 아래. 담기는 아래 인기 종목 알약의 ★가 맡고, 이 카드는
                        담은 종목·최근 본 종목의 시세를 보여 준다. 클라이언트 아일랜드라 서버 HTML에는
                        자리표시자만 있다 — 크롤러가 따라갈 종목 링크는 인기 종목 섹션이 서버 렌더로 낸다. */}
                    <div className="relative mt-8 sm:mt-10">
                        <HomeWatchlistCard />
                    </div>
                </section>
                <section className="page-container pt-8 sm:pt-10">
                    <HomeMethodBand
                        counts={skillCounts}
                        guestDailySymbols={resolveMeterDailySymbols()}
                        categoryLabels={guideCopy.label}
                    />
                    {/* 프로젝션이 **필수**다 — 왜인지는 `toSkillShowcaseItems`의 JSDoc에 있다. 목록이
                        비면(읽기 실패 폴백) 열어 볼 것이 없으니 줄 자체를 두지 않는다. */}
                    {showcaseItems.length > 0 && (
                        <div className="mt-4">
                            <HomeSkillsDisclosure
                                summaryLabel={t('page.skillsSummary', {
                                    count: showcaseItems.length,
                                })}
                                skills={showcaseItems}
                            />
                        </div>
                    )}
                </section>
                {/* 종목 레이더 — 목적지가 한국어 전용 대시보드라 기본 로케일에만 낸다. */}
                {locale === DEFAULT_LOCALE && (
                    <section className="page-container pt-8 sm:pt-10">
                        <HomeRadarCta
                            title={t('page.radarTitle')}
                            badge={t('page.radarBadge')}
                            body={t('page.radarBody')}
                            viewAllLabel={t('page.radarViewAll')}
                            requestPrompt={t('page.radarRequestPrompt')}
                            requestCta={t('page.radarRequestCta')}
                            chipAriaLabel={name =>
                                t('page.radarChipAria', { v0: name })
                            }
                        />
                    </section>
                )}
                <div className="pt-8 sm:pt-10">
                    <PopularTickers />
                </div>
                {/* FAQPage 구조화데이터의 가시 표면. `/economy`·`/fear-greed`가 쓰는 같은 컴포넌트이고,
                    같은 배열이 위 JSON-LD를 만든다. 접어 두되(첫 문항 q0만 펼침) 답변은 서버 HTML에 있다. */}
                <section className="page-container pt-8 pb-12 sm:pt-10">
                    <FaqSection
                        heading={tSeo('faqHeading.home')}
                        items={homeFaq}
                        linkifyPaths
                        collapsible
                        defaultOpenCount={1}
                    />
                </section>
            </main>
        </>
    );
}

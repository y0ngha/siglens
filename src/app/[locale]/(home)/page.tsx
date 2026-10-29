import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { CryptoShowcase } from '@/widgets/home/CryptoShowcase';
import { HERO_QUICK_LINKS } from '@/widgets/home/heroQuickLinks';
import { SkillsShowcase } from '@/widgets/home/SkillsShowcase';
import { StatsBar } from '@/widgets/home/StatsBar';
import { TickerCategories } from '@/widgets/home/TickerCategories';
import { toSkillShowcaseItems } from '@/widgets/home/toSkillShowcaseItems';
import { HomeWatchlistCard } from '@/features/watchlist/ui/HomeWatchlistCard';
import { RSS_ALTERNATE_TYPES } from '@/shared/config/rssFeed';
import { DEFAULT_LOCALE, resolveLocale } from '@/shared/i18n/locales';
import { brandName } from '@/shared/lib/brandName';
import { enterLocale } from '@/shared/lib/enterLocale';
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from '@/shared/lib/og';
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
import { HomeBacktestingCta } from './_components/HomeBacktestingCta';
import { HomeHero } from './_components/HomeHero';
import { buildHomeJsonLdNodes } from './_lib/homeJsonLdNodes';
import { loadShowcase, loadSkillCounts } from './_lib/homeSkills';

interface HomeRouteProps {
    readonly params: Promise<{ locale: string }>;
}

/**
 * 홈 메타데이터. 루트 레이아웃은 canonical을 깔지 않으므로 홈이 self-canonical을 직접 선언한다.
 *
 * `openGraph`/`twitter`는 **완전히** 선언한다 — Next는 이 최상위 키를 부모와 병합하지 않고
 * 교체하므로, 부분 선언하면 `images`·`type`·`url`이 통째로 빠져 공유 카드에 미리보기가 없다.
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
            images: [
                {
                    url: '/og-image.png',
                    width: OG_IMAGE_WIDTH,
                    height: OG_IMAGE_HEIGHT,
                    alt: title,
                },
            ],
        },
        twitter: buildTwitterMetadata({
            title,
            description,
            images: ['/og-image.png'],
        }),
    };
}

// 랜딩은 ISR 정적 페이지다 — `?q=` 딥링크는 proxy.ts가 redirect로 처리하므로 이 페이지는
// searchParams 등 dynamic 의존성이 없다. 소비하면 라우트가 dynamic으로 바뀌어 ISR이 꺼진다.
export const revalidate = 86400; // 24h — skills는 배포 시 갱신되므로 장중 신선도와 무관

/**
 * 홈(`/`). 데이터(스킬 개수·쇼케이스·번역)를 모으고 섹션을 배치한다.
 *
 * 쇼케이스 목록은 `<Suspense>`로 감싼 별도 async 컴포넌트가 아니라 본문에서 스킬 개수와 함께
 * 읽는다 — 서버 데이터 경계는 raw HTML에 스켈레톤과 숨김 청크를 남겨 JS 없는 크롤러에게 본문을
 * 뒤로 밀고 하이드레이션 때 레이아웃을 흔든다. 로드는 파일시스템 읽기라 짧고 ISR이라 문서 셸이
 * 기다려도 비용이 없다.
 */
export default async function Home({ params }: HomeRouteProps) {
    const { locale: rawLocale } = await params;
    const locale = enterLocale(rawLocale);
    // 넷은 서로 독립이라 병렬로 푼다. 내비 라벨 키는 완전 수식이라 루트 네임스페이스로 푼다.
    const [t, tNav, tSeo, tJsonLd] = await Promise.all([
        getTranslations('app.home'),
        getTranslations(),
        getTranslations('shared.seo'),
        getTranslations('app.home.jsonLd'),
    ]);
    // 번역 묶음과 합치지 않는다 — 가드(`serverDataSuspenseBoundaries`)가 스킬 개수와 쇼케이스를
    // 한 `Promise.all`에서 읽는 구조를 고정하고, 이미 각 묶음 안에서 병렬이다.
    // react-doctor-disable-next-line react-doctor/server-sequential-independent-await
    const [skillCounts, showcaseSkills] = await Promise.all([
        loadSkillCounts(),
        loadShowcase(),
    ]);

    // JSON-LD와 화면 `<FaqSection>`의 단일 소스 — 두 번 만들지 않는다.
    const homeFaq = buildHomeFaq(tJsonLd, locale);
    const jsonLd = buildHomeJsonLdNodes({
        locale,
        title: tSeo('root.title', { v0: brandIntroName(locale) }),
        description: tSeo('root.description'),
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
                <section className="page-container relative overflow-hidden py-12 sm:py-16">
                    <div
                        aria-hidden="true"
                        className="hero-report-lines pointer-events-none absolute inset-0"
                    />
                    <HomeHero
                        locale={locale}
                        copy={{
                            aiTeaser: t('page.aiTeaser'),
                            eyebrow: t('page.c26658'),
                            headline: t('page.2f20c8'),
                            intro: t('page.eafd49', {
                                v0: skillCounts.indicators,
                            }),
                            introTail: t('page.79bd8f'),
                        }}
                        quickLinks={HERO_QUICK_LINKS.map(
                            ({ href, labelKey }) => ({
                                href,
                                label: tNav(labelKey),
                            })
                        )}
                    />
                    {/* 내 관심종목 — 히어로(검색) 바로 아래, StatsBar 위. 담기는 아래 인기 종목
                        알약의 ★가 맡고, 이 카드는 담은 종목·최근 본 종목의 시세를 보여 준다.
                        클라이언트 아일랜드라 서버 HTML에는 자리표시자만 있다 — 크롤러가 따라갈
                        종목 링크는 인기 종목 섹션이 서버 렌더로 낸다. */}
                    <div className="relative mt-10">
                        <HomeWatchlistCard />
                    </div>
                    <div className="relative mt-10">
                        {/* 히어로 카피와 같은 `skillCounts`를 쓴다 — 종목 페이지의 진행 문구·가입
                            업셀과 같은 수를 말한다. */}
                        <StatsBar counts={skillCounts} />
                    </div>
                </section>
                <section className="page-container pb-8">
                    <HomeBacktestingCta
                        question={t('page.dfbacd')}
                        body={t('page.167f34')}
                        ctaLabel={t('page.ee41ec')}
                    />
                </section>
                {/* 프로젝션이 **필수**다 — 왜인지는 `toSkillShowcaseItems`의 JSDoc에 있다. */}
                <SkillsShowcase skills={toSkillShowcaseItems(showcaseSkills)} />
                <TickerCategories />
                <CryptoShowcase />
                {/* FAQPage 구조화데이터의 가시 표면. `/economy`·`/fear-greed`가
                    쓰는 같은 컴포넌트이고, 같은 배열이 위 JSON-LD를 만든다. */}
                <section className="page-container pb-12">
                    <FaqSection
                        heading={tSeo('faqHeading.home')}
                        items={homeFaq}
                        linkifyPaths
                    />
                </section>
            </main>
        </>
    );
}

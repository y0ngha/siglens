import { countSkillFiles, FileSkillsLoader } from '@/entities/skill';
import { SymbolSearchPanel } from '@/features/ticker-search';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/shared/lib/seo';
import { JsonLd } from '@/shared/ui/JsonLd';
import { HOME_FAQ_JSON_LD } from './homeJsonLd';
import {
    CryptoShowcase,
    HeroIllustration,
    HERO_QUICK_LINKS,
    SkillsShowcase,
    SkillsShowcaseSkeleton,
    StatsBar,
    StatsBarSkeleton,
    TickerCategories,
} from '@/widgets/home';
import Link from 'next/link';
import type { Metadata } from 'next';
import { cache, Suspense } from 'react';
import { toSkillShowcaseItems } from '@/widgets/home/toSkillShowcaseItems';

// 루트 레이아웃에서 canonical을 제거했으므로 홈 페이지 자체가 명시적으로 self-canonical을 선언한다.
// 다른 인덱서블 페이지들(economy, market, backtesting 등)은 이미 자체 canonical을 갖고 있다.
export const metadata: Metadata = {
    alternates: { canonical: SITE_URL },
};

// 랜딩은 ISR 정적 페이지로 운영 — proxy.ts가 ?q= 쿼리를 처리해 redirect하므로
// 이 페이지 자체는 dynamic 의존성이 없다. revalidate로 skills 파일 변경 반영.
export const revalidate = 86400; // 24h — skills는 배포 시 갱신되므로 장중 신선도와 무관

// skills 파일시스템 읽기 오류는 graceful 처리 — 빈 배열/0으로 폴백해 페이지 렌더를
// 계속한다. ISR 빈 캐시 동결 방지: throw하면 0-byte HTML이 캐시에 박힌다.
const loadSkills = cache(async () => {
    try {
        return await new FileSkillsLoader().loadSkills();
    } catch (e) {
        console.error('[Home] loadSkills failed:', e);
        return [];
    }
});

async function AsyncStatsBar() {
    const skills = await loadSkills();
    return <StatsBar skills={skills} />;
}

async function SkillsShowcaseServer() {
    const skills = await loadSkills();
    // 프로젝션이 **필수**다 — 왜인지는 `toSkillShowcaseItems`의 JSDoc에 있다.
    return <SkillsShowcase skills={toSkillShowcaseItems(skills)} />;
}

// WebSite SearchAction(urlTemplate=`?q={search_term_string}`)의 ?q= 처리는 proxy.ts가 담당한다.
// page.tsx에서 searchParams를 소비하면 라우트가 dynamic으로 바뀌어 ISR 캐싱이 불가능하기 때문이다.
export default async function Home() {
    // countSkillFiles 오류(fs 접근 실패 등)는 graceful 처리 — 0 폴백으로 페이지를 계속 렌더한다.
    // throw가 전파되면 ISR 빈 캐시(0-byte body)가 동결된다.
    const skillCounts = await countSkillFiles().catch(e => {
        console.error('[Home] countSkillFiles failed:', e);
        return {
            indicators: 0,
            candlesticks: 0,
            patterns: 0,
            strategies: 0,
            supportResistance: 0,
            fundamental: 0,
            news: 0,
        };
    });

    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        '@id': `${SITE_URL}#webapplication`,
        name: SITE_NAME,
        description: SITE_DESCRIPTION,
        url: SITE_URL,
        inLanguage: 'ko',
        applicationCategory: 'FinanceApplication',
        operatingSystem: 'Web',
        offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'KRW',
        },
    };

    // 홈 WebPage 노드 — SiteJsonLd의 WebSite와 jsonLd(WebApplication)를
    // entity graph로 연결한다. 다른 모든 페이지가 WebPage @id 패턴을 따르므로
    // 홈에도 동일 패턴을 둬야 cross-link가 일관된다.
    const webPageJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        '@id': `${SITE_URL}#webpage`,
        name: `${SITE_NAME} — ${SITE_DESCRIPTION}`,
        description: SITE_DESCRIPTION,
        url: SITE_URL,
        inLanguage: 'ko',
        isPartOf: { '@type': 'WebSite', '@id': `${SITE_URL}#website` },
        mainEntity: { '@id': `${SITE_URL}#webapplication` },
    };

    const organizationJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: SITE_NAME,
        url: SITE_URL,
        logo: `${SITE_URL}/icon512.png`,
        description: SITE_DESCRIPTION,
        sameAs: ['https://github.com/y0ngha/siglens'],
    };

    return (
        <>
            <JsonLd data={jsonLd} />
            <JsonLd data={webPageJsonLd} />
            <JsonLd data={organizationJsonLd} />
            <JsonLd data={HOME_FAQ_JSON_LD} />
            <a
                href="#search"
                className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-4 focus-visible:left-4 focus-visible:z-50 focus-visible:rounded focus-visible:bg-primary-600 focus-visible:px-4 focus-visible:py-2 focus-visible:text-white"
            >
                검색으로 건너뛰기
            </a>
            <main className="flex flex-1 flex-col">
                <section className="page-container relative overflow-hidden py-12 sm:py-16">
                    <div
                        aria-hidden="true"
                        className="hero-report-lines pointer-events-none absolute inset-0"
                    />
                    <div className="relative grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-10">
                        {/*
                            HeroIllustration이 mobile에서 H1보다 먼저 등장(order-first)
                            해야 above-the-fold에서 LCP 후보로 잡힌다. 인라인 SVG는
                            추가 fetch가 없어 HTML 파싱 즉시 페인트되므로 폰트 의존
                            텍스트 LCP보다 결정적으로 빠르다.
                            (lg+에서는 order 해제 — 텍스트가 좌측, 일러스트가 우측)
                        */}
                        <div className="order-first lg:order-last">
                            <HeroIllustration className="mx-auto h-auto w-full max-w-md lg:max-w-none" />
                        </div>
                        <div className="text-center lg:text-left">
                            <p className="mb-5 text-xs font-semibold tracking-[0.01em] text-secondary-400">
                                투자의 확신을 더하는 AI 분석
                            </p>
                            {/*
                                제목 크기는 뷰포트가 아니라 **자기 글상자 폭**을
                                따라야 한다. `lg`에서 히어로가 2단으로 갈리며 텍스트
                                컬럼이 975px에서 520px로 좁아지는데, `vw` 기준
                                clamp은 그걸 볼 수 없어 컬럼이 좁아지는 순간에도
                                글자는 계속 커진다 — 1024px 한 픽셀 경계에서 제목이
                                2줄에서 4줄로 뛰었다.

                                래퍼를 컨테이너로 삼고 `cqw`를 쓰면 한 규칙으로
                                전 구간이 해결된다. 글상자 폭 288~672px 전 범위에서
                                2줄을 유지하는 한계치를 1px 단위로 실측한 결과가
                                7.50~7.64cqw로 거의 일정해, 7.4cqw는 모든 폭에서
                                여유를 두고 2줄 안에 들어온다. 브레이크포인트 사다리가
                                필요 없어진 이유다.

                                하한 2.1rem은 모바일(글상자 288px)에서 7.4cqw가
                                21px까지 떨어지는 걸 막는다 — 이 구간은 폭 자체가
                                좁아 4줄로 흐르는 게 정상이다. 상한 3.25rem은 현재
                                도달하지 않는다(글상자 최대치가 `max-w-2xl` 672px라
                                실측 최대 폰트는 49.7px). 안전장치로만 남겨 둔 값이니,
                                글상자를 더 넓히기 전에는 이 팔이 동작하지 않는다.

                                수동 `<br>`과 em 대시도 걷어냈다. 강제 줄바꿈은
                                컬럼 폭이 바뀌면 어색한 자리에서 끊기고, 대시는
                                이미 색상 대비로 나뉜 두 구절을 한 번 더 나눈다.

                                단, 두 구절의 분리는 `sm:` 이상이 아니라 **모든
                                폭**에서 유지한다. 처음엔 `sm:block`이었는데,
                                그러면 모바일에서만 두 문장이 한 줄로 붙어
                                "새로운 기준 AI가 분석하고"처럼 읽힌다 — 대시를
                                걷어낸 자리를 색상만으로는 못 메운다. 모바일이
                                주 트래픽이므로 여기서 어긋나면 안 된다.
                            */}
                            <div className="@container mx-auto max-w-sm sm:max-w-2xl lg:mx-0">
                                <h1 className="text-[clamp(2.1rem,7.4cqw,3.25rem)] leading-[1.12] font-bold tracking-tight text-balance text-secondary-50">
                                    주식과 코인, 투자의 새로운 기준{' '}
                                    <span className="block text-primary-300">
                                        AI가 분석하고 완성하는 SIGLENS
                                    </span>
                                </h1>
                            </div>
                            <p className="mx-auto mt-5 max-w-md text-base leading-relaxed text-secondary-400 sm:max-w-2xl sm:text-lg lg:mx-0">
                                {skillCounts.indicators}종의 지표와 다양한 투자
                                전략 기반의 차트 흐름,&nbsp;
                                <br className="hidden sm:block" />
                                뉴스·펀더멘털·공포 탐욕 지수를 분석한 AI
                                리포트를 쉽고 편하게 확인하세요.
                            </p>
                            {/* `tabIndex={-1}` — 이게 없으면 위의 건너뛰기
                                링크가 해시만 바꾸고 **DOM 포커스는 body에
                                남는다**(실측). 링크가 하겠다고 적은 일을
                                실제로 하게 만든다.

                                남은 한계: 이 링크는 헤더 **뒤**에 있어 실제로
                                아껴주는 탭 수가 적다. 앞으로 옮기려면 레이아웃이
                                공용 대상 id를 갖고 각 페이지 `<main>`이 그걸
                                받아야 해서 이 작업 범위 밖이다. SC 2.4.1 자체는
                                랜드마크(main 1개 + 라벨된 nav 7개)로 충족된다. */}
                            <div
                                id="search"
                                tabIndex={-1}
                                className="mt-8 flex w-full justify-center focus:outline-none lg:justify-start"
                            >
                                <SymbolSearchPanel className="max-w-2xl lg:max-w-none" />
                            </div>
                            <div className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 lg:justify-start">
                                {HERO_QUICK_LINKS.map(({ href, label }) => (
                                    <Link
                                        key={href}
                                        href={href}
                                        // 헤더 네비와 같은 목적지(/market·/news·/economy)를
                                        // 랜딩에서 한 번 더 노출한다. prefetch를 켜두면 같은
                                        // 목적지에 대해 진입 경로별로 다른 `_rsc` 키가 또
                                        // 쌓인다 (docs/architecture/CDN_CACHING.md §1).
                                        prefetch={false}
                                        className="inline-flex items-center gap-1 text-sm font-semibold text-primary-400 transition-colors hover:text-primary-300"
                                    >
                                        {label}{' '}
                                        <span aria-hidden="true">→</span>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="relative mt-10">
                        <Suspense fallback={<StatsBarSkeleton />}>
                            <AsyncStatsBar />
                        </Suspense>
                    </div>
                </section>
                <section className="page-container pb-8">
                    {/*
                        백테스팅은 이 제품이 "믿을 만한가"에 답하는 유일한 실증인데
                        회색 스트립에 12px 보조 텍스트로 묻혀 있었다. AI 분석의
                        신뢰도가 곧 제품 가치이므로, 질문을 제목 크기로 올리고
                        액센트 보더로 한 번 짚는다. 문구는 그대로 둔다.
                    */}
                    <div className="flex flex-col items-center gap-4 rounded-lg border border-l-2 border-secondary-700 border-l-primary-500 bg-secondary-800 px-6 py-6 text-center sm:flex-row sm:justify-between sm:text-left">
                        <div>
                            <p className="text-lg font-semibold text-secondary-100">
                                Siglens는 얼마나 정확할까요?
                            </p>
                            <p className="mt-1 text-sm leading-relaxed text-secondary-400">
                                주요 10개 종목으로 2년치 기술적 분석과 AI 예측을
                                백테스트한 결과를 확인하세요.
                            </p>
                        </div>
                        <Link
                            href="/backtesting"
                            // 랜딩은 트래픽이 가장 많은 페이지라 이 링크 하나가 대량의
                            // 파편화된 `_rsc` 요청을 만든다 (CDN_CACHING.md §1).
                            prefetch={false}
                            className="shrink-0 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-700 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                        >
                            백테스팅 결과 보기 →
                        </Link>
                    </div>
                </section>
                <Suspense fallback={<SkillsShowcaseSkeleton />}>
                    <SkillsShowcaseServer />
                </Suspense>
                <TickerCategories />
                <CryptoShowcase />
            </main>
        </>
    );
}

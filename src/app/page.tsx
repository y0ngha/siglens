import { Suspense, cache } from 'react';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/seo';
import {
    countSkillFiles,
    FileSkillsLoader,
} from '@/infrastructure/skills/loader';
import { Footer } from '@/components/layout/Footer';
import { SymbolSearchPanel } from '@/components/search/SymbolSearchPanel';
import { StatsBar, StatsBarSkeleton } from '@/components/home/StatsBar';
import { HowItWorks } from '@/components/home/HowItWorks';
import {
    SkillsShowcase,
    SkillsShowcaseSkeleton,
} from '@/components/home/SkillsShowcase';
import { TickerCategories } from '@/components/home/TickerCategories';

const loadSkills = cache(() => new FileSkillsLoader().loadSkills());

async function AsyncStatsBar() {
    const skills = await loadSkills();
    return <StatsBar skills={skills} />;
}

async function SkillsShowcaseServer() {
    const skills = await loadSkills();
    return <SkillsShowcase skills={skills} />;
}

export default async function Home() {
    const skillCounts = await countSkillFiles();

    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: SITE_NAME,
        description: SITE_DESCRIPTION,
        url: SITE_URL,
        inLanguage: 'ko',
        applicationCategory: 'FinanceApplication',
        operatingSystem: 'Web',
        offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'USD',
        },
    };

    const organizationJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: SITE_NAME,
        url: SITE_URL,
        logo: `${SITE_URL}/icon.png`,
        description: SITE_DESCRIPTION,
        sameAs: ['https://github.com/y0ngha/siglens'],
    };

    const websiteJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: SITE_NAME,
        url: SITE_URL,
        potentialAction: {
            '@type': 'SearchAction',
            target: {
                '@type': 'EntryPoint',
                urlTemplate: `${SITE_URL}/{search_term_string}`,
            },
            'query-input': 'required name=search_term_string',
        },
    };

    const howToJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'HowTo',
        name: `${SITE_NAME}로 미국 주식 AI 기술적 분석하는 방법`,
        description: `종목 티커를 입력하면 보조지표 ${skillCounts.indicators}종, 캔들 패턴 ${skillCounts.candlesticks}종, 차트 패턴 ${skillCounts.patterns}종, 전략 ${skillCounts.strategies}종, 지지/저항 ${skillCounts.supportResistance}종을 자동 분석합니다.`,
        step: [
            {
                '@type': 'HowToStep',
                name: '티커 입력',
                text: '분석하고 싶은 미국 주식 종목의 심볼(티커)을 검색창에 입력합니다. 예: AAPL, TSLA, NVDA',
            },
            {
                '@type': 'HowToStep',
                name: '자동 분석',
                text: `보조지표 ${skillCounts.indicators}종, 캔들 패턴 ${skillCounts.candlesticks}종, 차트 패턴 ${skillCounts.patterns}종, 전략 ${skillCounts.strategies}종, 지지/저항 ${skillCounts.supportResistance}종이 자동으로 분석됩니다.`,
            },
            {
                '@type': 'HowToStep',
                name: 'AI 리포트 확인',
                text: '추세, 리스크, 진입 추천, 시그널, 차트 패턴, 전략 분석, 주요 지지/저항 레벨을 AI 리포트로 한 화면에서 확인합니다.',
            },
        ],
    };

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
                }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(organizationJsonLd).replace(
                        /</g,
                        '\\u003c'
                    ),
                }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(websiteJsonLd).replace(
                        /</g,
                        '\\u003c'
                    ),
                }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(howToJsonLd).replace(
                        /</g,
                        '\\u003c'
                    ),
                }}
            />
            <a
                href="#search"
                className="focus-visible:bg-primary-600 sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-4 focus-visible:left-4 focus-visible:z-50 focus-visible:rounded focus-visible:px-4 focus-visible:py-2 focus-visible:text-white"
            >
                검색으로 건너뛰기
            </a>
            <main className="flex flex-1 flex-col">
                <section className="relative flex flex-1 flex-col items-center justify-center px-6 py-10 text-center sm:py-14 lg:items-start lg:pr-[10vw] lg:pl-[15vw] lg:text-left">
                    <div
                        aria-hidden="true"
                        className="hero-grid pointer-events-none absolute inset-0"
                    />
                    <div
                        aria-hidden="true"
                        className="hero-ambient pointer-events-none absolute inset-0"
                    />
                    <div className="relative">
                        <p className="text-secondary-400 mb-6 font-mono text-xs tracking-[0.3em] uppercase">
                            SIGLENS
                        </p>
                        <h1 className="text-secondary-100 text-[2rem] leading-[1.15] font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl">
                            AI가 분석하는 미국 주식{' '}
                            <span className="text-primary-400 block sm:inline">
                                기술적 분석
                            </span>
                        </h1>
                        <p className="text-secondary-400 mx-auto mt-4 max-w-lg text-base leading-relaxed text-balance sm:text-xl lg:mx-0">
                            종목 티커를 입력하면 차트와 지표를 즉시 분석합니다.
                        </p>
                        <div
                            id="search"
                            className="mt-8 flex justify-center lg:justify-start"
                        >
                            <SymbolSearchPanel />
                        </div>
                        <Suspense fallback={<StatsBarSkeleton />}>
                            <AsyncStatsBar />
                        </Suspense>
                    </div>
                </section>
                <HowItWorks skillCounts={skillCounts} />
                <Suspense fallback={<SkillsShowcaseSkeleton />}>
                    <SkillsShowcaseServer />
                </Suspense>
                <TickerCategories />
            </main>
            <Footer />
        </>
    );
}

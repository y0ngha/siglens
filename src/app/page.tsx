import { Suspense, cache } from 'react';
import Link from 'next/link';
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
import { MarketSummaryPanel } from '@/components/dashboard/MarketSummaryPanel';

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
            priceCurrency: 'KRW',
        },
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

    const faqJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: [
            {
                '@type': 'Question',
                name: `${SITE_NAME}는 어떤 서비스인가요?`,
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: '미국 주식 티커를 입력하면 RSI, MACD, 볼린저밴드 등 보조지표와 캔들 패턴, 지지·저항 레벨을 AI가 자동 해석해 주는 무료 웹 서비스입니다. 회원가입 없이 바로 이용할 수 있습니다.',
                },
            },
            {
                '@type': 'Question',
                name: 'AI 대화로 무엇을 물어볼 수 있나요?',
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: '분석된 차트와 지표 데이터를 맥락으로, 현재 추세·진입 타이밍·지표 해석·패턴 의미·전략 비교 등을 자유롭게 질문할 수 있습니다. 답변은 화면에 표시된 분석 결과를 근거로 생성됩니다.',
                },
            },
            {
                '@type': 'Question',
                name: '오늘의 시장 현황에서 어떤 신호를 볼 수 있나요?',
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: '11개 섹터의 선도 종목을 매일 스캔해 골든크로스, 데드크로스, RSI 다이버전스, 볼린저 스퀴즈 등 기술적 신호가 포착된 티커를 보여줍니다. 관심 종목을 클릭하면 상세 AI 분석 페이지로 바로 이동합니다.',
                },
            },
            {
                '@type': 'Question',
                name: '서비스 이용 요금이 있나요?',
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: '현재는 회원가입 없이 무료로 제공됩니다. 향후 고급 기능은 유료 플랜으로 제공될 예정이며, 기본 분석은 계속 무료로 이용할 수 있습니다.',
                },
            },
        ],
    };

    const howToJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'HowTo',
        name: `${SITE_NAME}로 미국 주식 시장 분석·기술적 분석·AI 대화하는 방법`,
        description: `${SITE_NAME}에서 미국 주식 종목의 기술적 신호를 AI로 자동 해석하고, 분석 결과를 바탕으로 AI와 대화하는 방법입니다.`,
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
            {
                '@type': 'HowToStep',
                name: 'AI 대화',
                text: '분석 결과를 바탕으로 AI와 직접 대화하세요. 차트 해석, 지표 의미, 매매 전략 등 궁금한 점을 질문하면 분석 데이터 맥락에 맞는 답변을 즉시 받을 수 있습니다.',
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
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(faqJsonLd).replace(
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
                            미국 주식,{' '}
                            <span className="text-primary-400 block sm:inline">
                                AI가 읽어주는 시장과 차트
                            </span>
                        </h1>
                        <p className="text-secondary-400 mx-auto mt-4 max-w-lg text-base leading-relaxed text-balance sm:text-xl lg:mx-0">
                            오늘 주목할 섹터부터 종목별 기술적 분석, AI 대화까지
                            한 번에.
                        </p>
                        <div
                            id="search"
                            className="mt-8 flex justify-center lg:justify-start"
                        >
                            <SymbolSearchPanel />
                        </div>
                        <div className="mt-6 flex justify-center lg:justify-start">
                            <Link
                                href="/market"
                                className="text-primary-400 hover:text-primary-300 inline-flex items-center gap-1 text-sm font-semibold tracking-wider uppercase transition-colors"
                            >
                                오늘 주목할 종목 →
                            </Link>
                        </div>
                        <Suspense fallback={<StatsBarSkeleton />}>
                            <AsyncStatsBar />
                        </Suspense>
                    </div>
                </section>
                <MarketSummaryPanel />
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

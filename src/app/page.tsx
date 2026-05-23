import { HowItWorks } from '@/components/home/HowItWorks';
import {
    SkillsShowcase,
    SkillsShowcaseSkeleton,
} from '@/components/home/SkillsShowcase';
import { StatsBar, StatsBarSkeleton } from '@/components/home/StatsBar';
import { TickerCategories } from '@/components/home/TickerCategories';
import { SymbolSearchPanel } from '@/components/search/SymbolSearchPanel';
import { JsonLd } from '@/components/ui/JsonLd';
import {
    countSkillFiles,
    FileSkillsLoader,
} from '@/infrastructure/skills/loader';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/seo';
import Link from 'next/link';
import { cache, Suspense } from 'react';

const loadSkills = cache(() => new FileSkillsLoader().loadSkills());

async function AsyncStatsBar() {
    const skills = await loadSkills();
    return <StatsBar skills={skills} />;
}

async function SkillsShowcaseServer() {
    const skills = await loadSkills();
    return <SkillsShowcase skills={skills} />;
}

// WebSite SearchAction(urlTemplate=`?q={search_term_string}`)의 ?q= 처리는 proxy.ts가 담당한다.
// page.tsx에서 searchParams를 소비하면 라우트가 dynamic으로 바뀌어 ISR 캐싱이 불가능하기 때문이다.
export default async function Home() {
    const skillCounts = await countSkillFiles();

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

    const faqJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: [
            {
                '@type': 'Question',
                name: `${SITE_NAME}는 어떤 서비스인가요?`,
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: '미국 주식 티커를 입력하면 차트(보조지표와 캔들 패턴, 지지선과 저항선), 실적과 밸류에이션, 최근 뉴스 흐름, 그리고 단기 매수 분위기(공포 탐욕 지수)까지 각각 정리하고 이걸 묶은 종합 결론까지 보여주는 무료 웹 서비스입니다. 회원가입 없이 바로 이용할 수 있습니다.',
                },
            },
            {
                '@type': 'Question',
                name: 'AI 대화로 무엇을 물어볼 수 있나요?',
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'Siglens 챗봇은 현재 보고 있는 종목의 차트와 지표 데이터를 맥락으로, 추세 해석, 진입 타이밍, 지표 의미, 패턴 비교, 전략 토론 같은 질문에 답합니다. 답변은 화면에 표시된 분석 결과를 근거로 생성됩니다.',
                },
            },
            {
                '@type': 'Question',
                name: '오늘의 시장 현황에서 어떤 신호를 볼 수 있나요?',
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'Siglens의 /market 페이지에서는 11개 섹터의 선도 종목을 매일 스캔해 골든크로스, 데드크로스, RSI 다이버전스, 볼린저 스퀴즈 같은 기술적 신호가 포착된 티커를 정리해 보여줍니다. 관심 종목을 클릭하면 해당 티커의 상세 AI 분석 페이지로 이동합니다.',
                },
            },
            {
                '@type': 'Question',
                name: '특정 종목의 PER이나 ROE 같은 실적 지표는 어디서 보나요?',
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: '종목 페이지의 펀더멘털 탭에서 PER, PBR, ROE, 영업이익률 같은 밸류에이션과 수익성 지표, 동종 업계 평균 비교를 함께 볼 수 있습니다. 예를 들어 애플이라면 /AAPL/fundamental 경로에서 확인합니다.',
                },
            },
            {
                '@type': 'Question',
                name: '어닝과 실적 발표나 뉴스 분위기를 확인하고 싶을 때는 어디로 가야 하나요?',
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: '종목 페이지의 뉴스 탭에서 최근 어닝과 실적 결과, 가이던스, 주요 이벤트와 함께 뉴스 분위기(호재, 중립, 악재 분포)를 정리해 보여줍니다. 예를 들어 테슬라는 /TSLA/news 경로이며, 차트만으로 설명되지 않는 가격 움직임을 점검할 때 유용합니다.',
                },
            },
            {
                '@type': 'Question',
                name: '지금 이 종목에 매수세가 강한지도 알 수 있나요?',
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: '각 종목 페이지의 공포 탐욕 지수 탭(예: /AAPL/fear-greed)에서 거래량 흐름과 가격 위치를 묶어 0~100 점수로 단기 분위기를 확인합니다. 0에 가까울수록 매도세, 100에 가까울수록 매수세가 강하다는 뜻이고, 5단계 라벨로 극심한 공포부터 극심한 탐욕까지 보여줍니다.',
                },
            },
            {
                '@type': 'Question',
                name: '차트와 실적, 뉴스를 합친 결론은 어디서 볼 수 있나요?',
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: '종목 페이지의 종합 분석 탭에서 차트, 실적, 뉴스, 공포 탐욕 지수를 묶어 강세와 약세 시나리오, 핵심 점검 포인트, 위험 요인을 함께 정리한 결론을 확인할 수 있습니다. 예를 들어 엔비디아는 /NVDA/overall 경로입니다.',
                },
            },
            {
                '@type': 'Question',
                name: 'AI 분석이 실제로 얼마나 맞는지 궁금할 때는요?',
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: '/backtesting 페이지에서 주요 종목을 대상으로 한 2년치 기술적 분석과 AI 예측의 적중률, 누적 수익률 시뮬레이션을 공개하고 있어 분석 결과를 신뢰할지 판단할 때 참고할 수 있습니다.',
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
        name: `${SITE_NAME}로 미국 주식을 차트와 실적, 뉴스, 공포 탐욕 지수로 살펴보고 종합 결론까지 받는 방법`,
        description: `${SITE_NAME}에서 한 종목을 차트, 실적, 뉴스, 공포 탐욕 지수 네 축으로 살펴보고, 넷을 묶은 종합 결론과 시나리오를 받는 흐름입니다.`,
        step: [
            {
                '@type': 'HowToStep',
                name: '종목명이나 심볼 입력',
                text: '분석하고 싶은 미국 주식 종목명이나 심볼을 검색창에 입력합니다. 예: 애플, 테슬라, 엔비디아, AAPL, TSLA, NVDA.',
                url: `${SITE_URL}/#search`,
            },
            {
                '@type': 'HowToStep',
                name: '차트 분석 살펴보기',
                text: `종목 페이지에서 보조지표 ${skillCounts.indicators}종, 캔들 패턴 ${skillCounts.candlesticks}종, 차트 패턴 ${skillCounts.patterns}종, 전략 ${skillCounts.strategies}종, 지지선과 저항선 레벨 ${skillCounts.supportResistance}종 기준으로 추세와 진입 후보 구간을 살펴봅니다.`,
                url: `${SITE_URL}/AAPL`,
            },
            {
                '@type': 'HowToStep',
                name: '실적과 뉴스로 보강하기',
                text: '종목 페이지의 펀더멘털 탭에서 PER, PBR, ROE 같은 밸류에이션과 수익성 지표를, 뉴스 탭에서 어닝과 실적 발표, 뉴스 분위기를 확인해 차트가 보여주지 않는 배경을 보강합니다. 예: /AAPL/fundamental, /AAPL/news.',
                url: `${SITE_URL}/AAPL/fundamental`,
            },
            {
                '@type': 'HowToStep',
                name: '단기 매수 분위기 확인',
                text: '공포 탐욕 지수 탭(예: /AAPL/fear-greed)에서 단기 매수세가 강한지 약한지를 0~100 점수와 5단계 분위기로 확인합니다. 차트가 좋아 보여도 분위기가 너무 과열이면 진입 타이밍을 한 번 더 따져볼 수 있습니다.',
                url: `${SITE_URL}/AAPL/fear-greed`,
            },
            {
                '@type': 'HowToStep',
                name: '종합 결론 확인',
                text: '종합 분석 탭(예: /AAPL/overall)에서 차트, 실적, 뉴스, 공포 탐욕 지수를 묶은 종합 결론과 강세, 약세 시나리오, 점검 포인트, 위험 요인을 함께 확인합니다.',
                url: `${SITE_URL}/AAPL/overall`,
            },
            {
                '@type': 'HowToStep',
                name: 'AI에게 추가 질문',
                text: '판단이 애매할 때는 챗봇에게 직접 질문할 수 있습니다. 현재 보고 있는 종목 데이터를 맥락으로, 지표 해석, 시나리오 비교, 매매 전략 같은 질문에 답변을 받습니다.',
                url: `${SITE_URL}/AAPL#chat`,
            },
        ],
    };

    return (
        <>
            <JsonLd data={jsonLd} />
            <JsonLd data={webPageJsonLd} />
            <JsonLd data={organizationJsonLd} />
            <JsonLd data={howToJsonLd} />
            <JsonLd data={faqJsonLd} />
            <a
                href="#search"
                className="focus-visible:bg-primary-600 sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-4 focus-visible:left-4 focus-visible:z-50 focus-visible:rounded focus-visible:px-4 focus-visible:py-2 focus-visible:text-white"
            >
                검색으로 건너뛰기
            </a>
            <main className="flex flex-1 flex-col">
                <section className="relative flex flex-col items-center justify-center overflow-hidden px-6 py-12 text-center sm:py-16 lg:items-start lg:pr-[10vw] lg:pl-[15vw] lg:text-left">
                    <div
                        aria-hidden="true"
                        className="hero-report-lines pointer-events-none absolute inset-0"
                    />
                    <div className="relative w-full max-w-4xl">
                        <p className="text-secondary-400 mb-5 font-mono text-[0.68rem] leading-relaxed tracking-[0.18em] uppercase sm:text-xs">
                            미국 주식 AI 분석 플랫폼, SIGLENS
                        </p>
                        <h1 className="text-secondary-100 mx-auto max-w-sm text-[2.2rem] leading-[1.1] font-bold tracking-tight text-balance sm:max-w-2xl sm:text-5xl lg:mx-0 lg:text-6xl">
                            복잡한 미국 주식 분석을
                            <br />
                            <span className="text-primary-300">
                                읽기 좋게 정리합니다
                            </span>
                        </h1>
                        <p className="text-secondary-400 mx-auto mt-5 max-w-sm text-base leading-relaxed sm:max-w-2xl sm:text-lg lg:mx-0">
                            티커를 입력하면 보조지표 {skillCounts.indicators}종
                            기반 차트 흐름, 실적과 밸류에이션, 최근 뉴스, 그리고
                            단기 매수 분위기까지 정리하고, 이걸 합친 종합 결론을
                            함께 보여줍니다.
                        </p>
                        <div
                            id="search"
                            className="mt-8 flex w-full justify-center lg:justify-start"
                        >
                            <SymbolSearchPanel />
                        </div>
                        <div className="mt-6 flex justify-center lg:justify-start">
                            <Link
                                href="/market"
                                className="text-primary-400 hover:text-primary-300 inline-flex items-center gap-1 text-sm font-semibold transition-colors"
                            >
                                오늘 주목할 종목 →
                            </Link>
                        </div>
                        <Suspense fallback={<StatsBarSkeleton />}>
                            <AsyncStatsBar />
                        </Suspense>
                    </div>
                </section>
                <HowItWorks skillCounts={skillCounts} />
                <section className="px-6 pb-8 lg:px-[15vw]">
                    <div className="border-secondary-800 bg-secondary-800/30 flex flex-col items-center gap-3 rounded-lg border px-6 py-5 text-center sm:flex-row sm:justify-between sm:text-left">
                        <div>
                            <p className="text-secondary-200 text-sm font-semibold">
                                Siglens는 얼마나 정확할까요?
                            </p>
                            <p className="text-secondary-500 mt-0.5 text-xs">
                                주요 10개 종목으로 2년치 기술적 분석과 AI 예측을
                                백테스트한 결과를 확인하세요.
                            </p>
                        </div>
                        <Link
                            href="/backtesting"
                            className="bg-secondary-700 text-secondary-200 hover:bg-secondary-600 shrink-0 rounded-md px-4 py-2 text-xs font-medium transition-colors"
                        >
                            백테스팅 결과 보기 →
                        </Link>
                    </div>
                </section>
                <Suspense fallback={<SkillsShowcaseSkeleton />}>
                    <SkillsShowcaseServer />
                </Suspense>
                <TickerCategories />
            </main>
        </>
    );
}

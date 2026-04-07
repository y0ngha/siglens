import Link from 'next/link';

import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/seo';
import { FileSkillsLoader } from '@/infrastructure/skills/loader';
import { Footer } from '@/components/layout/Footer';
import { SymbolSearch } from '@/components/search/SymbolSearch';
import { StatsBar } from '@/components/home/StatsBar';
import { HowItWorks } from '@/components/home/HowItWorks';
import { SkillsShowcase } from '@/components/home/SkillsShowcase';

const POPULAR_TICKERS = [
    'AAPL',
    'TSLA',
    'NVDA',
    'MSFT',
    'GOOGL',
    'AMZN',
] as const;

export default async function Home() {
    const loader = new FileSkillsLoader();
    const skills = await loader.loadSkills();

    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: SITE_NAME,
        description: SITE_DESCRIPTION,
        url: SITE_URL,
        applicationCategory: 'FinanceApplication',
        operatingSystem: 'Web',
        offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'USD',
        },
    };

    return (
        <>
            <script
                type="application/ld+json"
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <a
                href="#search"
                className="focus-visible:bg-primary-600 sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-4 focus-visible:left-4 focus-visible:z-50 focus-visible:rounded focus-visible:px-4 focus-visible:py-2 focus-visible:text-white"
            >
                검색으로 건너뛰기
            </a>
            <main className="flex flex-1 flex-col">
                <section className="relative flex flex-1 flex-col items-center justify-center px-6 py-20 text-center lg:items-start lg:pr-[10vw] lg:pl-[15vw] lg:text-left">
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
                        <h1 className="text-secondary-100 text-3xl leading-tight font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl">
                            AI가 분석하는 미국 주식{' '}
                            <span className="text-primary-400">
                                기술적 분석
                            </span>
                        </h1>
                        <p className="text-secondary-400 mx-auto mt-4 max-w-lg text-lg leading-relaxed sm:text-xl lg:mx-0">
                            종목 티커를 입력하면 차트와 지표를 즉시 분석합니다.
                        </p>
                        <div
                            id="search"
                            className="mt-8 flex justify-center lg:justify-start"
                        >
                            <SymbolSearch size="lg" />
                        </div>
                        <div className="mt-6 flex flex-wrap items-center justify-center gap-2 lg:justify-start">
                            <span className="text-secondary-500 text-xs">
                                인기 종목
                            </span>
                            {POPULAR_TICKERS.map(ticker => (
                                <Link
                                    key={ticker}
                                    href={`/${ticker}`}
                                    className="border-secondary-700 text-secondary-300 hover:border-primary-600/40 hover:text-primary-400 rounded-full border px-3 py-1 text-xs transition-colors"
                                >
                                    {ticker}
                                </Link>
                            ))}
                        </div>
                        <StatsBar skills={skills} />
                    </div>
                </section>
                <HowItWorks />
                <section className="pb-16">
                    <SkillsShowcase skills={skills} />
                </section>
            </main>
            <Footer />
        </>
    );
}

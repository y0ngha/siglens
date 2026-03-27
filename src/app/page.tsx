import Link from 'next/link';

import { Footer } from '@/components/layout/Footer';
import { SymbolSearch } from '@/components/search/SymbolSearch';

const POPULAR_TICKERS = [
    'AAPL',
    'TSLA',
    'NVDA',
    'MSFT',
    'GOOGL',
    'AMZN',
] as const;

const features = [
    {
        number: '01',
        title: '실시간 차트',
        description: '캔들스틱, 거래량, 이동평균선을 한 화면에.',
    },
    {
        number: '02',
        title: '기술적 지표',
        description: 'RSI, MACD, 볼린저 밴드, DMI — 자동 계산.',
    },
    {
        number: '03',
        title: 'AI 패턴 분석',
        description: 'Claude AI가 차트 패턴과 매매 신호를 해석합니다.',
    },
    {
        number: '04',
        title: '지지/저항 레벨',
        description: '핵심 가격대를 자동으로 식별합니다.',
    },
] as const;

export default function Home() {
    return (
        <>
            <a
                href="#search"
                className="focus:bg-primary-600 sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded focus:px-4 focus:py-2 focus:text-white"
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
                    </div>
                </section>
                <section className="pb-24">
                    <hr className="border-secondary-800 mx-auto mb-16 max-w-4xl px-6 lg:px-[15vw]" />
                    <div className="mx-auto grid max-w-4xl grid-cols-1 gap-x-16 gap-y-10 px-6 md:grid-cols-2 lg:px-[15vw]">
                        {features.map((feature, index) => {
                            const isOddIndex = index % 2 !== 0;
                            return (
                                <div
                                    key={feature.number}
                                    className={
                                        isOddIndex ? 'md:mt-8' : undefined
                                    }
                                >
                                    <div className="flex items-start gap-4">
                                        <span className="text-primary-600/25 font-mono text-3xl leading-none font-bold">
                                            {feature.number}
                                        </span>
                                        <div>
                                            <h2 className="text-secondary-200 text-sm font-semibold tracking-wider uppercase">
                                                {feature.title}
                                            </h2>
                                            <p className="text-secondary-400 mt-1 text-sm leading-relaxed">
                                                {feature.description}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            </main>
            <Footer />
        </>
    );
}

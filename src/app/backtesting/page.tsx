import type { Metadata } from 'next';
import { Suspense } from 'react';
import {
    BACKTESTING_DESCRIPTION,
    BACKTESTING_KEYWORDS,
    BACKTESTING_TITLE,
    BACKTESTING_URL,
    buildBreadcrumbJsonLd,
    SITE_BUILD_DATE,
    SITE_NAME,
    SITE_URL,
} from '@/shared/lib/seo';
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from '@/shared/lib/og';
import { TERMS_PATH } from '@/shared/lib/legal';
import { BacktestHero } from '@/widgets/backtesting/BacktestHero';
import { BacktestTabs } from '@/widgets/backtesting/BacktestTabs';
import { JsonLd } from '@/shared/ui/JsonLd';
import backtestData from '@/app/backtesting/data.json';
import { validateBacktestData } from '@/entities/backtest-case';

// JSON import typed as any; validateBacktestData ensures shape at load time
const data = validateBacktestData(backtestData as unknown);
// Derived once at module load — intentionally static, data.json is replaced by the script
const TICKERS = [...new Set(data.cases.map(c => c.ticker))];

const BACKTESTING_FULL_TITLE = `${BACKTESTING_TITLE} | ${SITE_NAME}`;

export const metadata: Metadata = {
    title: { absolute: BACKTESTING_FULL_TITLE },
    description: BACKTESTING_DESCRIPTION,
    keywords: BACKTESTING_KEYWORDS,
    alternates: { canonical: BACKTESTING_URL },
    openGraph: {
        title: BACKTESTING_FULL_TITLE,
        description: BACKTESTING_DESCRIPTION,
        url: BACKTESTING_URL,
        siteName: SITE_NAME,
        locale: 'ko_KR',
        type: 'website',
        images: [
            {
                url: '/og-image.png',
                width: OG_IMAGE_WIDTH,
                height: OG_IMAGE_HEIGHT,
                alt: `${SITE_NAME} AI 백테스팅 결과`,
            },
        ],
    },
    twitter: {
        card: 'summary_large_image',
        title: BACKTESTING_FULL_TITLE,
        description: BACKTESTING_DESCRIPTION,
        images: ['/og-image.png'],
    },
};

const webPageJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${BACKTESTING_URL}#webpage`,
    name: BACKTESTING_FULL_TITLE,
    description: BACKTESTING_DESCRIPTION,
    url: BACKTESTING_URL,
    isPartOf: { '@type': 'WebSite', '@id': `${SITE_URL}#website` },
};

const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: BACKTESTING_TITLE, url: BACKTESTING_URL },
]);

const datasetJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: `${SITE_NAME} AI 기술적 분석 백테스팅 데이터셋`,
    description: BACKTESTING_DESCRIPTION,
    url: BACKTESTING_URL,
    identifier: 'siglens-backtesting-2024-2026',
    creator: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
    license: `${SITE_URL}${TERMS_PATH}`,
    temporalCoverage: '2024-04/2026-04',
    spatialCoverage: 'US',
    variableMeasured: '주식 기술적 분석 신호 승률 및 AI 예측 정확도',
    keywords: [
        'AI stock prediction backtesting',
        'US stock technical analysis backtest',
        'RSI MACD signal accuracy',
        'Magnificent 7 backtest',
        'AAPL NVDA TSLA backtest',
        '주식 기술적 분석 백테스팅',
        'AI 주식 예측 정확도',
    ],
    distribution: [
        {
            '@type': 'DataDownload',
            encodingFormat: 'application/json',
            contentUrl: `${SITE_URL}/backtesting/data.json`,
            dateModified: SITE_BUILD_DATE.toISOString(),
        },
    ],
};

export default function BacktestingPage() {
    return (
        <>
            <JsonLd data={webPageJsonLd} />
            <JsonLd data={breadcrumbJsonLd} />
            <JsonLd data={datasetJsonLd} />
            {/* main이 백테스트 컨텐츠 전체(hero h1 포함)를 감싸야 의미론적
                landmark가 페이지 주제와 일치한다. 이전엔 BacktestHero가 main
                바깥에 있어 h1이 landmark 밖으로 빠지는 문제가 있었다. */}
            <main className="bg-secondary-900 min-h-screen">
                <BacktestHero meta={data.meta} />
                <Suspense
                    fallback={
                        <div className="text-secondary-500 py-10 text-center text-sm">
                            로딩 중...
                        </div>
                    }
                >
                    <BacktestTabs cases={data.cases} tickers={TICKERS} />
                </Suspense>
                <div
                    role="note"
                    aria-label="투자 면책 고지"
                    className="border-secondary-800 border-t px-6 py-4"
                >
                    <p className="text-secondary-600 text-center text-[11px]">
                        * 본 결과는 과거 데이터 기반 백테스팅이며 미래 수익을
                        보장하지 않습니다. 투자 판단의 책임은 투자자 본인에게
                        있습니다.
                    </p>
                </div>
            </main>
        </>
    );
}

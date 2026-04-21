import type { Metadata } from 'next';
import { Suspense } from 'react';
import {
    BACKTESTING_DESCRIPTION,
    BACKTESTING_KEYWORDS,
    BACKTESTING_TITLE,
    BACKTESTING_URL,
    OG_IMAGE_HEIGHT,
    OG_IMAGE_WIDTH,
    SITE_NAME,
    SITE_URL,
} from '@/lib/seo';
import { TERMS_PATH } from '@/lib/legal';
import { BacktestHero } from '@/components/backtesting/BacktestHero';
import { BacktestTabs } from '@/components/backtesting/BacktestTabs';
import { JsonLd } from '@/components/ui/JsonLd';
import backtestData from './data.json';
import { validateBacktestData } from '@/domain/backtest/validate';

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
    name: BACKTESTING_FULL_TITLE,
    description: BACKTESTING_DESCRIPTION,
    url: BACKTESTING_URL,
    isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: SITE_URL },
};

const datasetJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: `${SITE_NAME} AI 기술적 분석 백테스팅 데이터셋`,
    description: BACKTESTING_DESCRIPTION,
    url: BACKTESTING_URL,
    creator: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
    license: `${SITE_URL}${TERMS_PATH}`,
    temporalCoverage: '2024-04/2026-04',
    spatialCoverage: 'US',
    variableMeasured: '주식 기술적 분석 신호 승률 및 AI 예측 정확도',
};

export default function BacktestingPage() {
    return (
        <>
            <JsonLd data={webPageJsonLd} />
            <JsonLd data={datasetJsonLd} />
            <div className="bg-secondary-900 min-h-screen">
                <BacktestHero meta={data.meta} />
                <main>
                    <Suspense
                        fallback={
                            <div className="text-secondary-500 py-10 text-center text-sm">
                                로딩 중...
                            </div>
                        }
                    >
                        <BacktestTabs cases={data.cases} tickers={TICKERS} />
                    </Suspense>
                </main>
                <footer className="border-secondary-800 border-t px-6 py-4">
                    <p className="text-secondary-600 text-center text-[11px]">
                        * 본 결과는 과거 데이터 기반 백테스팅이며 미래 수익을
                        보장하지 않습니다. 투자 판단의 책임은 투자자 본인에게
                        있습니다.
                    </p>
                </footer>
            </div>
        </>
    );
}

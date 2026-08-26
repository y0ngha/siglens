import type { Metadata } from 'next';
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

/**
 * 클라이언트로 넘길 케이스의 프로젝션.
 *
 * `BacktestTabs`는 `'use client'`라 이 배열이 통째로 RSC flight에 실린다. 두 필드가
 * 읽히지 않은 채 실려 있었다:
 * - `bullishTargets`의 2번째 이후 원소 — `BacktestCaseCard`는 `[0]`과 `.length > 0`만
 *   본다. `slice(0, 1)`은 두 접근의 결과를 모두 보존한다(빈 배열도 빈 채로 남는다).
 *
 * `aiResult`(853B)도 렌더되지 않지만 남겨뒀다 — 떼려면 `BacktestTabs` →
 * `BacktestCaseList` → `BacktestCaseCard`의 prop 타입을 `Omit`으로 좁혀야 하고,
 * 그 값어치가 안 된다.
 *
 * `data.json` 자체는 건드리지 않는다 — `/backtesting/data.json`으로 공개되는 Dataset이고
 * `datasetJsonLd`의 `distribution`이 그 파일을 가리킨다.
 */
const CLIENT_CASES = data.cases.map(c => ({
    ...c,
    aiAnalysis: {
        ...c.aiAnalysis,
        bullishTargets: c.aiAnalysis.bullishTargets.slice(0, 1),
    },
}));
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
            <main className="min-h-screen bg-secondary-900">
                <BacktestHero meta={data.meta} />
                {/* BacktestTabs는 더 이상 useSearchParams()를 렌더 중 호출하지
                    않으므로(useBacktestFilter 참고) Suspense 경계가 필요 없다 —
                    전체 케이스 목록이 그대로 SSR 정적 HTML에 포함된다. */}
                <BacktestTabs cases={CLIENT_CASES} tickers={TICKERS} />
                {/* 구분선은 전폭으로 두고 좌우 여백은 안쪽 `page-container`가
                    갖는다 — 히어로의 `border-b`와 같은 구조라 두 띠가 같은 선에서
                    끝난다. 바깥에 `page-container`를 걸면 구분선이 1200px에서
                    잘려 형제 섹션과 어긋난다. */}
                <div
                    role="note"
                    aria-label="투자 면책 고지"
                    className="border-t border-secondary-700 py-4"
                >
                    <p className="page-container text-center text-[11px] text-secondary-500">
                        * 본 결과는 과거 데이터 기반 백테스팅이며 미래 수익을
                        보장하지 않습니다. 투자 판단의 책임은 투자자 본인에게
                        있습니다.
                    </p>
                </div>
            </main>
        </>
    );
}

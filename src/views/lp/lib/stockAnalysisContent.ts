/**
 * Hard-coded Korean copy for `/lp/stock-analysis`. Ad-only page: Korean only,
 * no crypto wording (`lib/lpCopyRules.ts` checks the rendered page).
 */
import { SITE_URL } from '@/shared/lib/seo';
import {
    GaugeIcon,
    LayersIcon,
    OptionsIcon,
    QuoteIcon,
} from '@/shared/ui/StrokeIcons';
import type { Feature, LpAnalysisSubject, PopularStock } from './types';

/** Label of every primary CTA on the page. */
export const ANALYSIS_CTA = '종목 분석 시작';

/** Every primary CTA opens a real symbol page on the main host. */
export const ANALYSIS_CTA_HREF = `${SITE_URL}/NVDA`;

/** The feature cards, each linking to a symbol tab that shows the data. */
export const FEATURES: readonly Feature[] = [
    {
        Icon: QuoteIcon,
        title: '차트 지표 AI 해석',
        scope: '미국, 한국',
        body: 'RSI, MACD, 볼린저밴드 같은 보조지표를 AI가 읽고 지금 차트가 어떤 상태인지 풀어 줍니다.',
        href: '/NVDA',
        example: '엔비디아 분석 보기',
    },
    {
        Icon: LayersIcon,
        title: '지지선과 저항선 정리',
        scope: '미국, 한국',
        body: '가격이 자주 멈추고 되돌아선 구간을 모아 지금 눈여겨볼 가격대를 정리합니다.',
        href: '/005930.KS',
        example: '삼성전자 분석 보기',
    },
    {
        Icon: GaugeIcon,
        title: '공포탐욕지수',
        scope: '미국, 한국',
        body: '미국과 한국 시장의 투자 심리를 하나의 지수로 보여 줍니다.',
        href: '/AAPL/fear-greed',
        example: '애플 공포탐욕지수 보기',
    },
    {
        Icon: OptionsIcon,
        title: '옵션과 재무, 뉴스',
        scope: '옵션은 미국 주식',
        body: '옵션 흐름, 재무제표, 최신 뉴스를 한 종목 페이지에서 함께 볼 수 있습니다.',
        href: '/NVDA/options',
        example: '엔비디아 옵션 보기',
    },
];

/** The "많이 찾는 종목" chips, in display order. */
export const POPULAR: readonly PopularStock[] = [
    { name: '엔비디아', symbol: 'NVDA' },
    { name: '애플', symbol: 'AAPL' },
    { name: '테슬라', symbol: 'TSLA' },
    { name: '삼성전자', symbol: '005930.KS' },
    { name: 'SK하이닉스', symbol: '000660.KS' },
];

/**
 * The symbols whose cached analysis excerpt the page shows: one US and one KR
 * stock, both already linked by the CTA and the feature cards. Crypto is
 * excluded by the `LpAnalysisSubject` type.
 */
export const LP_ANALYSIS_SUBJECTS: readonly LpAnalysisSubject[] = [
    { symbol: 'NVDA', name: '엔비디아', marketProfile: 'us-equity' },
    { symbol: '005930.KS', name: '삼성전자', marketProfile: 'kr-equity' },
];

/** Copy of the real-analysis section. */
export const REAL_ANALYSIS_COPY = {
    title: '시그렌즈가 최근에 쓴 분석',
    sub: '종목을 열면 시세와 차트를 불러와 지표와 패턴을 계산하고, AI가 한 편의 리포트로 정리합니다. 아래는 실제로 만든 리포트의 앞부분입니다.',
    trendPrefix: '기술적 방향성',
    more: (name: string) => `${name} 전체 분석 보기`,
    note: '미리 만들어 둔 지난 분석이라 지금 시세와 다를 수 있습니다. 규칙으로 계산한 값을 AI가 문장으로 정리한 글이고, 사람이 한 편씩 읽어 보지는 않습니다.',
} as const;

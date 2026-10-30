/**
 * Hard-coded Korean copy for `/lp/stock-analysis`. Ad-only page: Korean only,
 * no crypto wording (`__tests__/lpCopyRules.ts` checks the rendered page).
 */
import type {
    ReplayScenario,
    ReplayTool,
} from '@/shared/lib/replay/replayScript';
import { SITE_URL } from '@/shared/lib/seo';
import {
    GaugeIcon,
    LayersIcon,
    OptionsIcon,
    QuoteIcon,
} from '@/shared/ui/StrokeIcons';
import { toReplayLines } from './replayLines';
import type { Feature, PopularStock } from './types';

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
        body: '가격이 자주 멈추고 되돌아선 구간을 모아 지금 주목할 가격대를 정리합니다.',
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
        body: '옵션 흐름, 재무제표, 최신 뉴스를 종목 하나에서 함께 확인합니다.',
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

const step = (
    label: string,
    pendingLabel: string,
    subject: string,
    ms: number
): ReplayTool => ({ label, pendingLabel, subject, ms });

const BARS = step('시세와 차트', '시세와 차트 불러오는 중', '일봉', 520);
const INDICATORS = step('보조지표', '보조지표 계산하는 중', '', 760);
const PATTERNS = step('캔들과 차트 패턴', '패턴 찾는 중', '', 640);
/** The closing step. It writes the report, so it is not listed as a source. */
const REPORT = step('AI 리포트', 'AI가 정리하는 중', '', 1100);
const fundamentals = (code: string) =>
    step('재무와 뉴스', '재무와 뉴스 확인하는 중', code, 820);

/** One example report: the symbol is the "question" shown in the address bar. */
function scenario(
    id: string,
    symbol: string,
    tools: readonly ReplayTool[],
    lines: readonly string[],
    time: string
): ReplayScenario {
    return {
        id,
        question: symbol,
        tools,
        lines: toReplayLines(lines),
        summary: `${tools.length}단계를 거쳐 분석했어요`,
        sources: tools.filter(x => x !== REPORT).map(x => x.label),
        asOf: `${time} 기준`,
    };
}

/**
 * `siglens.io/about`'s example reports (`views.about.replay` in
 * `messages/ko.json`), minus the coin one and with the middle dots spelled out.
 */
export const ANALYSIS_SCENARIOS: readonly ReplayScenario[] = [
    scenario(
        'aapl',
        'AAPL',
        [BARS, INDICATORS, PATTERNS, fundamentals('AAPL'), REPORT],
        [
            '<b>애플(AAPL)</b>은 50일 이동평균선 위에서 오름세를 이어가고 있어요.',
            '최근 한 달 <up>+6.2%</up>, 같은 기간 나스닥보다 강했어요.',
            '과열 정도를 보는 RSI는 <b>64</b>예요. 과열 기준인 70 바로 아래라 잠깐 쉬어갈 수 있어요.',
            '아래로는 <b>$221</b>, 위로는 <b>$238</b> 부근이 중요한 가격대예요.',
            '실적 발표가 2주 뒤라 그 전후로 움직임이 커질 수 있어요.',
        ],
        '미국 장 마감'
    ),
    scenario(
        'samsung',
        '005930.KS',
        [BARS, INDICATORS, PATTERNS, fundamentals('005930'), REPORT],
        [
            '<b>삼성전자</b>는 20일 이동평균선 아래로 내려와 흐름이 약해졌어요.',
            '최근 5일 <down>-4.1%</down>, 거래량은 평소보다 30% 많았어요.',
            '마지막 캔들에 긴 아래꼬리가 생겨 낮은 가격에서 사려는 힘도 보여요.',
            '<b>70,000원</b> 부근이 먼저 확인할 지지선이에요.',
            '반도체 업황 뉴스에 민감한 구간이라 뉴스 탭을 같이 보는 게 좋아요.',
        ],
        '한국 장 마감'
    ),
];

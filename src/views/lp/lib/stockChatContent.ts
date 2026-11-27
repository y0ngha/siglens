/**
 * Hard-coded Korean copy for `/lp/stock-chat`. Ad-only page: Korean only, no
 * crypto wording (`lib/lpCopyRules.ts` checks the rendered page).
 */
import { AI_SITE_URL } from '@/shared/config/aiHost';
import type {
    ReplayScenario,
    ReplayTool,
} from '@/shared/lib/replay/replayScript';
import { LayersIcon, QuoteIcon, SparkIcon } from '@/shared/ui/StrokeIcons';
import { toReplayLines } from './replayLines';
import type { FaqEntry, HowDemo, HowStep } from './types';

/** Label of every primary CTA on the page. */
export const CHAT_CTA = 'AI에게 물어보기';

/** Every primary CTA opens the agent chat on the ai host. */
export const CHAT_CTA_HREF = `${AI_SITE_URL}/`;

/** Example questions, phrased the way people actually type them. */
export const EXAMPLES: readonly string[] = [
    '삼성전자 요즘 어때?',
    '엔비디아 지금 비싼 편?',
    '이번 주 미국 시장 뉴스 중요한 것만',
];

/** What the agent does between the question and the answer. */
export const HOW: readonly HowStep[] = [
    {
        Icon: QuoteIcon,
        title: '시세 직접 조회',
        body: '답하기 전에 최신 시세와 차트를 직접 찾아봐요.',
    },
    {
        Icon: LayersIcon,
        title: '지표는 규칙으로 계산',
        body: 'RSI, 이동평균 같은 지표는 AI가 짐작하지 않고 정해진 규칙으로 계산해요.',
    },
    {
        Icon: SparkIcon,
        title: '답변마다 출처와 기준 시각',
        body: '어떤 데이터를 언제 기준으로 봤는지 답변과 함께 보여 줘요.',
    },
];

/** The worked example the question-to-answer flow is drawn around. */
export const HOW_DEMO: HowDemo = {
    question: '엔비디아 지금 비싼 편이야?',
    answer: '이익에 비해 가격이 높은지는 PER 같은 지표로 볼 수 있어요. 판단은 보는 사람마다 갈릴 수 있어서, 근거가 되는 데이터를 함께 보여 줘요.',
    chips: ['시세', '기업 정보', '기준 시각'],
};

/** The disclosure FAQ: coverage, price and "no investment advice". */
export const FAQ: readonly FaqEntry[] = [
    {
        q: '어떤 종목을 물어볼 수 있나요?',
        a: '미국 주식과 ETF, 코스피와 코스닥 종목을 물어볼 수 있어요.',
    },
    {
        q: '돈이 드나요?',
        a: '무료로 쓸 수 있어요. 로그인하면 더 많이 물어볼 수 있어요.',
    },
    {
        q: '투자 추천을 해주나요?',
        a: '아니요. 매수나 매도를 권하지 않고, 데이터로 지금 상황을 설명해 드려요.',
    },
];

const tool = (label: string, subject: string, ms: number): ReplayTool => ({
    label,
    pendingLabel: `${label} 확인 중`,
    subject,
    ms,
});

/**
 * One example conversation. The answer lines say what the agent covers, never a
 * figure, so no number can be read as a real quote for the ticker it names. The
 * summary names the lookups only (no duration, which would be a made-up number).
 */
function scenario(
    id: string,
    question: string,
    tools: readonly ReplayTool[],
    lines: readonly string[],
    sources: readonly string[],
    time: string
): ReplayScenario {
    return {
        id,
        question,
        tools,
        lines: toReplayLines(lines),
        summary: `${tools.map(x => x.label).join(', ')} 확인`,
        sources,
        asOf: `기준 ${time}`,
    };
}

/**
 * `ai.siglens.io/about`'s example conversations (`views.ai-about` in
 * `messages/ko.json`), minus the coin one, with the middle dots spelled out
 * and the figures taken out: this page is an ad, so an invented price or
 * percentage next to a real ticker would read as a quote.
 */
export const CHAT_SCENARIOS: readonly ReplayScenario[] = [
    scenario(
        'samsung',
        '삼성전자 요즘 흐름 어때?',
        [
            tool('종목 검색', '삼성전자 → 005930', 520),
            tool('시세', '005930', 640),
            tool('차트와 지표', '005930', 1100),
            tool('시그렌즈 분석', '005930', 780),
        ],
        [
            '삼성전자의 가장 최근 종가와 전날 대비 등락부터 볼게요.',
            '지금 가격이 단기 평균보다 위면 짧게는 오름세, 장기 평균보다 아래면 길게는 아직 회복 전이라고 읽어요.',
            'RSI는 너무 많이 올랐는지 보는 지표예요. 과열도 침체도 아니면 보통 수준이에요.',
            'MACD는 오르고 내리는 힘을 보여 줘요. 신호선을 위로 넘으면 힘이 붙기 시작했다는 뜻이에요.',
            '시그렌즈 분석에서 다음에 볼 가격대가 나오면 같이 적어 둬요.',
        ],
        ['시세', '차트와 지표', '시그렌즈 분석'],
        '가장 최근 종가'
    ),
    scenario(
        'nvda',
        '엔비디아 지금 비싼 편이야?',
        [
            tool('시세', 'NVDA', 600),
            tool('기업 정보', 'NVDA', 1000),
            tool('뉴스', 'NVDA', 820),
        ],
        [
            '이익에 비해 가격이 높은지는 지표 몇 가지로 나눠서 살펴봐요.',
            'PER은 주가가 한 해 이익의 몇 배인지 보여 줘요. 비슷한 종목과 견줘서 높은지 낮은지 설명해요.',
            '매출이 작년보다 얼마나 늘었는지도 보면 성장 속도를 가늠할 수 있어요.',
            '애널리스트 목표가 평균이 지금 가격보다 높은지 낮은지도 참고해요.',
            '다음 실적 발표 날짜가 가까우면, 그 결과가 중요하다는 점도 짚어 둬요.',
        ],
        ['시세', '기업 정보', '뉴스'],
        '가장 최근 시세'
    ),
    scenario(
        'market',
        '이번 주 미국 시장 뉴스 중요한 것만',
        [
            tool('시장 동향', 'S&P 500, 나스닥', 700),
            tool('경제 지표', 'CPI, FOMC', 760),
            tool('뉴스', '미국 시장', 900),
        ],
        [
            '이번 주 미국 시장은 볼 만한 것만 추려서 정리할게요.',
            '연준의 금리 결정과 앞으로 금리를 내릴지에 대한 전망을 먼저 봐요.',
            '소비자물가(CPI)가 예상보다 낮으면 보통 시장에 반가운 소식이에요. 그날 시장 반응도 함께 봐요.',
            '업종별로 어디가 많이 오르고 내렸는지도 비교해요.',
            '마지막에는 한 주 동안 주요 지수가 어땠는지 정리해요.',
        ],
        ['시장 동향', '경제 지표', '뉴스'],
        '이번 주'
    ),
];

/**
 * Hard-coded Korean copy for `/lp/stock-chat`. Ad-only page: Korean only, no
 * crypto wording (`__tests__/lpCopyRules.ts` checks the rendered page).
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
        body: '답하기 전에 최신 시세와 차트를 직접 찾아봅니다.',
    },
    {
        Icon: LayersIcon,
        title: '지표는 규칙으로 계산',
        body: 'RSI, 이동평균 같은 지표는 AI가 짐작하지 않고 정해진 규칙으로 계산합니다.',
    },
    {
        Icon: SparkIcon,
        title: '답변마다 출처와 기준 시각',
        body: '어떤 데이터를 언제 기준으로 봤는지 답변과 함께 보여 줍니다.',
    },
];

/** The worked example the question-to-answer flow is drawn around. */
export const HOW_DEMO: HowDemo = {
    question: '엔비디아 지금 비싼 편이야?',
    answer: '이익에 비하면 비싼 편이에요. 다만 이익이 빠르게 늘고 있어서 보는 사람마다 판단이 갈려요.',
    chips: ['시세', '기업 정보', '기준 2026-09-18'],
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

/** One example conversation; the summary names the lookups and their total time. */
function scenario(
    id: string,
    question: string,
    tools: readonly ReplayTool[],
    lines: readonly string[],
    sources: readonly string[],
    time: string
): ReplayScenario {
    const seconds = (tools.reduce((sum, x) => sum + x.ms, 0) / 1000).toFixed(1);
    return {
        id,
        question,
        tools,
        lines: toReplayLines(lines),
        summary: `${tools.map(x => x.label).join(', ')} 확인, ${seconds}초`,
        sources,
        asOf: `기준 ${time}`,
    };
}

/**
 * `ai.siglens.io/about`'s example conversations (`views.ai-about` in
 * `messages/ko.json`), minus the coin one and with the middle dots spelled out.
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
            '삼성전자는 9월 18일 <b>71,800원</b>에 마감했어요. 전날보다 <up>+1.3%</up> 올랐어요.',
            '최근 20일 평균 가격(69,950원)보다는 높고, 60일 평균(72,400원)보다는 아직 낮아요. 짧게 보면 오르는 중이고, 길게 보면 아직 회복 전이에요.',
            '너무 많이 올랐는지 보는 RSI 지표는 <b>54</b>예요. 과열도 침체도 아닌 보통 수준이에요.',
            '오르고 내리는 힘을 보는 MACD 지표는 9월 12일에 신호선을 위로 넘었어요. 오르는 힘이 붙기 시작했다는 뜻이에요.',
            '시그렌즈 분석에서는 <b>72,400원</b>을 넘는지가 다음에 볼 지점이라고 했어요.',
        ],
        ['시세', '차트와 지표', '시그렌즈 분석'],
        '2026-09-18 종가'
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
            '이익에 비하면 비싼 편이에요. 다만 이익이 빠르게 늘고 있어서 보는 사람마다 판단이 갈려요.',
            '주가가 1년 이익의 몇 배인지 보는 PER은 <b>45배</b>예요. 미국 대형 기술주 평균(약 30배)보다 높아요.',
            '매출은 1년 전보다 <up>+56%</up> 늘었어요.',
            '애널리스트 목표가 평균은 <b>210달러</b>로, 지금 가격(182달러)보다 높게 잡혀 있어요.',
            '다음 실적 발표는 11월 19일이에요. 그때 이익이 기대만큼 나오는지가 중요해요.',
        ],
        ['시세', '기업 정보', '뉴스 12건'],
        '2026-09-18 16:00 (미국 동부)'
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
            '이번 주 미국 시장에서 볼 만한 건 세 가지예요.',
            '연준이 금리를 동결했어요. 올해 남은 인하 전망은 한 번으로 줄었어요.',
            '8월 소비자물가 상승률(CPI)은 <b>2.9%</b>로 예상(3.0%)보다 낮았고, 그날 나스닥은 <up>+1.1%</up> 올랐어요.',
            '반도체 업종이 한 주 동안 <up>+3.4%</up> 올라 11개 업종 중 가장 많이 올랐어요.',
            '한 주 동안 S&P 500은 <up>+0.8%</up>, 나스닥은 <up>+1.6%</up> 올랐어요.',
        ],
        ['시장 동향', '경제 지표', '뉴스 40건'],
        '2026-09-19 09:00'
    ),
];

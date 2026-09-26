import type { ComponentType } from 'react';
import { AI_SITE_URL } from '@/shared/config/aiHost';
import { cn } from '@/shared/lib/cn';
import {
    parseReplayLine,
    type ReplayScenario,
    type ReplayTool,
} from '@/shared/lib/replay/replayScript';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import {
    CheckIcon,
    LayersIcon,
    QuoteIcon,
    SiglensMark,
    SparkIcon,
} from '@/widgets/agent-chat';
import { LpChatReplay } from './ui/LpChatReplay';
import { LP_PRIMARY_BUTTON, LpDisclaimer, LpShell } from './ui/LpShell';

const CTA = 'AI에게 물어보기';
const CTA_HREF = `${AI_SITE_URL}/`;

/** `AiAboutPage`'s centred section heading and sub-line. */
const SECTION_TITLE = cn(
    HEADING_SECTION,
    'text-center text-2xl sm:text-[28px]'
);
const SECTION_SUB =
    'mx-auto mt-2 max-w-xl text-center text-[15px] leading-6 text-secondary-400';

const EXAMPLES = [
    '삼성전자 요즘 어때?',
    '엔비디아 지금 비싼 편?',
    '이번 주 미국 시장 뉴스 중요한 것만',
] as const;

interface How {
    readonly Icon: ComponentType<{ className?: string }>;
    readonly title: string;
    readonly body: string;
}

const HOW: readonly How[] = [
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

const FAQ = [
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
] as const;

const tool = (label: string, subject: string, ms: number): ReplayTool => ({
    label,
    pendingLabel: `${label} 확인 중`,
    subject,
    ms,
});

function scenario(
    id: string,
    question: string,
    tools: ReplayTool[],
    lines: readonly string[],
    sources: string[],
    time: string
): ReplayScenario {
    const seconds = (tools.reduce((sum, x) => sum + x.ms, 0) / 1000).toFixed(1);
    return {
        id,
        question,
        tools,
        lines: lines.map((raw, i) =>
            parseReplayLine(i === 0 || i === lines.length - 1 ? 'p' : 'li', raw)
        ),
        summary: `${tools.map(x => x.label).join(', ')} 확인, ${seconds}초`,
        sources,
        asOf: `기준 ${time}`,
    };
}

/**
 * `ai.siglens.io/about`'s example conversations (`views.ai-about` in
 * `messages/ko.json`), minus the coin one and with the middle dots spelled out.
 */
const SCENARIOS: readonly ReplayScenario[] = [
    scenario(
        'samsung',
        '삼성전자 요즘 흐름 어때?',
        [
            tool('종목 검색', '삼성전자 → 005930', 520),
            tool('시세', '005930', 640),
            tool('차트와 지표', '005930', 1100),
            tool('SIGLENS 분석', '005930', 780),
        ],
        [
            '삼성전자는 9월 18일 <b>71,800원</b>에 마감했어요. 전날보다 <up>+1.3%</up> 올랐어요.',
            '최근 20일 평균 가격(69,950원)보다는 높고, 60일 평균(72,400원)보다는 아직 낮아요. 짧게 보면 오르는 중이고, 길게 보면 아직 회복 전이에요.',
            '너무 많이 올랐는지 보는 RSI 지표는 <b>54</b>예요. 과열도 침체도 아닌 보통 수준이에요.',
            '오르고 내리는 힘을 보는 MACD 지표는 9월 12일에 신호선을 위로 넘었어요. 오르는 힘이 붙기 시작했다는 뜻이에요.',
            'SIGLENS 분석에서는 <b>72,400원</b>을 넘는지가 다음에 볼 지점이라고 했어요.',
        ],
        ['시세', '차트와 지표', 'SIGLENS 분석'],
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

/** `AiAboutPage`'s down arrow between the question, the lookups and the answer. */
const Arrow = () => (
    <span
        aria-hidden="true"
        className="relative h-6 w-0.5 bg-secondary-600 after:absolute after:-bottom-px after:-left-1 after:border-x-[5px] after:border-t-[7px] after:border-x-transparent after:border-t-secondary-600"
    />
);

/**
 * `ai.siglens.io/lp/stock-chat`: ad-only landing for the `챗GPT 제미나이 주식`
 * ad group, in `ai.siglens.io/about`'s visual language (chart-paper grid glow,
 * the SIGLENS mark, the auto-playing chat replay, the question-to-answer flow,
 * the disclosure FAQ). Korean-only hard-coded copy with no crypto wording (spec
 * `docs/superpowers/specs/2026-09-26-ad-landing-pages-design.md`).
 */
export function StockChatLanding() {
    return (
        <LpShell selfHref="/lp/stock-chat" cta={CTA} ctaHref={CTA_HREF}>
            {/* `AiAboutPage`'s chart-paper grid and glow, positioned against the shell's `<main>`. */}
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[28rem] bg-[linear-gradient(to_right,var(--color-secondary-700)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-secondary-700)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_60%_70%_at_50%_0%,black,transparent)] bg-[size:44px_44px] opacity-50"
            />
            <div className="mx-auto max-w-4xl">
                <section className="flex flex-col items-center pt-12 pb-8 text-center sm:pt-16">
                    <SiglensMark size="lg" className="mb-5" />
                    <h1 className="text-3xl font-semibold tracking-tight text-balance text-secondary-50 sm:text-5xl">
                        주식 전용 AI 챗봇
                    </h1>
                    <p className="mt-4 max-w-xl text-base leading-7 text-pretty text-secondary-300">
                        시세와 차트를 직접 조회하고 출처와 기준 시각을 함께
                        알려줘요.
                    </p>
                    <a
                        href={CTA_HREF}
                        className={cn(LP_PRIMARY_BUTTON, 'mt-6')}
                    >
                        {CTA}
                    </a>
                </section>

                <div className="motion-safe:animate-[fade-up_400ms_ease-out_both]">
                    <LpChatReplay
                        scenarios={SCENARIOS}
                        avatar={<SiglensMark />}
                        doneIcon={
                            <CheckIcon className="size-3.5 text-ui-success-text" />
                        }
                    />
                    <p className="mx-auto mt-2 max-w-3xl text-xs text-secondary-400">
                        예시 대화예요. 수치는 실제와 다를 수 있어요.
                    </p>
                </div>

                <section aria-labelledby="lp-examples" className="mt-20">
                    <h2 id="lp-examples" className={SECTION_TITLE}>
                        이렇게 물어보세요
                    </h2>
                    <p className={SECTION_SUB}>
                        평소 말투 그대로, 종목 이름으로 물어보면 됩니다.
                    </p>
                    <ul className="mt-7 flex flex-col items-center gap-3">
                        {EXAMPLES.map(q => (
                            <li
                                key={q}
                                className="max-w-sm rounded-lg border border-secondary-700 bg-secondary-900 px-4 py-2.5 text-sm text-secondary-100"
                            >
                                {q}
                            </li>
                        ))}
                    </ul>
                </section>

                <section aria-labelledby="lp-how" className="mt-20">
                    <h2 id="lp-how" className={SECTION_TITLE}>
                        이렇게 답해요
                    </h2>
                    <p className={SECTION_SUB}>
                        답하기 전에 데이터를 직접 찾아보고, 무엇을 봤는지 함께
                        보여 줍니다.
                    </p>
                    <div className="mt-8 flex flex-col items-center gap-3">
                        <p className="max-w-sm rounded-lg border border-secondary-700 bg-secondary-900 px-4 py-2.5 text-sm text-secondary-100">
                            엔비디아 지금 비싼 편이야?
                        </p>
                        <Arrow />
                        <ul className="grid w-full gap-3 sm:grid-cols-3">
                            {HOW.map(({ Icon, title, body }) => (
                                <li
                                    key={title}
                                    className={cn(SURFACE_CARD, 'p-4 sm:p-5')}
                                >
                                    <span className="flex size-10 items-center justify-center rounded-lg bg-secondary-700/40 text-secondary-200">
                                        <Icon className="size-5" />
                                    </span>
                                    <h3 className="mt-3 text-base font-semibold text-secondary-50">
                                        {title}
                                    </h3>
                                    <p className="mt-1 text-sm leading-6 text-secondary-300">
                                        {body}
                                    </p>
                                </li>
                            ))}
                        </ul>
                        <Arrow />
                        <div className="max-w-sm rounded-lg border border-secondary-600 bg-secondary-800 px-4 py-3 text-sm leading-6 text-secondary-200">
                            이익에 비하면 비싼 편이에요. 다만 이익이 빠르게 늘고
                            있어서 보는 사람마다 판단이 갈려요.
                            <p className="mt-2 flex flex-wrap gap-1 text-xs">
                                {['시세', '기업 정보', '기준 2026-09-18'].map(
                                    label => (
                                        <span
                                            key={label}
                                            className="rounded bg-secondary-700/40 px-1.5 py-0.5 text-secondary-300"
                                        >
                                            {label}
                                        </span>
                                    )
                                )}
                            </p>
                        </div>
                    </div>
                </section>

                <section aria-labelledby="lp-faq" className="mt-20">
                    <h2 id="lp-faq" className={SECTION_TITLE}>
                        자주 묻는 질문
                    </h2>
                    <div className="mt-6 divide-y divide-secondary-700 border-y border-secondary-700">
                        {FAQ.map(({ q, a }) => (
                            <details key={q} className="group">
                                <summary className="flex min-h-13 cursor-pointer list-none items-center justify-between gap-3 rounded text-[15px] font-medium text-secondary-100 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                                    {q}
                                    <span
                                        aria-hidden="true"
                                        className="text-lg text-secondary-400 transition-transform group-open:rotate-45 motion-reduce:transition-none"
                                    >
                                        +
                                    </span>
                                </summary>
                                <p className="max-w-2xl pb-4 text-sm leading-6 text-secondary-300">
                                    {a}
                                </p>
                            </details>
                        ))}
                    </div>
                </section>

                <section
                    aria-labelledby="lp-end"
                    className={cn(SURFACE_CARD, 'mt-20 px-6 py-9 text-center')}
                >
                    <h2 id="lp-end" className={HEADING_SECTION}>
                        지금 궁금한 종목을 물어보세요
                    </h2>
                    <p className="mt-2 text-sm text-secondary-400">
                        시세와 차트를 확인하고 출처와 함께 답해 드려요.
                    </p>
                    <a
                        href={CTA_HREF}
                        className={cn(LP_PRIMARY_BUTTON, 'mt-5')}
                    >
                        {CTA}
                    </a>
                </section>

                <LpDisclaimer />
            </div>
        </LpShell>
    );
}

import type { ComponentType } from 'react';
import { cn } from '@/shared/lib/cn';
import {
    parseReplayLine,
    type ReplayScenario,
    type ReplayTool,
} from '@/shared/lib/replay/replayScript';
import { SITE_HOST, SITE_URL } from '@/shared/lib/seo';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import {
    CheckIcon,
    GaugeIcon,
    LayersIcon,
    OptionsIcon,
    QuoteIcon,
} from '@/shared/ui/StrokeIcons';
import { LP_PRIMARY_BUTTON, LpDisclaimer, LpShell } from './ui/LpShell';
import { LpReportReplay } from './ui/LpReportReplay';

const CTA = '종목 분석 시작';
const CTA_HREF = `${SITE_URL}/NVDA`;

/** `AboutPage`'s section heading and sub-line. */
const SECTION_TITLE = cn(HEADING_SECTION, 'text-2xl sm:text-[28px]');
const SECTION_SUB = 'mt-2 max-w-2xl text-[15px] leading-6 text-secondary-400';

const TEXT_LINK =
    'rounded text-secondary-300 underline underline-offset-2 hover:text-primary-400 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';

interface Feature {
    readonly Icon: ComponentType<{ className?: string }>;
    readonly title: string;
    readonly scope: string;
    readonly body: string;
    /** A real symbol tab that shows this data, so the card is also a way in. */
    readonly href: string;
    readonly example: string;
}

const FEATURES: readonly Feature[] = [
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

/** Company name first, ticker second (the ticker is the secondary label). */
const POPULAR = [
    ['엔비디아', 'NVDA'],
    ['애플', 'AAPL'],
    ['테슬라', 'TSLA'],
    ['삼성전자', '005930.KS'],
    ['SK하이닉스', '000660.KS'],
] as const;

const step = (
    label: string,
    pendingLabel: string,
    subject: string,
    ms: number
): ReplayTool => ({ label, pendingLabel, subject, ms });

const BARS = step('시세와 차트', '시세와 차트 불러오는 중', '일봉', 520);
const INDICATORS = step('보조지표', '보조지표 계산하는 중', '', 760);
const PATTERNS = step('캔들과 차트 패턴', '패턴 찾는 중', '', 640);
const REPORT = step('AI 리포트', 'AI가 정리하는 중', '', 1100);
const fundamentals = (code: string) =>
    step('재무와 뉴스', '재무와 뉴스 확인하는 중', code, 820);

function scenario(
    id: string,
    symbol: string,
    tools: ReplayTool[],
    lines: readonly string[],
    time: string
): ReplayScenario {
    return {
        id,
        question: symbol,
        tools,
        lines: lines.map((raw, i) =>
            parseReplayLine(i === 0 || i === lines.length - 1 ? 'p' : 'li', raw)
        ),
        summary: `${tools.length}단계를 거쳐 분석했어요`,
        sources: tools.filter(x => x !== REPORT).map(x => x.label),
        asOf: `${time} 기준`,
    };
}

/**
 * `siglens.io/about`'s example reports (`views.about.replay` in
 * `messages/ko.json`), minus the coin one and with the middle dots spelled out.
 */
const SCENARIOS: readonly ReplayScenario[] = [
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

/**
 * `siglens.io/lp/stock-analysis`: ad-only landing for the `AI 주식 분석` ad
 * group, in `siglens.io/about`'s visual language (left-aligned hero with an
 * eyebrow, the auto-playing address-bar replay, icon data tiles, the closing
 * CTA card). Korean-only hard-coded copy with no crypto wording (spec
 * `docs/superpowers/specs/2026-09-26-ad-landing-pages-design.md`).
 */
export function StockAnalysisLanding() {
    return (
        <LpShell selfHref="/lp/stock-analysis" cta={CTA} ctaHref={CTA_HREF}>
            <div className="mx-auto max-w-4xl">
                <section className="pt-12 pb-10 sm:pt-16">
                    <p className="text-sm font-medium text-secondary-400">
                        AI 주식 분석
                    </p>
                    <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance text-secondary-50 sm:text-[42px] sm:leading-tight">
                        종목 하나로 AI 종합 분석
                    </h1>
                    <p className="mt-4 max-w-2xl text-base leading-7 text-pretty text-secondary-300">
                        미국 주식과 한국 주식의 차트, 재무, 뉴스, 옵션을 모아
                        AI가 정리합니다.
                    </p>
                    <a
                        href={CTA_HREF}
                        className={cn(LP_PRIMARY_BUTTON, 'mt-6')}
                    >
                        {CTA}
                    </a>
                </section>

                <section
                    aria-labelledby="lp-replay"
                    className="motion-safe:animate-[fade-up_400ms_ease-out_both]"
                >
                    <h2 id="lp-replay" className={SECTION_TITLE}>
                        종목 하나를 열면 이렇게 분석해요
                    </h2>
                    <p className={SECTION_SUB}>
                        시세와 차트를 불러와 지표와 패턴을 계산하고, AI가 한
                        편의 리포트로 정리합니다.
                    </p>
                    <div className="mt-6">
                        <LpReportReplay
                            scenarios={SCENARIOS}
                            host={SITE_HOST}
                            doneIcon={
                                <CheckIcon className="size-3.5 text-ui-success-text" />
                            }
                        />
                    </div>
                    <p className="mt-2 text-xs text-secondary-400">
                        예시 화면이에요. 수치는 실제와 다를 수 있어요.
                    </p>
                </section>

                <section aria-labelledby="lp-features" className="mt-20">
                    <h2 id="lp-features" className={SECTION_TITLE}>
                        한 화면에서 보는 종목 분석
                    </h2>
                    <ul className="mt-7 grid gap-3 sm:grid-cols-2">
                        {FEATURES.map(
                            ({ Icon, title, scope, body, href, example }) => (
                                <li
                                    key={title}
                                    className={cn(
                                        SURFACE_CARD,
                                        'grid grid-cols-[2.5rem_minmax(0,1fr)] grid-rows-[auto_1fr_auto] gap-x-3.5 gap-y-1 p-4 sm:p-5'
                                    )}
                                >
                                    <span className="row-span-3 flex size-10 items-center justify-center rounded-lg bg-secondary-700/40 text-secondary-200">
                                        <Icon className="size-5" />
                                    </span>
                                    <h3 className="flex flex-wrap items-baseline gap-x-2 text-base font-semibold text-secondary-50">
                                        {title}
                                        <span className="text-xs font-normal text-secondary-400">
                                            {scope}
                                        </span>
                                    </h3>
                                    <p className="text-sm leading-6 text-secondary-300">
                                        {body}
                                    </p>
                                    <a
                                        href={`${SITE_URL}${href}`}
                                        className={cn(
                                            TEXT_LINK,
                                            'mt-1 inline-flex min-h-8 w-fit items-center text-xs'
                                        )}
                                    >
                                        {example}
                                    </a>
                                </li>
                            )
                        )}
                    </ul>
                </section>

                <section aria-labelledby="lp-popular" className="mt-20">
                    <h2 id="lp-popular" className={SECTION_TITLE}>
                        많이 찾는 종목
                    </h2>
                    <ul className="mt-7 flex flex-wrap gap-3">
                        {POPULAR.map(([name, symbol]) => (
                            <li key={symbol}>
                                <a
                                    href={`${SITE_URL}/${symbol}`}
                                    // Outline control: its border must pass 3:1, so
                                    // `border-control`, not the card's decorative border.
                                    className="flex min-h-11 items-center gap-2 rounded-lg border border-border-control bg-secondary-800 px-4 text-sm transition-colors hover:border-primary-500 hover:bg-secondary-700/40 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none active:bg-secondary-700/60 motion-reduce:transition-none"
                                >
                                    <span className="font-semibold text-secondary-100">
                                        {name}
                                    </span>
                                    <span
                                        className="font-mono text-xs text-secondary-400"
                                        translate="no"
                                    >
                                        {symbol}
                                    </span>
                                </a>
                            </li>
                        ))}
                    </ul>
                </section>

                <section
                    aria-labelledby="lp-end"
                    className={cn(SURFACE_CARD, 'mt-20 px-6 py-9 text-center')}
                >
                    <h2 id="lp-end" className={HEADING_SECTION}>
                        궁금한 종목을 바로 열어 보세요
                    </h2>
                    <p className="mt-2 text-sm text-secondary-400">
                        종목 페이지에서 차트, 재무, 뉴스, 옵션과 AI 리포트를
                        함께 볼 수 있어요.
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

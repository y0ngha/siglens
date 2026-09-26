import { cn } from '@/shared/lib/cn';
import { SITE_URL } from '@/shared/lib/seo';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { LP_PRIMARY_BUTTON, LpDisclaimer, LpShell } from './ui/LpShell';

const CTA = '종목 분석 시작';
const CTA_HREF = `${SITE_URL}/NVDA`;

const FEATURES = [
    {
        title: '차트 지표 AI 해석',
        body: 'RSI, MACD, 볼린저밴드 같은 보조지표를 AI가 읽고 지금 차트가 어떤 상태인지 풀어 줍니다.',
    },
    {
        title: '지지선과 저항선 정리',
        body: '가격이 자주 멈추고 되돌아선 구간을 모아 지금 주목할 가격대를 정리합니다.',
    },
    {
        title: '공포탐욕지수',
        body: '미국과 한국 시장의 투자 심리를 하나의 지수로 보여 줍니다.',
    },
    {
        title: '옵션과 재무, 뉴스',
        body: '옵션 흐름, 재무제표, 최신 뉴스를 종목 하나에서 함께 확인합니다.',
    },
] as const;

const TICKERS = [
    ['NVDA', '엔비디아'],
    ['AAPL', '애플'],
    ['TSLA', '테슬라'],
    ['005930.KS', '삼성전자'],
    ['000660.KS', 'SK하이닉스'],
] as const;

/**
 * `siglens.io/lp/stock-analysis`: ad-only landing for the `AI 주식 분석` ad
 * group. Korean-only hard-coded copy with no crypto wording (spec
 * `docs/superpowers/specs/2026-09-26-ad-landing-pages-design.md`).
 */
export function StockAnalysisLanding() {
    return (
        <LpShell selfHref="/lp/stock-analysis" cta={CTA} ctaHref={CTA_HREF}>
            <section className="flex flex-col items-center pt-14 pb-10 text-center sm:pt-20">
                <h1 className="text-3xl font-semibold tracking-tight text-balance text-secondary-50 sm:text-5xl">
                    티커 하나로 AI 종합 분석
                </h1>
                <p className="mt-4 max-w-xl text-base leading-7 text-pretty text-secondary-300">
                    미국 주식과 한국 주식의 차트, 재무, 뉴스, 옵션을 모아 AI가
                    정리합니다.
                </p>
                <a href={CTA_HREF} className={cn(LP_PRIMARY_BUTTON, 'mt-6')}>
                    {CTA}
                </a>
            </section>

            <section aria-labelledby="lp-features" className="mt-6">
                <h2
                    id="lp-features"
                    className={cn(HEADING_SECTION, 'text-center text-2xl')}
                >
                    한 화면에서 보는 종목 분석
                </h2>
                <ul className="mt-6 grid gap-4 sm:grid-cols-2">
                    {FEATURES.map(({ title, body }) => (
                        <li key={title} className={cn(SURFACE_CARD, 'p-5')}>
                            <h3 className="text-base font-semibold text-secondary-100">
                                {title}
                            </h3>
                            <p className="mt-2 text-sm leading-6 text-secondary-400">
                                {body}
                            </p>
                        </li>
                    ))}
                </ul>
            </section>

            <section aria-labelledby="lp-tickers" className="mt-14">
                <h2
                    id="lp-tickers"
                    className={cn(HEADING_SECTION, 'text-center text-2xl')}
                >
                    많이 찾는 종목
                </h2>
                <ul className="mt-6 flex flex-wrap justify-center gap-3">
                    {TICKERS.map(([symbol, name]) => (
                        <li key={symbol}>
                            <a
                                href={`${SITE_URL}/${symbol}`}
                                // Outline control: its border must pass 3:1, so
                                // `border-control`, not the card's decorative border.
                                className="flex min-h-11 items-center gap-2 rounded-lg border border-border-control bg-secondary-800 px-4 text-sm transition-colors hover:border-primary-500"
                            >
                                <span className="font-mono font-semibold text-secondary-100">
                                    {symbol}
                                </span>
                                <span className="text-secondary-400">
                                    {name}
                                </span>
                            </a>
                        </li>
                    ))}
                </ul>
            </section>

            <LpDisclaimer />
        </LpShell>
    );
}

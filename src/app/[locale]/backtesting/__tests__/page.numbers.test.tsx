vi.mock('@/shared/lib/seo', async importOriginal => ({
    ...(await importOriginal<typeof import('@/shared/lib/seo')>()),
    backtestingDescription: () => 'test desc',
    backtestingTitle: () => 'AI 백테스팅',
    BACKTESTING_KEYWORDS: ['backtest'],
    BACKTESTING_URL: 'https://siglens.io/backtesting',
    buildWebPageJsonLd: () => ({}),
    buildBreadcrumbJsonLd: vi.fn().mockReturnValue({}),
    SITE_BUILD_DATE: new Date('2025-01-01'),
    SITE_URL: 'https://siglens.io',
}));
vi.mock('@/shared/lib/og', () => ({
    OG_IMAGE_WIDTH: 1200,
    OG_IMAGE_HEIGHT: 630,
}));
vi.mock('@/shared/lib/legal', () => ({
    TERMS_PATH: '/terms',
}));
vi.mock('next/navigation', () => ({
    useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
    usePathname: () => '/backtesting',
}));

// @vitest-environment jsdom
//
// The numbers on /backtesting equal the `data.json` fields they come from, and the copy
// stays inside the display rules (one period, a baseline next to every return, no claims).
//
// The expected strings are formatted here from the RAW `data.json` / `summary.json` fields with a
// local `toFixed`, not from the stats the page derives, so a page that reads the wrong field (or
// swaps two) fails. The page tree is real (no widget mocks) and rendered the way SSR renders it.
import { renderToStaticMarkup } from 'react-dom/server';
import { createQueryClientWrapper } from '@/__tests__/utils/createQueryClientWrapper';
import BacktestingPage from '@/app/[locale]/backtesting/page';
import backtestData from '@/entities/backtest-case/data/data.json';
import { IntlTestProvider } from '@/shared/test-utils/intlRenderWrapper';
import summary from '../../../../../backtest-results/2026-11-daily-ai/summary.json';

const bench = backtestData.benchmarks;

const fixed = (value: number, digits = 1) => value.toFixed(digits);
const pct = (value: number) => `${fixed(value)}%`;
const signed = (value: number, digits = 1) =>
    `${value >= 0 ? '+' : ''}${fixed(value, digits)}%`;
const share = (value: number) => pct(value * 100);

async function renderPage(): Promise<{ html: string; doc: Document }> {
    const { wrapper: QueryWrapper } = createQueryClientWrapper();
    const html = renderToStaticMarkup(
        <QueryWrapper>
            <IntlTestProvider>
                {await BacktestingPage({
                    params: Promise.resolve({ locale: 'ko' }),
                })}
            </IntlTestProvider>
        </QueryWrapper>
    );
    return { html, doc: new DOMParser().parseFromString(html, 'text/html') };
}

const textOf = (element: Element | null | undefined) =>
    (element?.textContent ?? '').replace(/\s+/g, ' ').trim();

/** 태그를 공백으로 바꿔 이웃한 칸의 숫자가 이어 붙지 않게 한다(숫자 토큰 검사용). */
const spacedText = (element: Element | null | undefined) =>
    (element?.innerHTML ?? '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const sectionText = (doc: Document, id: string) =>
    textOf(doc.querySelector(`section[aria-labelledby="${id}"]`));

const cardOf = (doc: Document, label: string) => {
    const labelEl = [...doc.querySelectorAll('header div')].find(
        el => textOf(el) === label && el.children.length === 0
    );
    return labelEl?.parentElement ?? null;
};

describe('/backtesting numbers equal data.json', () => {
    it('hero portfolio card carries both hold baselines from benchmarks', async () => {
        const { doc } = await renderPage();
        const card = cardOf(doc, '포트폴리오 수익률 (10종목 균등)');
        expect(textOf(card)).toContain(signed(summary.portfolio.returnPct));
        expect(textOf(card)).toContain(
            `같은 10종목을 계속 들고 있었다면 ${signed(bench.holdPortfolio.returnPct)}, AI 전략의 투자 비중(${pct(bench.exposureMatchedHold.exposurePct)})만큼만 들고 있었다면 ${signed(bench.exposureMatchedHold.returnPct)}`
        );
    });

    it('hero drawdown card headlines mark-to-market and lists closed and hold values', async () => {
        const { doc } = await renderPage();
        const card = cardOf(doc, '최대 낙폭 (매일 평가 기준)');
        expect(textOf(card)).toContain(
            pct(bench.strategyMarkToMarketMaxDrawdownPct)
        );
        expect(textOf(card)).toContain(
            `청산 기준 ${pct(summary.portfolio.maxDrawdownPct)}, 계속 보유 ${pct(bench.holdPortfolio.maxDrawdownPct)}`
        );
    });

    it('hero win-rate card pairs the initial-plan share with its placebo', async () => {
        const { doc } = await renderPage();
        const card = cardOf(doc, '승률');
        expect(textOf(card)).toContain(pct(summary.overall.winRate));
        expect(textOf(card)).toContain(
            `처음 세운 1차 목표가가 손절가보다 먼저 닿은 비율은 ${share(bench.bracket.initialPlan.targetFirstShare)}(${bench.bracket.initialPlan.resolvedRaces.toLocaleString('en-US')}건 중), 같은 폭의 목표가와 손절가를 임의의 날에 두면 ${share(bench.bracket.placebo.targetFirstShare)}(${bench.bracket.placebo.resolvedRaces.toLocaleString('en-US')}번 중)`
        );
        // 저장된 첫 번째 절반 익절 비율은 임의 날짜와 견줄 수 없어 화면에 싣지 않는다.
        expect(textOf(card)).not.toContain(
            share(bench.bracket.storedTargetFirstShare)
        );
    });

    it('hero mean-return card carries the same-days baseline and the difference from it', async () => {
        const { doc } = await renderPage();
        const card = cardOf(doc, '거래당 평균 수익률');
        const excess = bench.perTradeExcess;
        expect(textOf(card)).toContain(signed(summary.overall.meanRet, 2));
        expect(textOf(card)).toContain(
            `같은 종목을 기간 중 아무 날에나 사서 같은 날수만큼 들고 있었을 때의 평균(${signed(excess.baselineMeanPct, 2)})과 비교하면 거래당 평균 차이는 ${signed(excess.meanPct, 2)} (95% 범위 ${signed(excess.ci95.low, 2)}~${signed(excess.ci95.high, 2)})`
        );
    });

    it('comparison rows follow the run order and carry each baseline field', async () => {
        const { doc } = await renderPage();
        const rows = [
            ...doc.querySelectorAll(
                'section[aria-labelledby="backtest-comparison-heading"] tbody tr'
            ),
        ];
        expect(
            rows.slice(1).map(row => textOf(row.querySelector('th')))
        ).toEqual(backtestData.baselines.map(b => b.ticker));

        const cells = (row: Element) =>
            [...row.querySelectorAll('td')].map(td => textOf(td));
        expect(cells(rows[0])).toEqual([
            String(summary.overall.trades),
            pct(summary.overall.winRate),
            signed(summary.portfolio.returnPct),
            pct(bench.strategyMarkToMarketMaxDrawdownPct),
            pct(bench.exposureMatchedHold.exposurePct),
            signed(bench.holdPortfolio.returnPct),
            signed(bench.exposureMatchedHold.returnPct),
            pct(bench.holdPortfolio.maxDrawdownPct),
        ]);
        backtestData.baselines.forEach((baseline, i) => {
            const published = summary.perTicker.find(
                p => p.ticker === baseline.ticker
            );
            expect(cells(rows[i + 1])).toEqual([
                String(published?.trades),
                pct(published?.winRate ?? Number.NaN),
                signed(published?.strategyPct ?? Number.NaN),
                pct(baseline.markToMarketMaxDrawdownPct),
                pct(published?.exposurePct ?? Number.NaN),
                signed(baseline.buyHoldPct),
                signed(baseline.exposureMatchedHoldPct),
                pct(baseline.buyHoldMaxDrawdownPct),
            ]);
        });
    });

    it('timing check prints the benchmark block values', async () => {
        const { doc } = await renderPage();
        const text = sectionText(doc, 'backtest-timing-heading');
        const excess = bench.perTradeExcess;
        const random = bench.randomEntry;
        expect(text).toContain(
            `거래당 평균 차이는 ${signed(excess.meanPct, 2)}였어요 (95% 범위 ${signed(excess.ci95.low, 2)}~${signed(excess.ci95.high, 2)}, ${excess.n.toLocaleString('en-US')}건)`
        );
        expect(text).toContain(
            `${random.draws.toLocaleString('en-US')}번 돌려 보면 포트폴리오 수익률은 가운데 90%가 ${signed(random.returnPct.p5)}~${signed(random.returnPct.p95)}였고, AI 전략보다 높았던 경우는 ${share(random.shareAboveStrategyReturn)}였어요`
        );
        expect(text).toContain(
            `최대 낙폭이 AI 전략(${pct(bench.strategyMarkToMarketMaxDrawdownPct)})보다 작았던 경우는 ${share(random.shareWithSmallerDrawdown)}였어요`
        );
    });

    it('every percent on the summary sections is a data.json field', async () => {
        const { doc } = await renderPage();
        const allowed = new Set<string>();
        const add = (value: number, scale = 1) => {
            allowed.add(Math.abs(value * scale).toFixed(1));
            allowed.add(Math.abs(value * scale).toFixed(2));
        };
        const walk = (node: unknown, scale: number) => {
            if (typeof node === 'number') add(node, scale);
            else if (node !== null && typeof node === 'object') {
                Object.entries(node).forEach(([key, value]) =>
                    walk(
                        value,
                        key.toLowerCase().includes('share') ? 100 : scale
                    )
                );
            }
        };
        walk(bench, 1);
        walk(backtestData.baselines, 1);
        walk(summary.portfolio, 1);
        walk(summary.overall, 1);
        walk(
            summary.perTicker.map(
                ({ ticker, trades, winRate, strategyPct, exposurePct }) => ({
                    ticker,
                    trades,
                    winRate,
                    strategyPct,
                    exposurePct,
                })
            ),
            1
        );

        const section = (id: string) =>
            spacedText(doc.querySelector(`section[aria-labelledby="${id}"]`));
        const text = [
            spacedText(doc.querySelector('header')),
            section('backtest-comparison-heading'),
            section('backtest-timing-heading'),
        ]
            .join(' ')
            // 문구에 박힌 고정 숫자(신뢰구간 수준과 가운데 구간)는 데이터 필드가 아니다.
            .replaceAll('95% 범위', '')
            .replaceAll('가운데 90%', '');
        const tokens = text.match(/[+-]?\d[\d,]*(?:\.\d+)?%/g) ?? [];
        // 비교 표 77(11행 x 7열) + 히어로 15 + 진입 시점 8. 섹션을 못 찾아 빈 문자열을 검사하는 경우를 거른다.
        expect(tokens).toHaveLength(100);
        const unknown = tokens.filter(
            token => !allowed.has(token.replace(/^[+-]/, '').replace('%', ''))
        );
        expect(unknown).toEqual([]);
    });
});

describe('/backtesting display rules', () => {
    it('shows no period other than the full run in the return sections', async () => {
        const { doc } = await renderPage();
        const text = [
            textOf(doc.querySelector('header')),
            sectionText(doc, 'backtest-comparison-heading'),
            sectionText(doc, 'backtest-timing-heading'),
        ].join(' ');
        expect(text).not.toMatch(
            /상반기|하반기|분기|올해|연초|월간|연간|YTD|\d{4}년\s*\d{1,2}월/
        );
        // 기간은 실행 전체(월 단위 범위) 하나만 적힌다.
        expect(text).toContain('2024.11~2026.11');
    });

    it('has no claim words anywhere in the rendered page', async () => {
        const { html } = await renderPage();
        const text = html.replace(/<script[\s\S]*?<\/script>/g, '');
        expect(text).not.toMatch(
            /연환산|이겼|줄였|시장을 이|outperform|annuali[sz]ed/i
        );
    });

    it('puts a hold baseline in the same card as the portfolio return', async () => {
        const { doc } = await renderPage();
        const card = textOf(cardOf(doc, '포트폴리오 수익률 (10종목 균등)'));
        expect(card).toMatch(/계속 들고 있었다면 [+-]\d+\.\d%/);
        expect(card).toMatch(/들고 있었다면 [+-]\d+\.\d%$/);
    });

    it('puts a baseline in every hero card that prints a return', async () => {
        const { doc } = await renderPage();
        const cards = [
            ...doc.querySelectorAll('header [data-testid="stat-sub-label"]'),
        ]
            .map(sub => sub.parentElement)
            .filter(card => /^[+-]\d+\.\d+%/.test(textOf(card)));
        expect(cards).toHaveLength(3);
        cards.forEach(card => {
            const sub = textOf(
                card?.querySelector('[data-testid="stat-sub-label"]')
            );
            expect(sub).toMatch(/[+-]\d+\.\d+%/);
        });
    });

    it('puts both hold baselines in every row that has a return', async () => {
        const { doc } = await renderPage();
        const rows = [
            ...doc.querySelectorAll(
                'section[aria-labelledby="backtest-comparison-heading"] tbody tr'
            ),
        ];
        expect(rows).toHaveLength(backtestData.baselines.length + 1);
        rows.forEach(row => {
            const cells = [...row.querySelectorAll('td')].map(td => textOf(td));
            expect(cells[2]).toMatch(/^[+-]\d+\.\d%$/); // AI 전략
            expect(cells[5]).toMatch(/^[+-]\d+\.\d%$/); // 계속 보유
            expect(cells[6]).toMatch(/^[+-]\d+\.\d%$/); // 비중 맞춘 보유
            expect(cells[7]).toMatch(/^-\d+\.\d%$/); // 보유 시 최대 낙폭
        });
    });

    it('lists the tickers without sorting by return', async () => {
        const { doc } = await renderPage();
        const tickers = [
            ...doc.querySelectorAll(
                'section[aria-labelledby="backtest-comparison-heading"] tbody th'
            ),
        ]
            .slice(1)
            .map(th => textOf(th));
        const returns = backtestData.baselines.map(b => b.buyHoldPct);
        expect(tickers).toEqual(backtestData.run.tickers);
        expect(returns.toSorted((a, b) => b - a)).not.toEqual(returns);
    });

    it('renders the timing check after the comparison and before the trend section', async () => {
        const { doc } = await renderPage();
        const ids = [...doc.querySelectorAll('main section[aria-labelledby]')]
            .map(section => section.getAttribute('aria-labelledby'))
            .filter(id => id?.startsWith('backtest-'));
        expect(ids.slice(0, 3)).toEqual([
            'backtest-comparison-heading',
            'backtest-timing-heading',
            'backtest-trend-recognition-heading',
        ]);
    });
});

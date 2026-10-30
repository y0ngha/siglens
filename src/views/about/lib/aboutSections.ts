/**
 * Section data for `siglens.io/about`, resolved from the `views.about`
 * messages. Every key is a literal `t()` call so the i18n extractor sees it as
 * used; the page only lays these records out.
 */
import type { SkillCounts } from '@y0ngha/siglens-core';
import { AI_SITE_URL } from '@/shared/config/aiHost';
import { localePath, type Locale } from '@/shared/i18n/locales';
import { METHODOLOGY_PATH, SITE_OPERATOR } from '@/shared/lib/legal';
import { CORE_GITHUB_URL, GITHUB_URL } from '@/shared/lib/seo';
import {
    BuildingIcon,
    CandlesIcon,
    GaugeIcon,
    GavelIcon,
    LayersIcon,
    NewsIcon,
    OptionsIcon,
    QuoteIcon,
} from '@/shared/ui/StrokeIcons';
import type {
    AboutT,
    DataTile,
    LabelledLink,
    MethodStep,
    OperatorLink,
    PainPoint,
    SkillCountValues,
} from './types';

/** The backtesting hub, linked from the method section and the "more" nav. */
export const BACKTESTING_PATH = '/backtesting';

/** The ticker the closing call-to-action opens. */
export const END_CTA_PATH = '/AAPL';

/** Renames core's `SkillCounts` to the ICU argument names the copy uses. */
export function toSkillCountValues(counts: SkillCounts): SkillCountValues {
    return {
        indicators: counts.indicators,
        candles: counts.candlesticks,
        patterns: counts.patterns,
        strategies: counts.strategies,
    };
}

/** The five "if this sounds familiar" complaints and how SIGLENS answers each. */
export function buildPainPoints(
    t: AboutT,
    skillCounts: SkillCountValues
): readonly PainPoint[] {
    return [
        { was: t('pain.scattered'), now: t('pain.scatteredFix') },
        { was: t('pain.tooMany'), now: t('pain.tooManyFix', skillCounts) },
        { was: t('pain.madeUp'), now: t('pain.madeUpFix') },
        { was: t('pain.jargon'), now: t('pain.jargonFix') },
        { was: t('pain.markets'), now: t('pain.marketsFix') },
    ];
}

/**
 * The eight "what one ticker page covers" tiles. Each links to a real tab of
 * a ticker whose market has that tab (options and congress are US-only, so
 * those point at NVDA), which doubles as internal links into the symbol pages.
 */
export function buildDataTiles(
    t: AboutT,
    skillCounts: SkillCountValues
): readonly DataTile[] {
    const tiles = [
        {
            Icon: QuoteIcon,
            title: t('data.chart'),
            body: t('data.chartBody', skillCounts),
            scope: t('data.scopeAll'),
            href: '/BTCUSD',
            exampleName: t('example.btc'),
        },
        {
            Icon: CandlesIcon,
            title: t('data.patterns'),
            body: t('data.patternsBody', skillCounts),
            scope: t('data.scopeAll'),
            href: '/005930.KS',
            exampleName: t('example.samsung'),
        },
        {
            Icon: BuildingIcon,
            title: t('data.financials'),
            body: t('data.financialsBody'),
            scope: t('data.scopeEquity'),
            href: '/005930.KS/financials',
            exampleName: t('example.samsung'),
        },
        {
            Icon: LayersIcon,
            title: t('data.fundamental'),
            body: t('data.fundamentalBody'),
            scope: t('data.scopeEquity'),
            href: '/AAPL/fundamental',
            exampleName: t('example.aapl'),
        },
        {
            Icon: NewsIcon,
            title: t('data.news'),
            body: t('data.newsBody'),
            scope: t('data.scopeAll'),
            href: '/NVDA/news',
            exampleName: t('example.nvda'),
        },
        {
            Icon: OptionsIcon,
            title: t('data.options'),
            body: t('data.optionsBody'),
            scope: t('data.scopeUs'),
            href: '/NVDA/options',
            exampleName: t('example.nvda'),
        },
        {
            Icon: GavelIcon,
            title: t('data.congress'),
            body: t('data.congressBody'),
            scope: t('data.scopeUs'),
            href: '/NVDA/congress',
            exampleName: t('example.nvda'),
        },
        {
            Icon: GaugeIcon,
            title: t('data.fearGreed'),
            body: t('data.fearGreedBody'),
            scope: t('data.scopeAll'),
            href: '/AAPL/fear-greed',
            exampleName: t('example.aapl'),
        },
    ];
    return tiles.map(({ exampleName, ...tile }) => ({
        ...tile,
        exampleLabel: t('data.example', {
            name: exampleName,
            tab: tile.title,
        }),
    }));
}

/** The three numbered steps of "how an analysis is made". */
export function buildMethodSteps(
    t: AboutT,
    skillCounts: SkillCountValues
): readonly MethodStep[] {
    return [
        { title: t('method.step1'), body: t('method.step1Body') },
        { title: t('method.step2'), body: t('method.step2Body', skillCounts) },
        { title: t('method.step3'), body: t('method.step3Body') },
    ];
}

/** The freshness box's bullet lines: quote delay, refresh cadence, members. */
export function buildFreshnessLines(t: AboutT): readonly string[] {
    return [
        t('method.freshQuote'),
        t('method.freshRefresh'),
        t('method.freshMember'),
    ];
}

/** The freshness box's links to the methodology and backtesting pages. */
export function buildMethodLinks(t: AboutT): readonly LabelledLink[] {
    return [
        { href: METHODOLOGY_PATH, label: t('method.methodology') },
        { href: BACKTESTING_PATH, label: t('method.backtest') },
    ];
}

/** How to reach the operator and where the source lives (E-E-A-T links). */
export function buildOperatorLinks(t: AboutT): readonly OperatorLink[] {
    return [
        { href: `mailto:${SITE_OPERATOR.email}`, label: t('operator.email') },
        {
            href: SITE_OPERATOR.githubUrl,
            label: t('operator.github'),
            rel: 'me noopener',
            withGithubIcon: true,
        },
        { href: GITHUB_URL, label: t('operator.repo'), rel: 'noopener' },
        {
            href: CORE_GITHUB_URL,
            label: t('operator.coreRepo'),
            rel: 'noopener',
        },
    ];
}

/** What an analysis cannot do, listed above the disclaimer. */
export function buildLimits(t: AboutT): readonly string[] {
    return [
        t('limits.wrong'),
        t('limits.past'),
        t('limits.personal'),
        t('limits.variance'),
        t('limits.levels'),
    ];
}

/** The "more on SIGLENS" nav's site links (market and fear-greed hubs). */
export function buildMoreLinks(t: AboutT): readonly LabelledLink[] {
    return [
        { href: '/market', label: t('more.marketUs') },
        { href: '/market/kr', label: t('more.marketKr') },
        { href: '/fear-greed', label: t('more.fearGreed') },
        { href: '/fear-greed/crypto', label: t('more.fearGreedCrypto') },
        { href: BACKTESTING_PATH, label: t('more.backtesting') },
    ];
}

/** The cross-host link to the SIGLENS AI about page, in the same locale. */
export function buildAiAboutLink(t: AboutT, locale: Locale): LabelledLink {
    return {
        href: `${AI_SITE_URL}${localePath(locale, '/about')}`,
        label: t('more.ai'),
    };
}

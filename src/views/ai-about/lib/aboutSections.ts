/**
 * Copy for the static sections of `ai.siglens.io/about`, resolved from the
 * `views.ai-about` catalog into plain data the section components map over.
 * Every key is a literal `t()` call so the i18n extractor sees it as used.
 */
import type { AboutT } from './aboutContent';

/** One complaint and how SIGLENS AI answers it. */
export interface PainPoint {
    /** What answering tools used to get wrong. */
    readonly was: string;
    /** How SIGLENS AI handles it instead. */
    readonly now: string;
}

/** The data sources the page lists, one tile each. */
export type DataTileId =
    | 'quote'
    | 'chart'
    | 'analysis'
    | 'news'
    | 'options'
    | 'company'
    | 'market'
    | 'portfolio';

/** One data-source tile: what it is, what it is used for, what it covers. */
export interface DataTile {
    readonly id: DataTileId;
    readonly title: string;
    readonly body: string;
    readonly scope: string;
}

/** A link from the "more on SIGLENS" list to a siglens.io page. */
export interface MoreLink {
    readonly href: string;
    readonly label: string;
}

/** The complaints section, in display order. */
export function buildPainPoints(t: AboutT): PainPoint[] {
    return [
        { was: t('pain.stale'), now: t('pain.staleFix') },
        { was: t('pain.madeUp'), now: t('pain.madeUpFix') },
        { was: t('pain.rumor'), now: t('pain.rumorFix') },
        { was: t('pain.jargon'), now: t('pain.jargonFix') },
        { was: t('pain.chartOnly'), now: t('pain.chartOnlyFix') },
    ];
}

/** The data-source tiles, in display order. */
export function buildDataTiles(t: AboutT): DataTile[] {
    return [
        {
            id: 'quote',
            title: t('data.quote'),
            body: t('data.quoteBody'),
            scope: t('data.quoteScope'),
        },
        {
            id: 'chart',
            title: t('data.chart'),
            body: t('data.chartBody'),
            scope: t('data.chartScope'),
        },
        {
            id: 'analysis',
            title: t('data.analysis'),
            body: t('data.analysisBody'),
            scope: t('data.analysisScope'),
        },
        {
            id: 'news',
            title: t('data.news'),
            body: t('data.newsBody'),
            scope: t('data.newsScope'),
        },
        {
            id: 'options',
            title: t('data.options'),
            body: t('data.optionsBody'),
            scope: t('data.optionsScope'),
        },
        {
            id: 'company',
            title: t('data.company'),
            body: t('data.companyBody'),
            scope: t('data.companyScope'),
        },
        {
            id: 'market',
            title: t('data.market'),
            body: t('data.marketBody'),
            scope: t('data.marketScope'),
        },
        {
            id: 'portfolio',
            title: t('data.portfolio'),
            body: t('data.portfolioBody'),
            scope: t('data.portfolioScope'),
        },
    ];
}

/** The chips under the example answer: the lookups it used and its as-of time. */
export function buildExampleChips(t: AboutT): string[] {
    return [t('tool.quote'), t('tool.bars'), t('data.exampleAsOf')];
}

/**
 * The "more on SIGLENS" links. They point at siglens.io, not the ai host, so
 * each href is absolute and carries the page's locale prefix.
 *
 * @param siteUrl siglens.io origin.
 * @param localePrefix `''` for the default locale, `'/en'` otherwise.
 */
export function buildMoreLinks(
    t: AboutT,
    siteUrl: string,
    localePrefix: string
): MoreLink[] {
    return [
        { path: '/market', label: t('more.marketUs') },
        { path: '/market/kr', label: t('more.marketKr') },
        { path: '/fear-greed', label: t('more.fearGreed') },
        { path: '/fear-greed/crypto', label: t('more.fearGreedCrypto') },
        { path: '/news', label: t('more.news') },
        { path: '/about', label: t('more.about') },
    ].map(({ path, label }) => ({
        href: `${siteUrl}${localePrefix}${path}`,
        label,
    }));
}

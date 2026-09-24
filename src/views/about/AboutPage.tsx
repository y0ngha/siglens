import type { SkillCounts } from '@y0ngha/siglens-core';
import { getTranslations } from 'next-intl/server';
import type { ComponentType, ReactNode } from 'react';
import { AI_SITE_URL } from '@/shared/config/aiHost';
import { localePath, type Locale } from '@/shared/i18n/locales';
import { cn } from '@/shared/lib/cn';
import { SITE_OPERATOR, TERMS_PATH } from '@/shared/lib/legal';
import { GITHUB_URL, SITE_HOST, type FaqItem } from '@/shared/lib/seo';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { Breadcrumb } from '@/shared/ui/Breadcrumb';
import { FaqSection } from '@/shared/ui/FaqSection';
import { GithubIcon } from '@/shared/ui/GithubIcon';
import { LocaleLink } from '@/shared/ui/LocaleLink';
import {
    BuildingIcon,
    CandlesIcon,
    CheckIcon,
    GaugeIcon,
    GavelIcon,
    LayersIcon,
    NewsIcon,
    OptionsIcon,
    QuoteIcon,
} from '@/shared/ui/StrokeIcons';
import { buildReportScenarios } from './lib/aboutContent';
import { ReportReplay } from './ui/ReportReplay';

interface Props {
    readonly locale: Locale;
    /** Breadcrumb label, shared with the `BreadcrumbList` JSON-LD. */
    readonly title: string;
    readonly counts: SkillCounts;
    /**
     * The FAQ from `getAboutFaq`, built once by the route and shared with the
     * `FAQPage` JSON-LD, so the visible answers and the markup are one array.
     */
    readonly faq: readonly FaqItem[];
    /** `ABOUT_UPDATED_AT`, already formatted for the locale. */
    readonly updatedAt: string;
}

type IconComponent = ComponentType<{ className?: string }>;

interface DataTile {
    readonly Icon: IconComponent;
    readonly title: string;
    readonly body: string;
    readonly scope: string;
    /** A real ticker tab that shows this data, so the tile is also a way in. */
    readonly href: string;
    readonly exampleName: string;
}

interface MethodStep {
    readonly title: string;
    readonly body: string;
}

const PRIMARY_BUTTON =
    'inline-flex min-h-11 items-center justify-center rounded-lg bg-primary-600 px-6 text-sm font-semibold text-white transition-colors hover:bg-primary-700 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-secondary-900 focus-visible:outline-none';

const TEXT_LINK =
    'rounded text-secondary-300 underline underline-offset-2 hover:text-primary-400 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';

const SECTION_TITLE = cn(HEADING_SECTION, 'text-2xl sm:text-[28px]');

const SECTION_SUB = 'mt-2 max-w-2xl text-[15px] leading-6 text-secondary-400';

interface AboutSectionProps {
    readonly id: string;
    readonly title: string;
    readonly sub?: string;
    /** Top margin; every section but the first sits `mt-20` below the last. */
    readonly className?: string;
    readonly children: ReactNode;
}

function AboutSection({
    id,
    title,
    sub,
    className = 'mt-20',
    children,
}: AboutSectionProps) {
    return (
        <section aria-labelledby={id} className={className}>
            <h2 id={id} className={SECTION_TITLE}>
                {title}
            </h2>
            {sub ? <p className={SECTION_SUB}>{sub}</p> : null}
            {children}
        </section>
    );
}

interface PainRowProps {
    readonly was: string;
    readonly now: string;
    readonly wasLabel: string;
}

function PainRow({ was, now, wasLabel }: PainRowProps) {
    return (
        <li
            className={cn(
                SURFACE_CARD,
                'grid overflow-hidden sm:grid-cols-[2fr_3fr]'
            )}
        >
            <div className="border-b border-secondary-700 bg-secondary-900 px-4 py-3.5 sm:border-r sm:border-b-0">
                <p className="text-xs text-secondary-400">{wasLabel}</p>
                <p className="mt-1 text-[15px] leading-6 text-secondary-300">
                    {was}
                </p>
            </div>
            <div className="px-4 py-3.5">
                <p
                    className="text-xs font-semibold text-secondary-100"
                    translate="no"
                >
                    Siglens
                </p>
                <p className="mt-1 text-[15px] leading-6 text-secondary-100">
                    {now}
                </p>
            </div>
        </li>
    );
}

interface DataTileCardProps {
    readonly tile: DataTile;
    readonly exampleLabel: string;
}

function DataTileCard({ tile, exampleLabel }: DataTileCardProps) {
    const { Icon, title, body, scope, href } = tile;
    return (
        <li
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
            <p className="text-sm leading-6 text-secondary-300">{body}</p>
            <LocaleLink
                href={href}
                className={cn(
                    TEXT_LINK,
                    'mt-1 inline-flex min-h-8 w-fit items-center text-xs'
                )}
            >
                {exampleLabel}
            </LocaleLink>
        </li>
    );
}

interface MethodStepCardProps {
    readonly step: MethodStep;
    readonly number: number;
}

function MethodStepCard({ step, number }: MethodStepCardProps) {
    return (
        <li className={cn(SURFACE_CARD, 'p-4 sm:p-5')}>
            <span
                aria-hidden="true"
                className="flex size-7 items-center justify-center rounded-full border border-border-control text-xs font-semibold text-secondary-200 tabular-nums"
            >
                {number}
            </span>
            <h3 className="mt-3 text-base font-semibold text-secondary-50">
                {step.title}
            </h3>
            <p className="mt-1 text-sm leading-6 text-secondary-300">
                {step.body}
            </p>
        </li>
    );
}

interface OperatorLabels {
    readonly role: string;
    readonly body: string;
    readonly email: string;
    readonly github: string;
    readonly repo: string;
}

interface OperatorCardProps {
    readonly labels: OperatorLabels;
}

/** Who runs Siglens and how to reach them — the page's E-E-A-T anchor. */
function OperatorCard({ labels }: OperatorCardProps) {
    return (
        <div className={cn(SURFACE_CARD, 'mt-7 p-5 sm:p-6')}>
            <p className="text-base font-semibold text-secondary-50">
                <span translate="no">{SITE_OPERATOR.name}</span>
                <span className="ml-2 text-xs font-normal text-secondary-400">
                    {labels.role}
                </span>
            </p>
            <p className="mt-2 max-w-2xl text-[15px] leading-7 text-secondary-300">
                {labels.body}
            </p>
            <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                <li>
                    <a
                        href={`mailto:${SITE_OPERATOR.email}`}
                        className={cn(
                            TEXT_LINK,
                            'inline-flex min-h-10 items-center'
                        )}
                    >
                        {labels.email}
                    </a>
                </li>
                <li>
                    <a
                        href={SITE_OPERATOR.githubUrl}
                        rel="me noopener"
                        className={cn(
                            TEXT_LINK,
                            'inline-flex min-h-10 items-center gap-1.5'
                        )}
                    >
                        <GithubIcon className="size-4" />
                        {labels.github}
                    </a>
                </li>
                <li>
                    <a
                        href={GITHUB_URL}
                        rel="noopener"
                        className={cn(
                            TEXT_LINK,
                            'inline-flex min-h-10 items-center'
                        )}
                    >
                        {labels.repo}
                    </a>
                </li>
            </ul>
        </div>
    );
}

interface LimitsCardProps {
    readonly limits: readonly string[];
    readonly disclaimer: string;
    readonly termsLabel: string;
}

function LimitsCard({ limits, disclaimer, termsLabel }: LimitsCardProps) {
    return (
        <div className="mt-7 rounded-lg border border-secondary-700 px-4 py-4 sm:px-5">
            <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm leading-6 text-secondary-300 marker:text-secondary-500">
                {limits.map(line => (
                    <li key={line}>{line}</li>
                ))}
            </ul>
            <p className="mt-4 border-t border-secondary-700 pt-4 text-sm leading-6 text-secondary-200">
                {disclaimer}{' '}
                <LocaleLink href={TERMS_PATH} className={TEXT_LINK}>
                    {termsLabel}
                </LocaleLink>
            </p>
        </div>
    );
}

type AboutT = Awaited<ReturnType<typeof getTranslations>>;

type SkillCountValues = Record<
    'indicators' | 'candles' | 'patterns' | 'strategies',
    number
>;

/**
 * The eight "what one ticker page covers" tiles. Each links to a real tab of
 * a ticker whose market has that tab (options and congress are US-only, so
 * those point at NVDA), which doubles as internal links into the symbol pages.
 */
function buildDataTiles(
    t: AboutT,
    skillCounts: SkillCountValues
): readonly DataTile[] {
    return [
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
}

/**
 * `siglens.io/about`: what Siglens is, shown rather than told — an
 * auto-playing example report, the complaints it answers,
 * what one ticker page covers, how an analysis is made, who runs it, its
 * limits and the FAQ (spec
 * `docs/superpowers/specs/2026-09-24-siglens-about-redesign-design.md`).
 *
 * Everything except the replay's playback is server-rendered text, so
 * crawlers see the whole page. The operator, method, freshness, limits and
 * disclaimer sections carry the page's E-E-A-T content from the old
 * markdown version.
 */
export async function AboutPage({
    locale,
    title,
    counts,
    faq,
    updatedAt,
}: Props) {
    const t = await getTranslations({ locale, namespace: 'views.about' });
    const skillCounts: SkillCountValues = {
        indicators: counts.indicators,
        candles: counts.candlesticks,
        patterns: counts.patterns,
        strategies: counts.strategies,
    };

    const pains = [
        [t('pain.scattered'), t('pain.scatteredFix')],
        [t('pain.tooMany'), t('pain.tooManyFix', skillCounts)],
        [t('pain.madeUp'), t('pain.madeUpFix')],
        [t('pain.jargon'), t('pain.jargonFix')],
        [t('pain.markets'), t('pain.marketsFix')],
    ] as const;

    const tiles = buildDataTiles(t, skillCounts);

    const steps: readonly MethodStep[] = [
        { title: t('method.step1'), body: t('method.step1Body') },
        { title: t('method.step2'), body: t('method.step2Body', skillCounts) },
        { title: t('method.step3'), body: t('method.step3Body') },
    ];

    const limits = [
        t('limits.wrong'),
        t('limits.past'),
        t('limits.personal'),
        t('limits.variance'),
        t('limits.levels'),
    ];

    const more = [
        ['/market', t('more.marketUs')],
        ['/market/kr', t('more.marketKr')],
        ['/fear-greed', t('more.fearGreed')],
        ['/backtesting', t('more.backtesting')],
    ] as const;

    return (
        <main className="relative isolate flex-1 pb-16">
            <div className="mx-auto w-full max-w-4xl px-4 pt-6 sm:pt-8">
                <Breadcrumb trail={[{ label: title }]} />

                <section className="pb-10">
                    <p className="text-sm font-medium text-secondary-400">
                        {t('hero.eyebrow')}
                    </p>
                    <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance text-secondary-50 sm:text-[42px] sm:leading-tight">
                        {t('hero.title')}
                    </h1>
                    <p className="mt-4 max-w-2xl text-base leading-7 text-pretty text-secondary-300">
                        {t('hero.lede')}
                    </p>
                </section>

                <AboutSection
                    id="about-replay"
                    title={t('replay.title')}
                    sub={t('replay.body')}
                    className="mt-0"
                >
                    <div className="mt-6">
                        <ReportReplay
                            scenarios={buildReportScenarios(t, counts)}
                            labels={{
                                host: SITE_HOST,
                                region: t('replay.region'),
                                badge: t('replay.badge'),
                                pause: t('replay.pause'),
                                resume: t('replay.resume'),
                                sources: t('replay.sources'),
                            }}
                            doneIcon={
                                <CheckIcon className="size-3.5 text-ui-success-text" />
                            }
                        />
                    </div>
                    <p className="mt-2 text-xs text-secondary-400">
                        {t('replay.note')}
                    </p>
                </AboutSection>

                <AboutSection
                    id="about-pain"
                    title={t('pain.title')}
                    sub={t('pain.body')}
                >
                    <ul className="mt-7 flex flex-col gap-2.5">
                        {pains.map(([was, now]) => (
                            <PainRow
                                key={was}
                                was={was}
                                now={now}
                                wasLabel={t('pain.wasLabel')}
                            />
                        ))}
                    </ul>
                </AboutSection>

                <AboutSection
                    id="about-data"
                    title={t('data.title')}
                    sub={t('data.body')}
                >
                    <ul className="mt-7 grid gap-3 sm:grid-cols-2">
                        {tiles.map(tile => (
                            <DataTileCard
                                key={tile.title}
                                tile={tile}
                                exampleLabel={t('data.example', {
                                    name: tile.exampleName,
                                    tab: tile.title,
                                })}
                            />
                        ))}
                    </ul>
                </AboutSection>

                <AboutSection
                    id="about-method"
                    title={t('method.title')}
                    sub={t('method.body')}
                >
                    <ol className="mt-7 grid gap-3 sm:grid-cols-3">
                        {steps.map((step, i) => (
                            <MethodStepCard
                                key={step.title}
                                step={step}
                                number={i + 1}
                            />
                        ))}
                    </ol>
                    <div className="mt-4 rounded-lg border border-secondary-700 px-4 py-4 sm:px-5">
                        <h3 className="text-sm font-semibold text-secondary-100">
                            {t('method.freshTitle')}
                        </h3>
                        <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm leading-6 text-secondary-300 marker:text-secondary-500">
                            <li>{t('method.freshQuote')}</li>
                            <li>{t('method.freshRefresh')}</li>
                            <li>{t('method.freshMember')}</li>
                        </ul>
                        <LocaleLink
                            href="/backtesting"
                            className={cn(
                                TEXT_LINK,
                                'mt-3 inline-flex min-h-8 items-center text-sm'
                            )}
                        >
                            {t('method.backtest')}
                        </LocaleLink>
                    </div>
                </AboutSection>

                <AboutSection id="about-operator" title={t('operator.title')}>
                    <OperatorCard
                        labels={{
                            role: t('operator.role'),
                            body: t('operator.body', {
                                name: SITE_OPERATOR.name,
                            }),
                            email: t('operator.email'),
                            github: t('operator.github'),
                            repo: t('operator.repo'),
                        }}
                    />
                </AboutSection>

                <AboutSection id="about-limits" title={t('limits.title')}>
                    <LimitsCard
                        limits={limits}
                        disclaimer={t('limits.disclaimer')}
                        termsLabel={t('limits.terms')}
                    />
                </AboutSection>

                <div className="mt-20">
                    <FaqSection heading={t('faq.title')} items={faq} />
                </div>

                <nav aria-labelledby="about-more" className="mt-12">
                    <h2
                        id="about-more"
                        className="text-sm font-semibold text-secondary-300"
                    >
                        {t('more.title')}
                    </h2>
                    <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
                        {more.map(([path, label]) => (
                            <li key={path}>
                                <LocaleLink
                                    href={path}
                                    className="inline-flex min-h-10 items-center rounded text-sm text-secondary-400 underline-offset-2 hover:text-primary-400 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                                >
                                    {label}
                                </LocaleLink>
                            </li>
                        ))}
                        <li>
                            <a
                                href={`${AI_SITE_URL}${localePath(locale, '/about')}`}
                                className="inline-flex min-h-10 items-center rounded text-sm text-secondary-400 underline-offset-2 hover:text-primary-400 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                            >
                                {t('more.ai')}
                            </a>
                        </li>
                    </ul>
                </nav>

                <section
                    className={cn(SURFACE_CARD, 'mt-12 px-6 py-9 text-center')}
                >
                    <h2 className={HEADING_SECTION}>{t('end.title')}</h2>
                    <p className="mt-2 text-sm text-secondary-400">
                        {t('end.body')}
                    </p>
                    <LocaleLink
                        href="/AAPL"
                        className={cn(PRIMARY_BUTTON, 'mt-5')}
                    >
                        {t('end.button')}
                    </LocaleLink>
                </section>
                <p className="mt-6 text-center text-xs text-secondary-400">
                    {t('updated', { date: updatedAt })}
                </p>
            </div>
        </main>
    );
}

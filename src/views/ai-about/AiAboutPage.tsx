import { getTranslations } from 'next-intl/server';
import type { ComponentType } from 'react';
import { localePath, type Locale } from '@/shared/i18n/locales';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import {
    BuildingIcon,
    CandlesIcon,
    CheckIcon,
    LayersIcon,
    NewsIcon,
    OptionsIcon,
    PortfolioIcon,
    QuoteIcon,
    SiglensMark,
    SparkIcon,
} from '@/widgets/agent-chat';
import type { FaqItem } from '@/shared/lib/seo';
import { buildScenarios } from './lib/aboutContent';
import { AboutCtaBar } from './ui/AboutCtaBar';
import { ChatReplay } from './ui/ChatReplay';

interface Props {
    readonly locale: Locale;
    /** siglens.io origin, for the "more on SIGLENS" links. */
    readonly siteUrl: string;
    /** `''` for the default locale, `'/en'` otherwise. */
    readonly localePrefix: string;
    /**
     * The FAQ from `getAboutFaq`, built once by the route and shared with the
     * `FAQPage` JSON-LD, so the visible answers and the markup are one array.
     */
    readonly faq: readonly FaqItem[];
}

const PRIMARY_BUTTON =
    'inline-flex min-h-11 items-center justify-center rounded-lg bg-primary-600 px-6 text-sm font-semibold text-white transition-colors hover:bg-primary-700 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-secondary-900 focus-visible:outline-none';

const SECTION_SUB =
    'mx-auto mt-2 max-w-xl text-center text-[15px] leading-6 text-secondary-400';

type IconComponent = ComponentType<{ className?: string }>;

interface DataTile {
    readonly Icon: IconComponent;
    readonly title: string;
    readonly body: string;
    readonly scope: string;
}

const Arrow = () => (
    <span
        aria-hidden="true"
        className="relative h-6 w-0.5 bg-secondary-600 after:absolute after:-bottom-px after:-left-1 after:border-x-[5px] after:border-t-[7px] after:border-x-transparent after:border-t-secondary-600"
    />
);

/**
 * `ai.siglens.io/about`: what SIGLENS AI is, shown rather than told — an
 * auto-playing example conversation, the complaints it answers, the data it
 * looks up before answering, and the FAQ. Moved off the chat home so that page
 * can stay a place to start typing (spec
 * `docs/superpowers/specs/2026-09-19-ai-about-page-design.md`).
 *
 * Server component: every string is resolved here and the two client islands
 * (`AboutCtaBar`, `ChatReplay`) get plain props, so the ai host's client
 * message payload does not grow.
 */
export async function AiAboutPage({
    locale,
    siteUrl,
    localePrefix,
    faq,
}: Props) {
    const t = await getTranslations({ locale, namespace: 'views.ai-about' });
    const chatHref = localePath(locale, '/');

    const pains = [
        [t('pain.stale'), t('pain.staleFix')],
        [t('pain.madeUp'), t('pain.madeUpFix')],
        [t('pain.rumor'), t('pain.rumorFix')],
        [t('pain.jargon'), t('pain.jargonFix')],
        [t('pain.chartOnly'), t('pain.chartOnlyFix')],
    ] as const;

    const tiles: readonly DataTile[] = [
        {
            Icon: QuoteIcon,
            title: t('data.quote'),
            body: t('data.quoteBody'),
            scope: t('data.quoteScope'),
        },
        {
            Icon: CandlesIcon,
            title: t('data.chart'),
            body: t('data.chartBody'),
            scope: t('data.chartScope'),
        },
        {
            Icon: SparkIcon,
            title: t('data.analysis'),
            body: t('data.analysisBody'),
            scope: t('data.analysisScope'),
        },
        {
            Icon: NewsIcon,
            title: t('data.news'),
            body: t('data.newsBody'),
            scope: t('data.newsScope'),
        },
        {
            Icon: OptionsIcon,
            title: t('data.options'),
            body: t('data.optionsBody'),
            scope: t('data.optionsScope'),
        },
        {
            Icon: BuildingIcon,
            title: t('data.company'),
            body: t('data.companyBody'),
            scope: t('data.companyScope'),
        },
        {
            Icon: LayersIcon,
            title: t('data.market'),
            body: t('data.marketBody'),
            scope: t('data.marketScope'),
        },
        {
            Icon: PortfolioIcon,
            title: t('data.portfolio'),
            body: t('data.portfolioBody'),
            scope: t('data.portfolioScope'),
        },
    ];

    const more = [
        ['/market', t('more.marketUs')],
        ['/market/kr', t('more.marketKr')],
        ['/fear-greed', t('more.fearGreed')],
        ['/news', t('more.news')],
        ['/about', t('more.about')],
    ] as const;

    return (
        <>
            <AboutCtaBar
                title={t('cta.title')}
                cta={t('cta.button')}
                href={chatHref}
            />
            <main className="relative isolate flex-1 px-4 pb-16">
                {/* The chat home's chart-paper grid and glow, so the two pages read as one product. */}
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[28rem] bg-[linear-gradient(to_right,var(--color-secondary-700)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-secondary-700)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_60%_70%_at_50%_0%,black,transparent)] bg-[size:44px_44px] opacity-50"
                />
                <div className="mx-auto w-full max-w-4xl">
                    <section className="flex flex-col items-center pt-12 pb-8 text-center sm:pt-16">
                        <SiglensMark size="lg" className="mb-5" />
                        <h1 className="text-3xl font-semibold tracking-tight text-balance text-secondary-50 sm:text-5xl">
                            {t('hero.title')}
                        </h1>
                        <p className="mt-4 max-w-xl text-base leading-7 text-pretty text-secondary-300">
                            {t('hero.lede')}
                        </p>
                        <a
                            href={chatHref}
                            className={cn(PRIMARY_BUTTON, 'mt-6')}
                        >
                            {t('hero.button')}
                        </a>
                    </section>

                    <ChatReplay
                        scenarios={buildScenarios(t)}
                        labels={{
                            region: t('replay.region'),
                            pause: t('replay.pause'),
                            resume: t('replay.resume'),
                            sources: t('replay.sources'),
                        }}
                        avatar={<SiglensMark />}
                        doneIcon={
                            <CheckIcon className="size-3.5 text-ui-success-text" />
                        }
                    />
                    <p className="mx-auto mt-2 max-w-3xl text-xs text-secondary-400">
                        {t('replay.note')}
                    </p>

                    <section aria-labelledby="about-pain" className="mt-20">
                        <h2
                            id="about-pain"
                            className={cn(
                                HEADING_SECTION,
                                'text-center text-2xl sm:text-[28px]'
                            )}
                        >
                            {t('pain.title')}
                        </h2>
                        <p className={SECTION_SUB}>{t('pain.body')}</p>
                        <ul className="mt-7 flex flex-col gap-2.5">
                            {pains.map(([was, now]) => (
                                <li
                                    key={was}
                                    className={cn(
                                        SURFACE_CARD,
                                        'grid overflow-hidden sm:grid-cols-[2fr_3fr]'
                                    )}
                                >
                                    <div className="border-b border-secondary-700 bg-secondary-900 px-4 py-3.5 sm:border-r sm:border-b-0">
                                        <p className="text-xs text-secondary-400">
                                            {t('pain.wasLabel')}
                                        </p>
                                        <p className="mt-1 text-[15px] leading-6 text-secondary-300">
                                            {was}
                                        </p>
                                    </div>
                                    <div className="px-4 py-3.5">
                                        <p
                                            className="text-xs font-semibold text-secondary-100"
                                            translate="no"
                                        >
                                            SIGLENS AI
                                        </p>
                                        <p className="mt-1 text-[15px] leading-6 text-secondary-100">
                                            {now}
                                        </p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </section>

                    <section aria-labelledby="about-data" className="mt-20">
                        <h2
                            id="about-data"
                            className={cn(
                                HEADING_SECTION,
                                'text-center text-2xl sm:text-[28px]'
                            )}
                        >
                            {t('data.title')}
                        </h2>
                        <p className={SECTION_SUB}>{t('data.body')}</p>
                        <div className="mt-8 flex flex-col items-center gap-3">
                            <p className="max-w-sm rounded-lg border border-secondary-700 bg-secondary-900 px-4 py-2.5 text-sm text-secondary-100">
                                {t('data.exampleQ')}
                            </p>
                            <Arrow />
                            <ul className="grid w-full gap-3 sm:grid-cols-2">
                                {tiles.map(({ Icon, title, body, scope }) => (
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
                                        <h3 className="text-base font-semibold text-secondary-50">
                                            {title}
                                        </h3>
                                        <p className="text-sm leading-6 text-secondary-300">
                                            {body}
                                        </p>
                                        <p className="mt-1 text-xs text-secondary-400">
                                            {scope}
                                        </p>
                                    </li>
                                ))}
                            </ul>
                            <Arrow />
                            <div className="max-w-sm rounded-lg border border-secondary-600 bg-secondary-800 px-4 py-3 text-sm leading-6 text-secondary-200">
                                {t('data.exampleA')}
                                <p className="mt-2 flex flex-wrap gap-1 text-xs">
                                    {[
                                        t('tool.quote'),
                                        t('tool.bars'),
                                        t('data.exampleAsOf'),
                                    ].map(label => (
                                        <span
                                            key={label}
                                            className="rounded bg-secondary-700/40 px-1.5 py-0.5 text-secondary-300"
                                        >
                                            {label}
                                        </span>
                                    ))}
                                </p>
                            </div>
                        </div>
                    </section>

                    <section aria-labelledby="about-faq" className="mt-20">
                        <h2
                            id="about-faq"
                            className={cn(
                                HEADING_SECTION,
                                'text-center text-2xl sm:text-[28px]'
                            )}
                        >
                            {t('faq.title')}
                        </h2>
                        <div className="mt-6 divide-y divide-secondary-700 border-y border-secondary-700">
                            {faq.map(({ question, answer }) => (
                                <details key={question} className="group">
                                    <summary className="flex min-h-13 cursor-pointer list-none items-center justify-between gap-3 rounded text-[15px] font-medium text-secondary-100 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                                        {question}
                                        <span
                                            aria-hidden="true"
                                            className="text-lg text-secondary-400 transition-transform group-open:rotate-45 motion-reduce:transition-none"
                                        >
                                            +
                                        </span>
                                    </summary>
                                    <p className="max-w-2xl pb-4 text-sm leading-6 text-secondary-300">
                                        {answer}
                                    </p>
                                </details>
                            ))}
                        </div>
                    </section>

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
                                    <a
                                        href={`${siteUrl}${localePrefix}${path}`}
                                        className="inline-flex min-h-10 items-center rounded text-sm text-secondary-400 underline-offset-2 hover:text-primary-400 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                                    >
                                        {label}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </nav>

                    <section
                        className={cn(
                            SURFACE_CARD,
                            'mt-12 px-6 py-9 text-center'
                        )}
                    >
                        <h2 className={HEADING_SECTION}>{t('end.title')}</h2>
                        <p className="mt-2 text-sm text-secondary-400">
                            {t('end.body')}
                        </p>
                        <a
                            href={chatHref}
                            className={cn(PRIMARY_BUTTON, 'mt-5')}
                        >
                            {t('end.button')}
                        </a>
                    </section>
                    <p className="mt-6 text-center text-xs text-secondary-400">
                        {t('disclaimer')}
                    </p>
                </div>
            </main>
        </>
    );
}

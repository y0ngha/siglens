import { getTranslations } from 'next-intl/server';
import type { GuideEntry, GuideEntrySummary } from '@/entities/guide/types';
import { localePath, type Locale } from '@/shared/i18n/locales';
import { BUTTON_OUTLINE } from '@/shared/lib/buttonStyles';
import { cn } from '@/shared/lib/cn';
import {
    GUIDE_PATH,
    guideCategoryPath,
    guideEntryPath,
} from '@/shared/lib/guidePaths';
import { extractToc } from '@/shared/lib/legal-toc';
import {
    formatKoreanDate,
    INVESTMENT_DISCLAIMER_KEY,
} from '@/shared/lib/legal';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { HEADING_SECTION, LABEL_KO } from '@/shared/lib/typographyStyles';
import { Breadcrumb } from '@/shared/ui/Breadcrumb';
import { LocaleLink } from '@/shared/ui/LocaleLink';
import { ArrowRightIcon } from '@/shared/ui/StrokeIcons';
import { AskAiFab } from '@/widgets/ask-ai-fab/AskAiFab';
import { getGuideDemo } from './demos/registry';
import {
    guideNeighbors,
    resolveRelated,
    toGuideSummary,
} from './lib/guideBrowse';
import { loadGuideCategoryCopy } from './lib/guideCopy';
import { GuideCard } from './ui/GuideCard';
import { GuideDemoChart } from './ui/GuideDemoChart';
import { GuideFaq } from './ui/GuideFaq';
import { GuideMarkdown } from './ui/GuideMarkdown';

interface GuideEntryPageProps {
    readonly locale: Locale;
    readonly entry: GuideEntry;
    /** 같은 로케일의 카탈로그 전체 — 이전·다음과 관련 항목을 찾는 데 쓴다. */
    readonly catalog: readonly GuideEntry[];
}

const RELATED_HEADING_ID = 'guide-related-heading';
const CTA_HEADING_ID = 'guide-cta-heading';

const PAGER_LINK =
    'group block h-full rounded-lg border border-border-control p-4 transition-colors hover:border-primary-500 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none motion-reduce:transition-none';

interface PagerLinkProps {
    readonly direction: 'previous' | 'next';
    readonly label: string;
    readonly target: GuideEntrySummary;
}

function PagerLink({ direction, label, target }: PagerLinkProps) {
    const isNext = direction === 'next';
    return (
        <LocaleLink
            href={guideEntryPath(target.category, target.slug)}
            prefetch={false}
            className={cn(PAGER_LINK, isNext && 'sm:text-right')}
        >
            <span
                className={cn(
                    'flex items-center gap-1.5 text-xs text-secondary-400',
                    isNext && 'sm:justify-end'
                )}
            >
                {isNext ? null : (
                    <ArrowRightIcon className="size-3.5 rotate-180" />
                )}
                {label}
                {isNext ? <ArrowRightIcon className="size-3.5" /> : null}
            </span>
            <span className="mt-1 block text-sm font-medium text-secondary-100 transition-colors group-hover:text-primary-400 motion-reduce:transition-none">
                {target.title}
            </span>
        </LocaleLink>
    );
}

/**
 * `/guide/[category]/[slug]` — 항목 한 편.
 *
 * 구성: 브레드크럼 → 제목·다른 이름·요약 → 데모 차트 → 본문 → FAQ → 관련 항목·이전/다음 → 종목 검색
 * 안내 → 투자 고지. 넓은 화면에서는 오른쪽에 본문 차례가 따라온다.
 *
 * 마크업은 크롤러가 읽는 순서 그대로다(h1 하나, 본문 h2, FAQ·관련 h2). JSON-LD는 라우트가 만든다.
 */
export async function GuideEntryPage({
    locale,
    entry,
    catalog,
}: GuideEntryPageProps) {
    const [t, tFab, tLegal, copy] = await Promise.all([
        getTranslations({ locale, namespace: 'views.guide' }),
        getTranslations({ locale, namespace: 'widgets.ask-ai-fab' }),
        getTranslations({ locale, namespace: 'shared.lib.legal' }),
        loadGuideCategoryCopy(locale),
    ]);
    const categoryLabel = copy.label[entry.category];
    const demo = getGuideDemo(entry.category, entry.slug);
    const toc = extractToc(entry.bodyMd);
    const related = resolveRelated(catalog, entry);
    const { previous, next } = guideNeighbors(catalog, entry);
    const updatedAt = formatKoreanDate(new Date(entry.updatedAt), locale);

    return (
        <main className="page-container flex flex-1 flex-col pt-8 pb-24 sm:pt-12">
            <Breadcrumb
                trail={[
                    { label: t('hubTitle'), href: GUIDE_PATH },
                    {
                        label: categoryLabel,
                        href: guideCategoryPath(entry.category),
                    },
                    { label: entry.title },
                ]}
            />

            <div className="lg:grid lg:grid-cols-[minmax(0,42rem)_15rem] lg:justify-center lg:gap-14">
                <article className="min-w-0">
                    <header>
                        <LocaleLink
                            href={guideCategoryPath(entry.category)}
                            prefetch={false}
                            className={cn(
                                LABEL_KO,
                                'tap-target rounded-sm transition-colors hover:text-primary-400 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none motion-reduce:transition-none'
                            )}
                        >
                            {categoryLabel}
                        </LocaleLink>
                        <h1 className="mt-2 text-3xl font-bold tracking-tight text-secondary-50 sm:text-4xl">
                            {entry.title}
                        </h1>
                        {entry.aliases.length > 0 ? (
                            <dl className="mt-4 flex flex-wrap items-center gap-2">
                                <dt className={LABEL_KO}>
                                    {t('aliasesLabel')}
                                </dt>
                                {entry.aliases.map(alias => (
                                    <dd
                                        key={alias}
                                        className="rounded border border-secondary-700 px-2 py-0.5 text-xs text-secondary-300"
                                    >
                                        {alias}
                                    </dd>
                                ))}
                            </dl>
                        ) : null}
                        <p className="mt-5 text-base leading-relaxed text-secondary-300 sm:text-lg">
                            {entry.summary}
                        </p>
                        <p className="mt-4 text-xs text-secondary-500">
                            <time dateTime={entry.updatedAt}>
                                {t('updatedAt', { date: updatedAt })}
                            </time>
                        </p>
                    </header>

                    {demo === null ? null : (
                        <div className="mt-8">
                            <GuideDemoChart
                                demo={demo}
                                title={entry.title}
                                caption={entry.demoCaption}
                            />
                        </div>
                    )}

                    <div className="mt-10">
                        <GuideMarkdown markdown={entry.bodyMd} />
                    </div>

                    <GuideFaq heading={t('faqHeading')} items={entry.faq} />

                    {related.length > 0 ? (
                        <section
                            aria-labelledby={RELATED_HEADING_ID}
                            className="mt-14"
                        >
                            <h2
                                id={RELATED_HEADING_ID}
                                className={HEADING_SECTION}
                            >
                                {t('relatedHeading')}
                            </h2>
                            <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                                {related.map(item => (
                                    <GuideCard
                                        key={item.slug}
                                        entry={toGuideSummary(item)}
                                        categoryLabel={
                                            copy.label[item.category]
                                        }
                                    />
                                ))}
                            </ul>
                        </section>
                    ) : null}

                    {previous !== null || next !== null ? (
                        <nav
                            aria-label={t('paginationLabel')}
                            className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2"
                        >
                            {previous !== null ? (
                                <PagerLink
                                    direction="previous"
                                    label={t('previousLabel')}
                                    target={previous}
                                />
                            ) : (
                                <span aria-hidden className="hidden sm:block" />
                            )}
                            {next !== null ? (
                                <PagerLink
                                    direction="next"
                                    label={t('nextLabel')}
                                    target={next}
                                />
                            ) : null}
                        </nav>
                    ) : null}

                    <section
                        aria-labelledby={CTA_HEADING_ID}
                        className={cn(
                            SURFACE_CARD,
                            'mt-14 flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between'
                        )}
                    >
                        <div className="max-w-md">
                            <h2 id={CTA_HEADING_ID} className={HEADING_SECTION}>
                                {t('ctaHeading')}
                            </h2>
                            <p className="mt-2 text-sm leading-relaxed text-secondary-400">
                                {t('ctaBody')}
                            </p>
                        </div>
                        <LocaleLink
                            href="/"
                            prefetch={false}
                            className={cn(
                                BUTTON_OUTLINE,
                                'min-h-11 shrink-0 px-5 text-sm'
                            )}
                        >
                            {t('ctaButton')}
                        </LocaleLink>
                    </section>

                    <p className="mt-8 text-xs leading-relaxed text-secondary-500">
                        {tLegal(INVESTMENT_DISCLAIMER_KEY)}
                    </p>
                </article>

                <aside className="hidden lg:block">
                    <div className="sticky top-24 space-y-6">
                        {toc.length > 0 ? (
                            <nav aria-label={t('tocLabel')}>
                                <p className="text-sm font-semibold text-secondary-200">
                                    {t('tocLabel')}
                                </p>
                                <ol className="mt-3 space-y-1 border-l border-secondary-700">
                                    {toc.map(item => (
                                        <li key={item.id}>
                                            <a
                                                href={`#${item.id}`}
                                                className="-ml-px block border-l border-transparent py-1.5 pl-4 text-sm text-secondary-400 transition-colors hover:border-primary-400 hover:text-primary-400 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none motion-reduce:transition-none"
                                            >
                                                {item.label}
                                            </a>
                                        </li>
                                    ))}
                                </ol>
                            </nav>
                        ) : null}
                        <LocaleLink
                            href={guideCategoryPath(entry.category)}
                            prefetch={false}
                            className="block rounded-sm text-sm text-secondary-400 transition-colors hover:text-primary-400 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none motion-reduce:transition-none"
                        >
                            {t('backToCategory', { name: categoryLabel })}
                        </LocaleLink>
                    </div>
                </aside>
            </div>

            <AskAiFab
                question={tFab('guideQuestion', { title: entry.title })}
                localePrefix={localePath(locale, '/')}
            />
        </main>
    );
}

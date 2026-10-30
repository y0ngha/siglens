/** `siglens.io/about`: the intro page view the `[locale]/about` route renders. */
import type { SkillCounts } from '@y0ngha/siglens-core';
import { getTranslations } from 'next-intl/server';
import { AI_SITE_URL } from '@/shared/config/aiHost';
import type { Locale } from '@/shared/i18n/locales';
import { brandName } from '@/shared/lib/brandName';
import { SITE_OPERATOR } from '@/shared/lib/legal';
import { SITE_HOST, type FaqItem } from '@/shared/lib/seo';
import { Breadcrumb } from '@/shared/ui/Breadcrumb';
import { FaqSection } from '@/shared/ui/FaqSection';
import { CheckIcon } from '@/shared/ui/StrokeIcons';
import type { BenchmarkRelease } from '@/entities/benchmark/types';
import { BenchmarkResultSummary } from '@/widgets/benchmark-summary/BenchmarkResultSummary';
import { ReportReplay } from '@/widgets/replay/ReportReplay';
import { buildReportScenarios } from './lib/aboutContent';
import {
    buildAiAboutLink,
    buildDataTiles,
    buildFreshnessLines,
    buildLimits,
    buildMethodLinks,
    buildMethodSteps,
    buildMoreLinks,
    buildOperatorLinks,
    buildPainPoints,
    END_CTA_PATH,
    toSkillCountValues,
} from './lib/aboutSections';
import { DataTileCard } from './ui/data/DataTileCard';
import { EndCta } from './ui/end/EndCta';
import { AboutHero } from './ui/hero/AboutHero';
import { LimitsCard } from './ui/limits/LimitsCard';
import { FreshnessCard } from './ui/method/FreshnessCard';
import { MethodStepCard } from './ui/method/MethodStepCard';
import { MoreLinksNav } from './ui/more/MoreLinksNav';
import { OperatorCard } from './ui/operator/OperatorCard';
import { PainRow } from './ui/pain/PainRow';
import { AboutSection } from './ui/shell/AboutSection';

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
    /** 공개된 벤치마크 결과. 공개 전(게이트 꺼짐)이면 null이고 요약 섹션을 그리지 않는다. */
    readonly benchmark?: BenchmarkRelease | null;
}

/**
 * `siglens.io/about`: what SIGLENS is, shown rather than told — an
 * auto-playing example report, the complaints it answers, what one ticker page
 * covers, how an analysis is made, who runs it, its limits and the FAQ.
 *
 * Everything except the replay's playback is server-rendered text, so
 * crawlers see the whole page. The operator, method, freshness, limits and
 * disclaimer sections carry the page's E-E-A-T content.
 */
export async function AboutPage({
    locale,
    title,
    counts,
    faq,
    updatedAt,
    benchmark = null,
}: Props) {
    const t = await getTranslations({ locale, namespace: 'views.about' });
    const skillCounts = toSkillCountValues(counts);

    return (
        <main className="relative isolate flex-1 pb-16">
            <div className="mx-auto w-full max-w-4xl px-4 pt-6 sm:pt-8">
                <Breadcrumb trail={[{ label: title }]} />

                <AboutHero
                    eyebrow={t('hero.eyebrow')}
                    title={t('hero.title')}
                    lede={t('hero.lede')}
                />

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
                        {buildPainPoints(t, skillCounts).map(pain => (
                            <PainRow
                                key={pain.was}
                                pain={pain}
                                wasLabel={t('pain.wasLabel')}
                                nowLabel={brandName(locale)}
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
                        {buildDataTiles(t, skillCounts).map(tile => (
                            <DataTileCard key={tile.title} tile={tile} />
                        ))}
                    </ul>
                </AboutSection>

                <AboutSection
                    id="about-method"
                    title={t('method.title')}
                    sub={t('method.body')}
                >
                    <ol className="mt-7 grid gap-3 sm:grid-cols-3">
                        {buildMethodSteps(t, skillCounts).map((step, i) => (
                            <MethodStepCard
                                key={step.title}
                                step={step}
                                number={i + 1}
                            />
                        ))}
                    </ol>
                    <FreshnessCard
                        title={t('method.freshTitle')}
                        lines={buildFreshnessLines(t)}
                        links={buildMethodLinks(t)}
                    />
                </AboutSection>

                {benchmark ? (
                    <BenchmarkResultSummary
                        release={benchmark}
                        locale={locale}
                        aiSiteUrl={AI_SITE_URL}
                    />
                ) : null}

                <AboutSection id="about-operator" title={t('operator.title')}>
                    <OperatorCard
                        jobTitle={t('operator.role')}
                        body={t('operator.body', { name: SITE_OPERATOR.name })}
                        links={buildOperatorLinks(t)}
                    />
                </AboutSection>

                <AboutSection id="about-limits" title={t('limits.title')}>
                    <LimitsCard
                        limits={buildLimits(t)}
                        disclaimer={t('limits.disclaimer')}
                        termsLabel={t('limits.terms')}
                    />
                </AboutSection>

                <div className="mt-20">
                    <FaqSection heading={t('faq.title')} items={faq} />
                </div>

                <MoreLinksNav
                    title={t('more.title')}
                    links={buildMoreLinks(t)}
                    aiLink={buildAiAboutLink(t, locale)}
                />

                <EndCta
                    title={t('end.title')}
                    body={t('end.body')}
                    buttonLabel={t('end.button')}
                    href={END_CTA_PATH}
                />
                <p className="mt-6 text-center text-xs text-secondary-400">
                    {t('updated', { date: updatedAt })}
                </p>
            </div>
        </main>
    );
}

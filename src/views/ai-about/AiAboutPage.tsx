import { getTranslations } from 'next-intl/server';
import { localePath, type Locale } from '@/shared/i18n/locales';
import { CheckIcon } from '@/shared/ui/StrokeIcons';
import { SiglensMark } from '@/widgets/agent-chat/SiglensMark';
import type { FaqItem } from '@/shared/lib/seo';
import { brandAiName } from '@/shared/lib/brandName';
import { buildScenarios } from './lib/aboutContent';
import {
    buildDataTiles,
    buildExampleChips,
    buildMoreLinks,
    buildPainPoints,
} from './lib/aboutSections';
import { AboutCtaBar } from './ui/AboutCtaBar';
import { AboutHero } from './ui/hero/AboutHero';
import { AboutPainSection } from './ui/pain/AboutPainSection';
import { AboutDataSection } from './ui/data/AboutDataSection';
import { AboutFaqSection } from './ui/faq/AboutFaqSection';
import { AboutMoreNav } from './ui/more/AboutMoreNav';
import { AboutEndCta } from './ui/end/AboutEndCta';
import { ChatReplay } from '@/widgets/replay/ChatReplay';
import { BenchmarkResultSummary } from '@/widgets/benchmark-summary/BenchmarkResultSummary';
import { AI_SITE_URL } from '@/shared/config/aiHost';
import type { BenchmarkRelease } from '@/entities/benchmark/types';

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
    /** 공개된 벤치마크 결과. 공개 전(게이트 꺼짐)이면 null이고 요약 섹션을 그리지 않는다. */
    readonly benchmark?: BenchmarkRelease | null;
}

/**
 * `ai.siglens.io/about`: what SIGLENS AI is, shown rather than told — an
 * auto-playing example conversation, the complaints it answers, the data it
 * looks up before answering, and the FAQ. It lives apart from the chat home so
 * that page stays a place to start typing.
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
    benchmark = null,
}: Props) {
    const t = await getTranslations({ locale, namespace: 'views.ai-about' });
    const chatHref = localePath(locale, '/');

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
                    <AboutHero
                        title={t('hero.title')}
                        lede={t('hero.lede')}
                        button={t('hero.button')}
                        href={chatHref}
                    />

                    <ChatReplay
                        scenarios={buildScenarios(t, locale)}
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

                    <AboutPainSection
                        title={t('pain.title')}
                        body={t('pain.body')}
                        wasLabel={t('pain.wasLabel')}
                        brandName={brandAiName(locale)}
                        points={buildPainPoints(t)}
                    />

                    <AboutDataSection
                        title={t('data.title')}
                        body={t('data.body')}
                        question={t('data.exampleQ')}
                        answer={t('data.exampleA')}
                        chips={buildExampleChips(t)}
                        tiles={buildDataTiles(t)}
                    />

                    {benchmark ? (
                        <BenchmarkResultSummary
                            release={benchmark}
                            locale={locale}
                            aiSiteUrl={AI_SITE_URL}
                            centered
                        />
                    ) : null}

                    <AboutFaqSection title={t('faq.title')} items={faq} />

                    <AboutMoreNav
                        title={t('more.title')}
                        links={buildMoreLinks(t, siteUrl, localePrefix)}
                    />

                    <AboutEndCta
                        title={t('end.title')}
                        body={t('end.body')}
                        button={t('end.button')}
                        href={chatHref}
                    />
                    <p className="mt-6 text-center text-xs text-secondary-400">
                        {t('disclaimer')}
                    </p>
                </div>
            </main>
        </>
    );
}

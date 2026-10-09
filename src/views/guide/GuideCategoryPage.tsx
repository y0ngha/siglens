import { getTranslations } from 'next-intl/server';
import {
    GUIDE_CATEGORIES,
    type GuideCategory,
    type GuideEntrySummary,
} from '@/entities/guide/types';
import type { Locale } from '@/shared/i18n/locales';
import { cn } from '@/shared/lib/cn';
import { GUIDE_PATH } from '@/shared/lib/guidePaths';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { Breadcrumb } from '@/shared/ui/Breadcrumb';
import { LocaleLink } from '@/shared/ui/LocaleLink';
import { loadGuideCategoryCopy } from './lib/guideCopy';
import { countByCategory, toGuideSummary } from './lib/guideBrowse';
import { GuideBrowser } from './ui/GuideBrowser';
import { GuideCategoryTiles } from './ui/GuideCategoryTiles';

const OTHER_HEADING_ID = 'guide-other-categories';

interface GuideCategoryPageProps {
    readonly locale: Locale;
    readonly category: GuideCategory;
    /** 카탈로그 전체 요약 — 다른 분류의 개수를 세는 데 쓴다. */
    readonly entries: readonly GuideEntrySummary[];
}

/** `/guide/[category]` — 분류 소개 한 단락 + 그 분류의 카드 목록 + 다른 분류로 가는 길. */
export async function GuideCategoryPage({
    locale,
    category,
    entries,
}: GuideCategoryPageProps) {
    const [t, copy] = await Promise.all([
        getTranslations({ locale, namespace: 'views.guide' }),
        loadGuideCategoryCopy(locale),
    ]);
    const counts = countByCategory(entries);
    const others = GUIDE_CATEGORIES.filter(other => other !== category).map(
        other => ({
            category: other,
            label: copy.label[other],
            count: t('entryCount', { count: counts[other] }),
        })
    );

    return (
        <main className="page-container flex flex-1 flex-col py-8 sm:py-12">
            <Breadcrumb
                trail={[
                    { label: t('hubTitle'), href: GUIDE_PATH },
                    { label: copy.label[category] },
                ]}
            />

            <header className="max-w-2xl pb-8 sm:pb-10">
                <p className="font-mono text-xs tracking-widest text-primary-400">
                    CHART GUIDE
                </p>
                <h1 className="mt-3 text-3xl font-bold tracking-tight text-secondary-50 sm:text-4xl">
                    {copy.label[category]}
                </h1>
                <p className="mt-4 text-[15px] leading-7 text-secondary-300 sm:text-base">
                    {copy.intro[category]}
                </p>
            </header>

            <GuideBrowser
                entries={entries
                    .filter(entry => entry.category === category)
                    .map(toGuideSummary)}
                categoryLabels={copy.label}
                fixedCategory={category}
            />

            <section aria-labelledby={OTHER_HEADING_ID} className="mt-16">
                <h2
                    id={OTHER_HEADING_ID}
                    className={cn(HEADING_SECTION, 'mb-4')}
                >
                    {t('otherCategories')}
                </h2>
                <GuideCategoryTiles
                    label={t('otherCategories')}
                    tiles={others}
                />
                <p className="mt-6">
                    <LocaleLink
                        href={GUIDE_PATH}
                        prefetch={false}
                        className="tap-target rounded-sm text-sm text-primary-400 transition-colors hover:text-primary-300 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none motion-reduce:transition-none"
                    >
                        {t('categoryHubLink')}
                    </LocaleLink>
                </p>
            </section>
        </main>
    );
}

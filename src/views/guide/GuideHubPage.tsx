import { getTranslations } from 'next-intl/server';
import type { GuideEntrySummary } from '@/entities/guide/types';
import type { Locale } from '@/shared/i18n/locales';
import { Breadcrumb } from '@/shared/ui/Breadcrumb';
import { loadGuideCategoryCopy } from './lib/guideCopy';
import { toGuideSummary } from './lib/guideBrowse';
import { GuideBrowser } from './ui/GuideBrowser';

interface GuideHubPageProps {
    readonly locale: Locale;
    readonly entries: readonly GuideEntrySummary[];
}

/**
 * `/guide` — 차트 가이드 허브. 소개 + 검색·분류 필터 + 분류별 카드 목록.
 *
 * 카드 목록 전체를 서버가 그린다(크롤 가능). 클라이언트에는 본문·FAQ를 뺀 요약만 넘긴다.
 */
export async function GuideHubPage({ locale, entries }: GuideHubPageProps) {
    const [t, copy] = await Promise.all([
        getTranslations({ locale, namespace: 'views.guide' }),
        loadGuideCategoryCopy(locale),
    ]);

    return (
        <main className="page-container flex flex-1 flex-col py-8 sm:py-12">
            <Breadcrumb trail={[{ label: t('hubTitle') }]} />

            <header className="max-w-2xl pb-8 sm:pb-10">
                <p className="font-mono text-xs tracking-widest text-primary-400">
                    CHART GUIDE
                </p>
                <h1 className="mt-3 text-3xl font-bold tracking-tight text-secondary-50 sm:text-4xl">
                    {t('hubTitle')}
                </h1>
                <p className="mt-4 text-[15px] leading-7 text-secondary-300 sm:text-base">
                    {t('hubIntro')}
                </p>
            </header>

            <GuideBrowser
                entries={entries.map(toGuideSummary)}
                categoryLabels={copy.label}
            />
        </main>
    );
}

/**
 * `siglens.io/methodology` 페이지 뷰.
 */
import type { SkillCounts } from '@y0ngha/siglens-core';
import { getTranslations } from 'next-intl/server';
import type { Locale } from '@/shared/i18n/locales';
import { INVESTMENT_DISCLAIMER_KEY } from '@/shared/lib/legal';
import { Breadcrumb } from '@/shared/ui/Breadcrumb';
import { methodologySectionTitles } from './lib/methodologySections';
import { MethodologyToc } from './ui/layout/MethodologyToc';
import { AiSection } from './ui/sections/AiSection';
import { BacktestingSection } from './ui/sections/BacktestingSection';
import { ChangelogSection } from './ui/sections/ChangelogSection';
import { CorrectionsSection } from './ui/sections/CorrectionsSection';
import { DataSection } from './ui/sections/DataSection';
import { FearGreedSection } from './ui/sections/FearGreedSection';
import { IndicatorsSection } from './ui/sections/IndicatorsSection';
import { LimitsSection } from './ui/sections/LimitsSection';
import { OverviewSection } from './ui/sections/OverviewSection';

interface Props {
    readonly locale: Locale;
    /** Breadcrumb label, shared with the `BreadcrumbList` JSON-LD. */
    readonly title: string;
    /** 홈·`/about`과 같은 소스(`countSkillFiles`)의 개수. */
    readonly counts: SkillCounts;
    /** `METHODOLOGY_UPDATED_AT`, already formatted for the locale. */
    readonly updatedAt: string;
}

/**
 * 분석이 어떤 데이터로, 어떤 규칙으로, 누가(무엇이) 쓴 것인지 밝히는 긴 읽을거리.
 * AI가 쓴 금융 분석이라 "누가·어떻게·왜"를 한 곳에서 밝히는 것이 목적이다.
 *
 * YMYL 신뢰 신호가 목적이라 꾸밈이 없다 — 카드와 목록, 일정한 행간만 쓰고
 * 애니메이션은 없다. 전부 서버 렌더 텍스트라 크롤러가 본문 전체를 받는다.
 * 사실 문장은 모두 코드나 `docs/product/DOMAIN.md`와 대조한 것이고, 대조할 수 없는
 * 주장은 넣지 않았다. 공포·탐욕 가중치는 공개하지 않는다.
 *
 * 번역기는 여기서 한 번 만들어 섹션에 넘긴다. 섹션 제목은 목차와 같은 값을 쓴다.
 */
export async function MethodologyPage({
    locale,
    title,
    counts,
    updatedAt,
}: Props) {
    const t = await getTranslations({
        locale,
        namespace: 'views.methodology',
    });
    const tLegal = await getTranslations({
        locale,
        namespace: 'shared.lib.legal',
    });
    const titles = methodologySectionTitles(t);

    return (
        <main className="relative isolate flex-1 pb-16">
            <div className="mx-auto w-full max-w-4xl px-4 pt-6 sm:pt-8">
                <Breadcrumb trail={[{ label: title }]} />

                <header className="pb-6">
                    <p className="text-sm font-medium text-secondary-400">
                        {t('hero.eyebrow')}
                    </p>
                    <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance text-secondary-50 sm:text-[42px] sm:leading-tight">
                        {t('hero.title')}
                    </h1>
                    <p className="mt-4 max-w-2xl text-base leading-7 text-pretty text-secondary-300">
                        {t('hero.lede')}
                    </p>
                </header>

                <MethodologyToc label={t('toc.label')} titles={titles} />

                <OverviewSection t={t} title={titles.overview} />
                <DataSection t={t} title={titles.data} />
                <IndicatorsSection
                    t={t}
                    title={titles.indicators}
                    counts={counts}
                />
                <FearGreedSection t={t} title={titles['fear-greed']} />
                <AiSection t={t} title={titles.ai} locale={locale} />
                <BacktestingSection t={t} title={titles.backtesting} />
                <LimitsSection t={t} title={titles.limits} />
                <CorrectionsSection t={t} title={titles.corrections} />
                <ChangelogSection
                    t={t}
                    title={titles.changelog}
                    locale={locale}
                />

                <p className="mt-14 text-center text-xs text-secondary-400">
                    {t('updated', { date: updatedAt })}
                </p>
                <p
                    role="note"
                    className="mt-3 text-center text-xs leading-relaxed text-secondary-400"
                >
                    {tLegal(INVESTMENT_DISCLAIMER_KEY)}
                </p>
            </div>
        </main>
    );
}

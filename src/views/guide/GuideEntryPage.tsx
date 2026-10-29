/** `/guide/[category]/[slug]` 뷰 — 가이드 항목 한 편. */
import { getTranslations } from 'next-intl/server';
import type { GuideEntry } from '@/entities/guide/types';
import { LIVE_ANCHOR_HEADING } from '@/shared/config/guideLive';
import { localePath, type Locale } from '@/shared/i18n/locales';
import { GUIDE_PATH, guideCategoryPath } from '@/shared/lib/guidePaths';
import { extractToc } from '@/shared/lib/legal-toc';
import {
    formatKoreanDate,
    INVESTMENT_DISCLAIMER_KEY,
} from '@/shared/lib/legal';
import { Breadcrumb } from '@/shared/ui/Breadcrumb';
import { AskAiFab } from '@/widgets/ask-ai-fab/AskAiFab';
import { getGuideDemo } from './demos/registry';
import {
    guideNeighbors,
    resolveAnsweredBy,
    resolveRelated,
} from './lib/guideBrowse';
import { loadGuideCategoryCopy } from './lib/guideCopy';
import { patternTitlesByPath, resolveDemoSource } from './lib/guideEntry';
import type { LiveSymbolGroup } from './lib/liveSymbols';
import { splitMarkdownAtHeading } from './lib/splitMarkdown';
import { GuideEntryAside } from './ui/entry/GuideEntryAside';
import { GuideEntryCardSection } from './ui/entry/GuideEntryCardSection';
import { GuideEntryCta } from './ui/entry/GuideEntryCta';
import { GuideEntryHeader } from './ui/entry/GuideEntryHeader';
import { GuidePager } from './ui/entry/GuidePager';
import { GuideDemoChart } from './ui/GuideDemoChart';
import { GuideFaq } from './ui/GuideFaq';
import { GuideLiveSymbols } from './ui/GuideLiveSymbols';
import { GuideMarkdown } from './ui/GuideMarkdown';

interface GuideEntryPageProps {
    readonly locale: Locale;
    readonly entry: GuideEntry;
    /** 같은 로케일의 카탈로그 전체 — 이전·다음과 관련 항목을 찾는 데 쓴다. */
    readonly catalog: readonly GuideEntry[];
    /** 라우트 로더(`loadGuideLiveSymbols`)의 결과. null이면 모듈을 그리지 않는다. */
    readonly liveSymbols: readonly LiveSymbolGroup[] | null;
}

const ANSWERED_BY_HEADING_ID = 'guide-answered-by-heading';
const RELATED_HEADING_ID = 'guide-related-heading';

/**
 * `/guide/[category]/[slug]` — 항목 한 편.
 *
 * 구성: 브레드크럼 → 제목·다른 이름·요약 → 데모 차트 → 본문(앵커 절) → 라이브 종목 → 본문 나머지 →
 * FAQ → 답하는 질문 → 관련 항목·이전/다음 → 종목 검색 안내 → 투자 고지. 넓은 화면에서는 오른쪽에 본문 차례가 따라온다.
 *
 * 마크업은 크롤러가 읽는 순서 그대로다(h1 하나, 본문 h2, FAQ·관련 h2). JSON-LD는 라우트가 만든다.
 */
export async function GuideEntryPage({
    locale,
    entry,
    catalog,
    liveSymbols,
}: GuideEntryPageProps) {
    const [t, tFab, tLegal, copy] = await Promise.all([
        getTranslations({ locale, namespace: 'views.guide' }),
        getTranslations({ locale, namespace: 'widgets.ask-ai-fab' }),
        getTranslations({ locale, namespace: 'shared.lib.legal' }),
        loadGuideCategoryCopy(locale),
    ]);
    const categoryLabel = copy.label[entry.category];
    const demoSource = resolveDemoSource(entry, catalog);
    const demo = getGuideDemo(demoSource.category, demoSource.slug);
    const body = splitMarkdownAtHeading(entry.bodyMd, LIVE_ANCHOR_HEADING);
    const { previous, next } = guideNeighbors(catalog, entry);
    // 이름과 달리 로케일을 따른다(`INTL_LOCALE[locale]`). 타임존만 KST로 고정해 `updatedAt`의
    // 같은 순간이 어느 서버 타임존에서도 같은 날짜로 찍힌다(발행 기준일은 한국 날짜).
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
                    <GuideEntryHeader
                        entry={entry}
                        categoryLabel={categoryLabel}
                        aliasesLabel={t('aliasesLabel')}
                        updatedAtLabel={t('updatedAt', { date: updatedAt })}
                    />

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
                        <GuideMarkdown markdown={body.before} />
                    </div>
                    {liveSymbols === null ? null : (
                        <GuideLiveSymbols
                            locale={locale}
                            groups={liveSymbols}
                            patternTitles={patternTitlesByPath(catalog)}
                        />
                    )}
                    {body.after === null ? null : (
                        // GuideMarkdown은 첫 자식의 위 여백을 지운다(`[&>:first-child]:mt-0`).
                        // 둘째 조각의 첫 h2는 분할 전엔 첫 자식이 아니었으니 h2 기본 여백
                        // (`mt-12`, GuideMarkdown)을 이 래퍼가 되돌려 준다.
                        <div className="mt-12">
                            <GuideMarkdown markdown={body.after} />
                        </div>
                    )}

                    <GuideFaq heading={t('faqHeading')} items={entry.faq} />

                    <GuideEntryCardSection
                        headingId={ANSWERED_BY_HEADING_ID}
                        heading={t('answeredByHeading')}
                        entries={resolveAnsweredBy(catalog, entry)}
                        categoryLabels={copy.label}
                    />
                    <GuideEntryCardSection
                        headingId={RELATED_HEADING_ID}
                        heading={t('relatedHeading')}
                        entries={resolveRelated(catalog, entry)}
                        categoryLabels={copy.label}
                    />

                    <GuidePager
                        label={t('paginationLabel')}
                        previousLabel={t('previousLabel')}
                        nextLabel={t('nextLabel')}
                        previous={previous}
                        next={next}
                    />

                    <GuideEntryCta
                        heading={t('ctaHeading')}
                        body={t('ctaBody')}
                        buttonLabel={t('ctaButton')}
                    />

                    <p className="mt-8 text-xs leading-relaxed text-secondary-500">
                        {tLegal(INVESTMENT_DISCLAIMER_KEY)}
                    </p>
                </article>

                <GuideEntryAside
                    toc={extractToc(entry.bodyMd)}
                    tocLabel={t('tocLabel')}
                    category={entry.category}
                    backLabel={t('backToCategory', { name: categoryLabel })}
                />
            </div>

            <AskAiFab
                question={tFab('guideQuestion', { title: entry.title })}
                localePrefix={localePath(locale, '/')}
            />
        </main>
    );
}

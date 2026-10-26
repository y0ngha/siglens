import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import {
    BENCHMARK_JUDGED_LEVELS,
    BENCHMARK_LABELS,
    BENCHMARK_MARKETS,
    BENCHMARK_OBJECTIVE_LEVELS,
    BENCHMARK_SUBSETS,
    type BenchmarkRelease,
} from '@/entities/benchmark/types';
import { BENCHMARK_DATA_LICENSE_URL } from '@/shared/config/benchmark';
import { DEFAULT_LOCALE, localePath, type Locale } from '@/shared/i18n/locales';
import { brandAiName } from '@/shared/lib/brandName';
import { cn } from '@/shared/lib/cn';
import { GITHUB_URL } from '@/shared/lib/seo';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import {
    HEADING_SECTION,
    HEADING_SUBSECTION,
} from '@/shared/lib/typographyStyles';
import { BenchmarkItemExplorer } from './BenchmarkItemExplorer';
import {
    BENCHMARK_SIGNIFICANCE_LEVEL,
    buildBenchmarkHeadline,
    withSubjectLabel,
} from '@/entities/benchmark/lib/benchmarkHeadline';
import {
    formatBenchmarkContrast,
    formatBenchmarkDate,
} from '@/shared/lib/benchmarkFormat';
import {
    BenchmarkScoreTable,
    BenchmarkTableShell,
} from './ui/BenchmarkScoreTables';

interface Props {
    readonly release: BenchmarkRelease;
    readonly locale: Locale;
    /** siglens.io origin. 공유 view라 메인 사이트 링크는 이 값으로 절대 URL을 만든다. */
    readonly siteUrl: string;
    /** ai.siglens.io origin. */
    readonly aiSiteUrl: string;
}

const TEXT_LINK =
    'inline-flex min-h-11 items-center rounded text-secondary-300 underline underline-offset-2 hover:text-primary-400 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';

const TH =
    'px-3 py-2 text-xs font-semibold text-secondary-400 whitespace-nowrap';

interface SectionProps {
    readonly id: string;
    readonly title: string;
    readonly sub?: string;
    readonly children: ReactNode;
}

function Section({ id, title, sub, children }: SectionProps) {
    return (
        <section aria-labelledby={id} className="mt-14 first:mt-0">
            <h2 id={id} className={cn(HEADING_SECTION, 'scroll-mt-24')}>
                {title}
            </h2>
            {sub ? (
                <p className="mt-2 text-[15px] leading-6 text-secondary-400">
                    {sub}
                </p>
            ) : null}
            <div className="mt-5">{children}</div>
        </section>
    );
}

/**
 * 벤치마크 결과 상세. `ai.siglens.io/benchmark`(정본)와 `siglens.io/benchmark`(사본)가 같은
 * props로 같은 본문을 그린다 — 본문이 다르면 검색엔진이 canonical을 무시할 수 있다.
 *
 * 서버 컴포넌트다. 헤드라인·점수표·방법론은 크롤러가 읽으므로 전부 서버에서 텍스트로
 * 나가고, 문항 탐색기(클라이언트)는 목록 메타를 props로 받아 서버에서도 그려진다.
 * 모든 수치는 `release`에서 오며 문구에 손으로 쓴 결과 숫자는 없다.
 */
export async function BenchmarkPage({
    release: rawRelease,
    locale,
    siteUrl,
    aiSiteUrl,
}: Props) {
    const t = await getTranslations({ locale, namespace: 'views.benchmark' });
    const brand = brandAiName(locale);
    // 주체는 화면 어디서나 브랜드 표기로 부른다(경쟁 모델은 데이터 라벨 그대로).
    const release = withSubjectLabel(rawRelease, brand);
    const headline = buildBenchmarkHeadline(release);
    const { targets, breakdown, methodology, prereg, downloads } = release;
    const verdictText = {
        ahead: t('headline.verdict.ahead'),
        behind: t('headline.verdict.behind'),
        tie: t('headline.verdict.tie'),
        untested: t('headline.verdict.untested'),
    } as const;
    const labelText = {
        correct: t('counts.correct'),
        partial: t('counts.partial'),
        incorrect: t('counts.incorrect'),
        not_attempted: t('counts.not_attempted'),
        excluded: t('counts.excluded'),
        pending: t('counts.pending'),
    } as const;
    // L1~L3은 이름 없이 id 그대로 쓴다. L4·L5는 무엇을 재는 구간인지 이름이 있다.
    const levelText = {
        L1: 'L1',
        L2: 'L2',
        L3: 'L3',
        L4: t('levels.L4'),
        L5: t('levels.L5'),
    } as const;
    const marketText = { us: t('market.us'), kr: t('market.kr') } as const;
    const subsetText = {
        noTool: t('subset.noTool'),
        heldOut: t('subset.heldOut'),
    } as const;
    const scoreRows = (
        keys: readonly string[],
        table: Readonly<
            Record<string, Readonly<Record<string, number | null>>>
        >,
        names: Readonly<Record<string, string>>
    ) =>
        keys.map(key => ({
            key,
            label: names[key] ?? key,
            scores: table[key] ?? {},
        }));
    const poolSummary = Object.entries(methodology.poolSizes)
        .map(([pool, size]) => `${pool} ${size}`)
        .join(', ');
    const totalItems = release.items.length;
    const methodologyHref = `${siteUrl}${localePath(locale, '/methodology')}`;
    const aiAboutHref = `${aiSiteUrl}${localePath(locale, '/about')}`;

    return (
        <main className="relative isolate flex-1 pb-16">
            <div className="mx-auto w-full max-w-5xl px-4 pt-6 sm:pt-8">
                <header>
                    <p className="text-sm font-medium text-secondary-400">
                        {t('hero.eyebrow')}
                    </p>
                    <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance text-secondary-50 sm:text-[42px] sm:leading-tight">
                        {t('hero.title', { brand })}
                    </h1>
                    <p className="mt-4 text-base leading-7 text-pretty text-secondary-300">
                        {t('hero.lede', {
                            brand,
                            items: totalItems,
                            measuredAt: formatBenchmarkDate(release.measuredAt),
                            scoredAt: formatBenchmarkDate(release.scoredAt),
                            sameDay:
                                release.measuredAt === release.scoredAt
                                    ? 'yes'
                                    : 'no',
                        })}
                    </p>
                    {locale !== DEFAULT_LOCALE ? (
                        <p
                            role="note"
                            className={cn(
                                SURFACE_CARD,
                                'mt-4 px-4 py-3 text-sm leading-6 text-secondary-200'
                            )}
                        >
                            {t('koreanNote')}
                        </p>
                    ) : null}
                </header>

                <Section
                    id="benchmark-headline"
                    title={t('headline.title')}
                    sub={t('headline.sub', { lambda: methodology.lambda })}
                >
                    {headline ? (
                        <>
                            <p className="text-lg leading-8 text-secondary-100">
                                {t('headline.summary', {
                                    subject: headline.subject.label,
                                    count: headline.competitors.length,
                                    ahead: headline.counts.ahead,
                                    tie: headline.counts.tie,
                                    behind: headline.counts.behind,
                                })}
                            </p>
                            <div className="mt-5 flex flex-col gap-4">
                                {[
                                    {
                                        key: 'competitors',
                                        caption: t('headline.competitors'),
                                        entries: headline.competitors,
                                    },
                                    {
                                        key: 'baselines',
                                        caption: t('headline.baselines'),
                                        entries: headline.baselines,
                                    },
                                ]
                                    .filter(group => group.entries.length > 0)
                                    .map(group => (
                                        <BenchmarkTableShell
                                            key={group.key}
                                            caption={group.caption}
                                        >
                                            <thead>
                                                <tr>
                                                    <th
                                                        scope="col"
                                                        className={TH}
                                                    >
                                                        {t('headline.target')}
                                                    </th>
                                                    <th
                                                        scope="col"
                                                        className={cn(
                                                            TH,
                                                            'text-right'
                                                        )}
                                                    >
                                                        {t('headline.diff', {
                                                            subject:
                                                                headline.subject
                                                                    .label,
                                                        })}
                                                    </th>
                                                    <th
                                                        scope="col"
                                                        className={cn(
                                                            TH,
                                                            'text-right'
                                                        )}
                                                    >
                                                        {t('headline.ci')}
                                                    </th>
                                                    <th
                                                        scope="col"
                                                        className={cn(
                                                            TH,
                                                            'text-right'
                                                        )}
                                                    >
                                                        {t('headline.p')}
                                                    </th>
                                                    <th
                                                        scope="col"
                                                        className={cn(
                                                            TH,
                                                            'text-right'
                                                        )}
                                                    >
                                                        {t('headline.n')}
                                                    </th>
                                                    <th
                                                        scope="col"
                                                        className={TH}
                                                    >
                                                        {t('headline.reading')}
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {group.entries.map(entry => {
                                                    const text =
                                                        formatBenchmarkContrast(
                                                            entry.contrast
                                                        );
                                                    return (
                                                        <tr
                                                            key={
                                                                entry.target.id
                                                            }
                                                            className="border-t border-secondary-700"
                                                        >
                                                            <th
                                                                scope="row"
                                                                className="px-3 py-2 font-normal text-secondary-100"
                                                                translate="no"
                                                            >
                                                                {
                                                                    entry.target
                                                                        .label
                                                                }
                                                            </th>
                                                            <td className="px-3 py-2 text-right font-semibold text-secondary-50">
                                                                {text.diffText}
                                                            </td>
                                                            <td className="px-3 py-2 text-right whitespace-nowrap text-secondary-300">
                                                                {text.ciText}
                                                            </td>
                                                            <td className="px-3 py-2 text-right text-secondary-300">
                                                                {text.pText}
                                                            </td>
                                                            <td className="px-3 py-2 text-right text-secondary-300">
                                                                {
                                                                    entry
                                                                        .contrast
                                                                        .n
                                                                }
                                                            </td>
                                                            <td className="px-3 py-2 whitespace-nowrap text-secondary-200">
                                                                {
                                                                    verdictText[
                                                                        entry
                                                                            .verdict
                                                                    ]
                                                                }
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </BenchmarkTableShell>
                                    ))}
                            </div>
                            <p className="mt-3 text-xs leading-5 text-secondary-400">
                                {t('headline.note', {
                                    alpha: BENCHMARK_SIGNIFICANCE_LEVEL,
                                })}
                            </p>
                        </>
                    ) : null}
                </Section>

                <Section
                    id="benchmark-breakdown"
                    title={t('breakdown.title')}
                    sub={t('breakdown.sub')}
                >
                    <div className="flex flex-col gap-4">
                        <BenchmarkScoreTable
                            caption={t('breakdown.byLevel', {
                                lambda: methodology.lambda,
                            })}
                            rowHeader={t('breakdown.rowLevel')}
                            targets={targets}
                            rows={[
                                {
                                    key: 'overall',
                                    label: t('breakdown.rowOverall'),
                                    scores: breakdown.overall,
                                },
                                ...scoreRows(
                                    BENCHMARK_OBJECTIVE_LEVELS,
                                    breakdown.byLevel,
                                    levelText
                                ),
                            ]}
                        />
                        <p className="-mt-2 text-xs leading-5 text-secondary-400">
                            {t('breakdown.overallNote')}
                        </p>
                        <BenchmarkScoreTable
                            caption={t('breakdown.byMarket', {
                                lambda: methodology.lambda,
                            })}
                            rowHeader={t('breakdown.rowMarket')}
                            targets={targets}
                            rows={scoreRows(
                                BENCHMARK_MARKETS,
                                breakdown.byMarket,
                                marketText
                            )}
                        />
                        <BenchmarkScoreTable
                            caption={t('breakdown.bySubset', {
                                lambda: methodology.lambda,
                            })}
                            rowHeader={t('breakdown.rowSubset')}
                            targets={targets}
                            rows={scoreRows(
                                BENCHMARK_SUBSETS,
                                breakdown.bySubset,
                                subsetText
                            )}
                        />
                        <BenchmarkScoreTable
                            caption={t('breakdown.judged')}
                            rowHeader={t('breakdown.rowLevel')}
                            targets={targets}
                            rows={scoreRows(
                                BENCHMARK_JUDGED_LEVELS,
                                breakdown.judged,
                                levelText
                            )}
                        />
                        <BenchmarkTableShell caption={t('breakdown.counts')}>
                            <thead>
                                <tr>
                                    <th scope="col" className={TH}>
                                        {t('headline.target')}
                                    </th>
                                    {BENCHMARK_LABELS.map(label => (
                                        <th
                                            key={label}
                                            scope="col"
                                            className={cn(TH, 'text-right')}
                                        >
                                            {labelText[label]}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {targets.map(target => (
                                    <tr
                                        key={target.id}
                                        className="border-t border-secondary-700"
                                    >
                                        <th
                                            scope="row"
                                            className="px-3 py-2 font-normal text-secondary-200"
                                            translate="no"
                                        >
                                            {target.label}
                                        </th>
                                        {BENCHMARK_LABELS.map(label => (
                                            <td
                                                key={label}
                                                className="px-3 py-2 text-right text-secondary-300"
                                            >
                                                {breakdown.labelCounts[
                                                    target.id
                                                ]?.[label] ?? 0}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </BenchmarkTableShell>
                    </div>
                </Section>

                <Section
                    id="benchmark-method"
                    title={t('method.title')}
                    sub={t('method.sub')}
                >
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className={cn(SURFACE_CARD, 'p-4 sm:p-5')}>
                            <h3 className={HEADING_SUBSECTION}>
                                {t('method.itemsTitle')}
                            </h3>
                            <p className="mt-2 text-sm leading-6 text-secondary-300">
                                {t('method.items', {
                                    total: totalItems,
                                    pools: poolSummary,
                                })}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-secondary-300">
                                {t('method.levels')}
                            </p>
                        </div>
                        <div className={cn(SURFACE_CARD, 'p-4 sm:p-5')}>
                            <h3 className={HEADING_SUBSECTION}>
                                {t('method.truthTitle')}
                            </h3>
                            <p className="mt-2 text-sm leading-6 text-secondary-300">
                                {t('method.truth')}
                            </p>
                            {methodology.vendorMismatchCount !== null ? (
                                <p className="mt-2 text-sm leading-6 text-secondary-300">
                                    {t('method.vendorMismatch', {
                                        count: methodology.vendorMismatchCount,
                                    })}
                                </p>
                            ) : null}
                        </div>
                        <div className={cn(SURFACE_CARD, 'p-4 sm:p-5')}>
                            <h3 className={HEADING_SUBSECTION}>
                                {t('method.scoringTitle')}
                            </h3>
                            <p className="mt-2 text-sm leading-6 text-secondary-300">
                                {t('method.scoring', {
                                    lambda: methodology.lambda,
                                })}
                            </p>
                        </div>
                        <div className={cn(SURFACE_CARD, 'p-4 sm:p-5')}>
                            <h3 className={HEADING_SUBSECTION}>
                                {t('method.judgesTitle')}
                            </h3>
                            <p className="mt-2 text-sm leading-6 text-secondary-300">
                                {t('method.judges')}
                            </p>
                        </div>
                        <div
                            className={cn(
                                SURFACE_CARD,
                                'p-4 sm:p-5 md:col-span-2'
                            )}
                        >
                            <h3 className={HEADING_SUBSECTION}>
                                {t('method.scheduleTitle')}
                            </h3>
                            <p className="mt-2 text-sm leading-6 text-secondary-300">
                                {t('method.schedule', {
                                    brand,
                                    rounds: methodology.rounds,
                                    measuredAt: formatBenchmarkDate(
                                        release.measuredAt
                                    ),
                                    subjectVersion: methodology.subjectVersion,
                                    subjectMeasuredAt: formatBenchmarkDate(
                                        methodology.subjectMeasuredAt
                                    ),
                                })}
                            </p>
                        </div>
                    </div>
                    <ul className="mt-6 flex flex-wrap gap-x-5">
                        <li>
                            <a href={methodologyHref} className={TEXT_LINK}>
                                {t('method.siteMethodology')}
                            </a>
                        </li>
                        <li>
                            <a href={aiAboutHref} className={TEXT_LINK}>
                                {t('method.aiAbout')}
                            </a>
                        </li>
                        <li>
                            <a
                                href={`${GITHUB_URL}/blob/master/BENCHMARK.md`}
                                rel="noopener"
                                className={TEXT_LINK}
                            >
                                {t('method.designDoc')}
                            </a>
                        </li>
                    </ul>
                </Section>

                <Section
                    id="benchmark-prereg"
                    title={t('prereg.title')}
                    sub={t('prereg.sub', { brand })}
                >
                    <dl className={cn(SURFACE_CARD, 'grid gap-3 p-4 sm:p-5')}>
                        <div className="grid gap-x-4 gap-y-1 sm:grid-cols-[9rem_minmax(0,1fr)]">
                            <dt className="text-xs font-semibold text-secondary-400">
                                {t('prereg.hash')}
                            </dt>
                            <dd className="font-mono text-xs break-all text-secondary-200">
                                {prereg.combinedSha256}
                            </dd>
                        </div>
                        <div className="grid gap-x-4 gap-y-1 sm:grid-cols-[9rem_minmax(0,1fr)]">
                            <dt className="text-xs font-semibold text-secondary-400">
                                {t('prereg.gist')}
                            </dt>
                            <dd>
                                <a
                                    href={prereg.gistUrl}
                                    rel="noopener"
                                    className={cn(TEXT_LINK, 'break-all')}
                                >
                                    {prereg.gistUrl}
                                </a>
                            </dd>
                        </div>
                        <div className="grid gap-x-4 gap-y-1 sm:grid-cols-[9rem_minmax(0,1fr)]">
                            <dt className="text-xs font-semibold text-secondary-400">
                                {t('prereg.ots')}
                            </dt>
                            <dd>
                                <a href={prereg.otsPath} className={TEXT_LINK}>
                                    {t('prereg.otsLink')}
                                </a>
                            </dd>
                        </div>
                    </dl>
                    <p className="mt-3 text-sm leading-6 text-secondary-300">
                        {t('prereg.verify')}
                    </p>
                </Section>

                <Section
                    id="benchmark-downloads"
                    title={t('downloads.title')}
                    sub={t('downloads.sub')}
                >
                    <ul className="flex flex-wrap gap-x-6">
                        <li>
                            <a
                                href={downloads.zipPath}
                                download
                                className={TEXT_LINK}
                            >
                                {t('downloads.zip')}
                            </a>
                        </li>
                    </ul>
                    <p className="mt-3 text-sm leading-6 text-secondary-300">
                        {/* 링크를 문장 밖에 이어 붙이면 로케일마다 어순이 깨진다 — 한 메시지의 태그로 둔다. */}
                        {t.rich('downloads.license', {
                            link: chunks => (
                                <a
                                    href={BENCHMARK_DATA_LICENSE_URL}
                                    rel="license noopener"
                                    className={TEXT_LINK}
                                >
                                    {chunks}
                                </a>
                            ),
                        })}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-secondary-300">
                        {t('downloads.sources')}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-secondary-300">
                        {t('downloads.disclaimer')}
                    </p>
                </Section>

                <Section
                    id="benchmark-items"
                    title={t('items.title')}
                    sub={t('items.sub')}
                >
                    {/*
                     * 목록(items)은 클라이언트 컴포넌트 props라 서버 HTML뿐 아니라 RSC
                     * 페이로드에도 한 번 더 직렬화된다. 지금은 약 200문항 규모라 감수한다 —
                     * 문항 수가 늘면 질문·정답 요약 등 props를 줄이거나 지연 로드로 바꾼다.
                     */}
                    <BenchmarkItemExplorer
                        round={release.round}
                        targets={targets}
                        items={release.items}
                        levelNames={levelText}
                    />
                </Section>
            </div>
        </main>
    );
}

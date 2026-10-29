/**
 * 벤치마크 결과 페이지 본문(서버 컴포넌트). 두 호스트 라우트가 같은 props로 그린다.
 */
import { getTranslations } from 'next-intl/server';
import {
    BENCHMARK_JUDGED_LEVELS,
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
import { formatBenchmarkDate } from '@/shared/lib/benchmarkFormat';
import { BenchmarkItemExplorer } from './BenchmarkItemExplorer';
import {
    buildBenchmarkPageModel,
    formatBenchmarkPoolSummary,
} from './lib/benchmarkPageModel';
import { toBenchmarkScoreRows } from './lib/benchmarkScoreTable';
import { BenchmarkSection } from './ui/page/BenchmarkSection';
import { BenchmarkScoreTable } from './ui/page/BenchmarkScoreTables';
import { BENCHMARK_TEXT_LINK } from './ui/page/benchmarkPageStyles';
import { HeadlineContrastTable } from './ui/page/HeadlineContrastTable';
import { LabelCountsTable } from './ui/page/LabelCountsTable';
import { MethodCards } from './ui/page/MethodCards';
import { PreregList } from './ui/page/PreregList';

interface Props {
    readonly release: BenchmarkRelease;
    readonly locale: Locale;
    /** siglens.io origin. 공유 view라 메인 사이트 링크는 이 값으로 절대 URL을 만든다. */
    readonly siteUrl: string;
    /** ai.siglens.io origin. */
    readonly aiSiteUrl: string;
}

/**
 * 벤치마크 결과 상세. `ai.siglens.io/benchmark`(정본)와 `siglens.io/benchmark`(사본)가 같은
 * props로 같은 본문을 그린다 — 본문이 다르면 검색엔진이 canonical을 무시할 수 있다.
 *
 * 서버 컴포넌트다. 헤드라인·점수표·방법론은 크롤러가 읽으므로 전부 서버에서 텍스트로
 * 나가고, 문항 탐색기(클라이언트)는 목록 메타를 props로 받아 서버에서도 그려진다.
 * 모든 수치는 `release`에서 오며 문구에 손으로 쓴 결과 숫자는 없다. 번역은 이 파일에서만
 * 하고 하위 구역 컴포넌트는 번역된 문자열을 받는다.
 */
export async function BenchmarkPage({
    release: rawRelease,
    locale,
    siteUrl,
    aiSiteUrl,
}: Props) {
    const t = await getTranslations({ locale, namespace: 'views.benchmark' });
    const brand = brandAiName(locale);
    const { release, headline } = buildBenchmarkPageModel(rawRelease, brand);
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
    const groupCaption = {
        competitors: t('headline.competitors'),
        baselines: t('headline.baselines'),
    } as const;
    const totalItems = release.items.length;
    const measuredAt = formatBenchmarkDate(release.measuredAt);
    const lambda = methodology.lambda;
    const methodCards = [
        {
            key: 'items',
            title: t('method.itemsTitle'),
            paragraphs: [
                t('method.items', {
                    total: totalItems,
                    pools: formatBenchmarkPoolSummary(
                        methodology.poolSizes,
                        locale
                    ),
                }),
                t('method.levels'),
            ],
        },
        {
            key: 'truth',
            title: t('method.truthTitle'),
            paragraphs: [
                t('method.truth'),
                ...(methodology.vendorMismatchCount === null
                    ? []
                    : [
                          t('method.vendorMismatch', {
                              count: methodology.vendorMismatchCount,
                          }),
                      ]),
            ],
        },
        {
            key: 'scoring',
            title: t('method.scoringTitle'),
            paragraphs: [t('method.scoring', { lambda })],
        },
        {
            key: 'judges',
            title: t('method.judgesTitle'),
            paragraphs: [t('method.judges')],
        },
        {
            key: 'schedule',
            title: t('method.scheduleTitle'),
            paragraphs: [
                t('method.schedule', {
                    brand,
                    rounds: methodology.rounds,
                    measuredAt,
                    subjectVersion: methodology.subjectVersion,
                    subjectMeasuredAt: formatBenchmarkDate(
                        methodology.subjectMeasuredAt
                    ),
                }),
            ],
            wide: true,
        },
    ];
    const methodLinks = [
        {
            key: 'site',
            href: `${siteUrl}${localePath(locale, '/methodology')}`,
            text: t('method.siteMethodology'),
        },
        {
            key: 'ai',
            href: `${aiSiteUrl}${localePath(locale, '/about')}`,
            text: t('method.aiAbout'),
        },
        {
            key: 'design',
            href: `${GITHUB_URL}/blob/master/BENCHMARK.md`,
            rel: 'noopener',
            text: t('method.designDoc'),
        },
    ];

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
                            measuredAt,
                            scoredAt: formatBenchmarkDate(release.scoredAt),
                            sameDay:
                                release.measuredAt === release.scoredAt
                                    ? 'yes'
                                    : 'no',
                        })}
                    </p>
                    {locale === DEFAULT_LOCALE ? null : (
                        <div
                            role="note"
                            aria-label={t('koreanNoteLabel')}
                            className={cn(
                                SURFACE_CARD,
                                'mt-4 px-4 py-3 text-sm leading-6 text-secondary-200'
                            )}
                        >
                            {t('koreanNote')}
                        </div>
                    )}
                </header>

                <BenchmarkSection
                    id="benchmark-headline"
                    title={t('headline.title')}
                    sub={t('headline.sub', { lambda })}
                >
                    {headline ? (
                        <>
                            <p className="text-lg leading-8 text-secondary-100">
                                {t('headline.summary', { ...headline.summary })}
                            </p>
                            <div className="mt-5 flex flex-col gap-4">
                                {headline.groups.map(group => (
                                    <HeadlineContrastTable
                                        key={group.key}
                                        caption={groupCaption[group.key]}
                                        columns={{
                                            target: t('headline.target'),
                                            diff: t('headline.diff', {
                                                subject:
                                                    headline.summary.subject,
                                            }),
                                            ci: t('headline.ci'),
                                            p: t('headline.p'),
                                            n: t('headline.n'),
                                            reading: t('headline.reading'),
                                        }}
                                        rows={group.rows}
                                        verdictText={verdictText}
                                    />
                                ))}
                            </div>
                            <p className="mt-3 text-xs leading-5 text-secondary-400">
                                {t('headline.note', {
                                    alpha: headline.significanceLevel,
                                })}
                            </p>
                        </>
                    ) : null}
                </BenchmarkSection>

                <BenchmarkSection
                    id="benchmark-breakdown"
                    title={t('breakdown.title')}
                    sub={t('breakdown.sub')}
                >
                    <div className="flex flex-col gap-4">
                        <BenchmarkScoreTable
                            caption={t('breakdown.byLevel', { lambda })}
                            rowHeader={t('breakdown.rowLevel')}
                            targets={targets}
                            rows={[
                                {
                                    key: 'overall',
                                    label: t('breakdown.rowOverall'),
                                    scores: breakdown.overall,
                                },
                                ...toBenchmarkScoreRows(
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
                            caption={t('breakdown.byMarket', { lambda })}
                            rowHeader={t('breakdown.rowMarket')}
                            targets={targets}
                            rows={toBenchmarkScoreRows(
                                BENCHMARK_MARKETS,
                                breakdown.byMarket,
                                marketText
                            )}
                        />
                        <BenchmarkScoreTable
                            caption={t('breakdown.bySubset', { lambda })}
                            rowHeader={t('breakdown.rowSubset')}
                            targets={targets}
                            rows={toBenchmarkScoreRows(
                                BENCHMARK_SUBSETS,
                                breakdown.bySubset,
                                subsetText
                            )}
                        />
                        <BenchmarkScoreTable
                            caption={t('breakdown.judged')}
                            rowHeader={t('breakdown.rowLevel')}
                            targets={targets}
                            rows={toBenchmarkScoreRows(
                                BENCHMARK_JUDGED_LEVELS,
                                breakdown.judged,
                                levelText
                            )}
                        />
                        <LabelCountsTable
                            caption={t('breakdown.counts')}
                            targetHeader={t('headline.target')}
                            targets={targets}
                            labelCounts={breakdown.labelCounts}
                            labelText={labelText}
                        />
                    </div>
                </BenchmarkSection>

                <BenchmarkSection
                    id="benchmark-method"
                    title={t('method.title')}
                    sub={t('method.sub')}
                >
                    <MethodCards cards={methodCards} />
                    <ul className="mt-6 flex flex-wrap gap-x-5">
                        {methodLinks.map(link => (
                            <li key={link.key}>
                                <a
                                    href={link.href}
                                    rel={link.rel}
                                    className={BENCHMARK_TEXT_LINK}
                                >
                                    {link.text}
                                </a>
                            </li>
                        ))}
                    </ul>
                </BenchmarkSection>

                <BenchmarkSection
                    id="benchmark-prereg"
                    title={t('prereg.title')}
                    sub={t('prereg.sub', { brand })}
                >
                    <PreregList
                        prereg={prereg}
                        text={{
                            hash: t('prereg.hash'),
                            gist: t('prereg.gist'),
                            ots: t('prereg.ots'),
                            otsLink: t('prereg.otsLink'),
                        }}
                    />
                    <p className="mt-3 text-sm leading-6 text-secondary-300">
                        {t('prereg.verify')}
                    </p>
                </BenchmarkSection>

                <BenchmarkSection
                    id="benchmark-downloads"
                    title={t('downloads.title')}
                    sub={t('downloads.sub')}
                >
                    <ul className="flex flex-wrap gap-x-6">
                        <li>
                            <a
                                href={downloads.zipPath}
                                download
                                className={BENCHMARK_TEXT_LINK}
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
                                    className={BENCHMARK_TEXT_LINK}
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
                </BenchmarkSection>

                <BenchmarkSection
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
                </BenchmarkSection>
            </div>
        </main>
    );
}

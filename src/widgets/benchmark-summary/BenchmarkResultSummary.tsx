import { getTranslations } from 'next-intl/server';
import { BENCHMARK_PATH } from '@/shared/config/benchmark';
import { localePath, type Locale } from '@/shared/i18n/locales';
import { brandAiName } from '@/shared/lib/brandName';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { withSubjectLabel } from '@/entities/benchmark/lib/benchmarkHeadline';
import type { BenchmarkRelease } from '@/entities/benchmark/types';
import { buildSummaryHeadline } from './utils/buildSummaryHeadline';

interface Props {
    readonly release: BenchmarkRelease;
    readonly locale: Locale;
    /** ai.siglens.io origin. 상세 페이지의 정본이 거기 있다. */
    readonly aiSiteUrl: string;
    /** 제목 정렬. ai 소개 페이지는 섹션 제목을 가운데 정렬한다. */
    readonly centered?: boolean;
}

const TEXT_LINK =
    'inline-flex min-h-11 items-center rounded text-secondary-300 underline underline-offset-2 hover:text-primary-400 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';

/**
 * 두 소개 페이지(`/about`, ai `/about`)가 공유하는 벤치마크 결과 요약. 결과 숫자 3~4개와
 * 상세 페이지 링크만 보여 준다. 링크는 정본(ai 호스트)을 가리키는 절대 URL이다.
 * 수치는 `release`에서만 온다.
 */
export async function BenchmarkResultSummary({
    release: rawRelease,
    locale,
    aiSiteUrl,
    centered = false,
}: Props) {
    const t = await getTranslations({
        locale,
        namespace: 'widgets.benchmark-summary',
    });
    // 주체는 브랜드 표기로 부른다(경쟁 모델은 데이터 라벨 그대로).
    const release = withSubjectLabel(rawRelease, brandAiName(locale));
    const headline = buildSummaryHeadline(release);
    if (headline === null) return null;
    const verdictText = {
        ahead: t('verdict.ahead'),
        behind: t('verdict.behind'),
        tie: t('verdict.tie'),
        untested: t('verdict.untested'),
    } as const;
    return (
        <section aria-labelledby="about-benchmark" className="mt-20">
            <h2
                id="about-benchmark"
                className={cn(
                    HEADING_SECTION,
                    'text-2xl sm:text-[28px]',
                    centered && 'text-center'
                )}
            >
                {t('title')}
            </h2>
            <p
                className={cn(
                    'mt-2 max-w-2xl text-[15px] leading-6 text-secondary-400',
                    centered && 'mx-auto text-center'
                )}
            >
                {t('sub', {
                    subject: headline.subject.label,
                    items: release.items.length,
                })}
            </p>
            <ul
                className={cn(
                    'mt-7 grid gap-3 sm:grid-cols-2',
                    // 경쟁 모델 카드 + L5 카드. 네 장까지는 한 줄, 그 이상은 세 열로 접어 카드가 좁아지지 않게 한다.
                    headline.competitors.length + 1 <= 4
                        ? 'lg:grid-cols-4'
                        : 'lg:grid-cols-3'
                )}
            >
                {headline.competitors.map(entry => (
                    <li
                        key={entry.target.id}
                        className={cn(SURFACE_CARD, 'p-4')}
                    >
                        <p className="text-xs text-secondary-400">
                            {t('versus', { competitor: entry.target.label })}
                        </p>
                        <p className="mt-1 text-2xl font-semibold text-secondary-50 tabular-nums">
                            {entry.diffText}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-secondary-300 tabular-nums">
                            {t('ci', { ci: entry.ciText })}{' '}
                            <span aria-hidden="true">|</span>{' '}
                            {verdictText[entry.verdict]}
                        </p>
                    </li>
                ))}
                <li className={cn(SURFACE_CARD, 'p-4')}>
                    <p className="text-xs text-secondary-400">{t('l5')}</p>
                    <p className="mt-1 text-2xl font-semibold text-secondary-50 tabular-nums">
                        {headline.l5Text}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-secondary-300">
                        {t('l5Note')}
                    </p>
                </li>
            </ul>
            <p className={cn('mt-4', centered && 'text-center')}>
                <a
                    href={`${aiSiteUrl}${localePath(locale, BENCHMARK_PATH)}`}
                    className={TEXT_LINK}
                >
                    {t('more')}
                </a>
            </p>
        </section>
    );
}

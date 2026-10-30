/** 두 소개 페이지가 공유하는 벤치마크 결과 요약 섹션. */
import { getTranslations } from 'next-intl/server';
import type { Locale } from '@/shared/i18n/locales';
import { brandAiName } from '@/shared/lib/brandName';
import type { BenchmarkRelease } from '@/entities/benchmark/types';
import { buildBenchmarkDetailHref } from './utils/benchmarkDetailHref';
import {
    buildSummaryHeadline,
    type SummaryEntry,
} from './utils/buildSummaryHeadline';
import { SummaryHeader } from './ui/header/SummaryHeader';
import { SummaryCardList } from './ui/cards/SummaryCardList';
import { CompetitorCard } from './ui/cards/CompetitorCard';
import { SummaryCard } from './ui/cards/SummaryCard';
import { SummaryCardNote } from './ui/cards/SummaryCardNote';
import { BenchmarkDetailLink } from './ui/footer/BenchmarkDetailLink';

interface Props {
    readonly release: BenchmarkRelease;
    readonly locale: Locale;
    /** ai.siglens.io origin. 상세 페이지의 정본이 거기 있다. */
    readonly aiSiteUrl: string;
    /** 제목 정렬. ai 소개 페이지는 섹션 제목을 가운데 정렬한다. */
    readonly centered?: boolean;
}

const HEADING_ID = 'about-benchmark';

/**
 * 두 소개 페이지(`/about`, ai `/about`)가 공유하는 벤치마크 결과 요약. 경쟁 모델마다 점수 차 카드 한 장과
 * L5 카드, 상세 페이지 링크만 보여 준다. 링크는 정본(ai 호스트)을 가리키는 절대 URL이다.
 * 수치는 `release`에서만 온다.
 */
export async function BenchmarkResultSummary({
    release,
    locale,
    aiSiteUrl,
    centered = false,
}: Props) {
    const t = await getTranslations({
        locale,
        namespace: 'widgets.benchmark-summary',
    });
    // 주체는 브랜드 표기로 부른다(경쟁 모델은 데이터 라벨 그대로).
    const headline = buildSummaryHeadline(release, brandAiName(locale));
    if (headline === null) return null;
    const verdictText: Readonly<Record<SummaryEntry['verdict'], string>> = {
        ahead: t('verdict.ahead'),
        behind: t('verdict.behind'),
        tie: t('verdict.tie'),
        untested: t('verdict.untested'),
    };
    return (
        <section aria-labelledby={HEADING_ID} className="mt-20">
            <SummaryHeader
                headingId={HEADING_ID}
                title={t('title')}
                sub={t('sub', { subject: headline.subject.label })}
                centered={centered}
            />
            {/* 경쟁 모델 카드 + L5 카드. */}
            <SummaryCardList cardCount={headline.competitors.length + 1}>
                {headline.competitors.map(entry => (
                    <CompetitorCard
                        key={entry.target.id}
                        label={t('versus', { competitor: entry.target.label })}
                        diffText={entry.diffText}
                        ciText={t('ci', { ci: entry.ciText })}
                        verdictText={verdictText[entry.verdict]}
                        questionsText={t('questions', {
                            n: entry.questionCount,
                        })}
                    />
                ))}
                <SummaryCard label={t('l5')} value={headline.l5Text}>
                    <SummaryCardNote>{t('l5Note')}</SummaryCardNote>
                </SummaryCard>
            </SummaryCardList>
            <BenchmarkDetailLink
                href={buildBenchmarkDetailHref(aiSiteUrl, locale)}
                label={t('more')}
                centered={centered}
            />
        </section>
    );
}

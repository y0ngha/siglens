'use client';

/**
 * "한눈에 보기" 카드 — 분석 패널 맨 위에서 추세와 저항선·지지선·무효화 기준만 보여 준다.
 *
 * 진입가·목표가·진입 판단은 싣지 않고, 회원가입 유도나 링크도 두지 않는다. 잠긴 값은 "회원 전용"
 * 글자로만 알린다(잠금 카드는 패널 맨 아래의 `LockedDetailCard`가 유일한 안내다).
 *
 * 높이는 어떤 상태에서도 같다: 제목 줄, 헤드라인 `h-7`, 세 행 `h-6`, 같은 면책 문장. 로딩·잠금·
 * 채워진 상태가 서로 바뀌어도(오늘의 무료 공개가 스트림으로 도착하는 순간 포함) 아래 내용이
 * 움직이지 않는다. 면책 문장은 모든 상태에서 같은 글이라 높이가 상태에 따라 달라지지 않으므로
 * 줄 수를 잘라 내지 않고 두 줄 높이만 최소로 잡는다.
 *
 * `pending`은 "지금 보여 줄 실제 결과가 없다"는 뜻이다. 분석이 도는 동안 `analysis`는 무료(비회원)
 * 시드로 되돌아가 레벨·손절이 비어 있으므로, 그 값으로 그리면 회원에게 "없음"이나 "회원 전용"이
 * 깜빡인다. 호출부(`ChartContent`)가 결과 없이 분석 중이면 `pending`을 넘긴다.
 *
 * 첫 분석이 오류로 끝나면 `pending` 카드가 사라져 아래 내용이 카드 높이만큼(약 249px) 올라온다.
 * 오류일 때만 생기는 움직임이라 받아들인다 — 값이 없는 행을 지어내 카드를 남기지 않는다.
 *
 * 패널 카드(`AnalysisPanel`) 안이 아니라 형제로 놓인다 — 카드 면 위에 카드 면을 겹치지 않는다
 * (`DESIGN.md#DS-17`).
 */
import { useId } from 'react';
import { useTranslations } from 'next-intl';
import type {
    AnalysisResponse,
    ClusteredKeyLevels,
    KrxTickTable,
    TierInfoDepth,
    Trend,
} from '@y0ngha/siglens-core';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { formatAnalysisPrice } from '@/shared/lib/analysisPriceFormat';
import { cn } from '@/shared/lib/cn';
import { formatAnalyzedAt } from '@/shared/lib/formatAnalyzedAt';
import { PLACEHOLDER_ON_CARD } from '@/shared/lib/surfaceStyles';
import { LABEL_GROUP } from '@/shared/lib/typographyStyles';
import { InfoTooltip } from '@/shared/ui/InfoTooltip';
import {
    buildConclusionModel,
    type ConclusionModel,
    type ConclusionValue,
} from '../utils/conclusionModel';
import { resolveLockedSections } from '../utils/lockedSections';
import { resolveTrendDisplay } from '../utils/trendUtils';

interface AnalysisConclusionCardProps {
    /** `pending`: 첫 분석이 도착하기 전(자리만 잡는다). `ready`: 분석 결과가 있다. */
    status: 'pending' | 'ready';
    analysis: AnalysisResponse;
    keyLevels: ClusteredKeyLevels;
    lockedInfoDepth?: readonly TierInfoDepth[];
    symbol: string;
    /** KRX 호가표(주식/ETF). 한국 종목의 가격 표기에만 쓰인다. 생략하면 'share'. */
    krxTickTable?: KrxTickTable;
}

/** 로딩 중에는 값이 쓰이지 않는다(자리표시줄이 대신 그려진다). */
const NONE: ConclusionValue = { kind: 'none' };

const SKELETON = cn(
    PLACEHOLDER_ON_CARD,
    'animate-pulse rounded motion-reduce:animate-none'
);

/** 가격 행 값 색. 저항·지지는 `KeyLevelsSection`과 같다. */
const PRICE_COLOR = {
    resistance: 'text-ui-danger-text',
    support: 'text-ui-success-text',
    invalidation: 'text-secondary-100',
} as const;

/** 헤드라인 색. 보합은 배지(`secondary-400`)보다 한 단계 밝은 `secondary-200`을 쓴다(큰 글자 헤드라인). */
const TREND_HEADLINE_COLOR: Record<Trend, string> = {
    bullish: 'text-ui-success-text',
    bearish: 'text-ui-danger-text',
    neutral: 'text-secondary-200',
};

type RowKind = keyof typeof PRICE_COLOR;

interface RowValueProps {
    kind: RowKind;
    value: ConclusionValue;
    isPending: boolean;
    symbol: string;
    krxTickTable: KrxTickTable;
    /** 이미 내려간 상태의 배지. 무효화 기준 행에서만 쓴다. */
    voidLabel?: string;
    voidDescription?: string;
    lockedLabel: string;
    noneLabel: string;
}

function RowValue({
    kind,
    value,
    isPending,
    symbol,
    krxTickTable,
    voidLabel,
    voidDescription,
    lockedLabel,
    noneLabel,
}: RowValueProps) {
    const locale = useResolvedLocale();

    if (isPending) {
        return <span aria-hidden className={cn(SKELETON, 'h-4 w-16')} />;
    }
    if (value.kind === 'locked' || value.kind === 'none') {
        return (
            <span className="font-normal text-secondary-400">
                {value.kind === 'locked' ? lockedLabel : noneLabel}
            </span>
        );
    }
    return (
        <>
            <span className={cn('font-medium tabular-nums', PRICE_COLOR[kind])}>
                {formatAnalysisPrice(value.price, symbol, locale, {
                    krxTickTable,
                })}
            </span>
            {voidLabel !== undefined && voidDescription !== undefined && (
                <span className="shrink-0 rounded border border-ui-danger/30 bg-ui-danger/10 px-1 text-xs whitespace-nowrap text-ui-danger-text">
                    <span aria-hidden>{voidLabel}</span>
                    <span className="sr-only">{voidDescription}</span>
                </span>
            )}
        </>
    );
}

interface TrendHeadlineProps {
    model: ConclusionModel | null;
    /** 번역된 추세 이름. 알 수 없는 추세면 `null`. */
    trendLabel: string | null;
}

/**
 * 추세 헤드라인. "현재 추세" 접두어는 좁으면 줄임표로 잘리지만 추세 값(강세·약세·보합)은
 * 줄지 않는다 — 값이 잘리면 헤드라인이 의미를 잃는다. 한 문장 키를 태그로 나눠(`t.rich`)
 * 로케일마다 어순을 카탈로그가 정한다.
 */
function TrendHeadline({ model, trendLabel }: TrendHeadlineProps) {
    const t = useTranslations('widgets.analysis.conclusion');
    const trend = model?.trend ?? null;
    if (trend === null || trendLabel === null) {
        return (
            <span className="min-w-0 truncate text-secondary-300">
                {t('trendUnknown')}
            </span>
        );
    }
    return (
        <span className="flex min-w-0 items-center gap-1">
            {t.rich('trendHeadline', {
                v0: trendLabel,
                prefix: chunks => (
                    <span className="min-w-0 truncate text-secondary-300">
                        {chunks}
                    </span>
                ),
                value: chunks => (
                    <span
                        className={cn('shrink-0', TREND_HEADLINE_COLOR[trend])}
                    >
                        {chunks}
                    </span>
                ),
            })}
        </span>
    );
}

export function AnalysisConclusionCard({
    status,
    analysis,
    keyLevels,
    lockedInfoDepth = [],
    symbol,
    krxTickTable = 'share',
}: AnalysisConclusionCardProps) {
    const t = useTranslations('widgets.analysis.conclusion');
    const tLabel = useTranslations('shared.enumLabel');
    const tProgress = useTranslations('widgets.analysis.AnalysisProgress');
    const headingId = useId();
    const isPending = status === 'pending';

    const model = isPending
        ? null
        : buildConclusionModel({
              analysis,
              keyLevels,
              locked: resolveLockedSections(lockedInfoDepth),
          });
    const trendDisplay =
        model === null ? null : resolveTrendDisplay(model.trend, tLabel);
    // 분석 시각은 결과가 있을 때만 — 없으면 자리만 비워 둔다(제목 줄 높이는 같다).
    const analyzedAt =
        isPending || !analysis.analyzedAt ? undefined : analysis.analyzedAt;
    // 로딩 중 머리말은 막대 대신 글자다 — 모바일 PEEK처럼 카드만 보이는 자리에서도
    // "분석이 돌고 있다"는 사실이 읽힌다. 높이는 막대와 같은 `h-7` 줄이 잡는다.
    const headline = isPending ? (
        <span className="min-w-0 truncate text-secondary-300">
            {tProgress('784c44')}
        </span>
    ) : (
        <TrendHeadline model={model} trendLabel={trendDisplay?.label ?? null} />
    );
    const isPlanVoid = model?.isPlanVoid === true;
    const voidLabel = isPlanVoid ? t('planVoid') : undefined;
    const voidDescription = isPlanVoid ? t('planVoidDescription') : undefined;
    const lockedLabel = t('locked');
    const noneLabel = t('none');
    const rowProps = {
        isPending,
        symbol,
        krxTickTable,
        lockedLabel,
        noneLabel,
    };

    return (
        <section
            aria-labelledby={headingId}
            aria-busy={isPending}
            data-analysis-conclusion={status}
            className="flex flex-col rounded-lg bg-secondary-800 p-4"
        >
            <div className="flex h-5 items-center justify-between gap-2">
                <h2
                    id={headingId}
                    className={cn(LABEL_GROUP, 'min-w-0 truncate')}
                >
                    {t('title')}
                </h2>
                {analyzedAt !== undefined && (
                    <time
                        dateTime={analyzedAt}
                        className="shrink-0 text-xs whitespace-nowrap text-secondary-400"
                    >
                        <span className="sr-only">{t('analyzedAt')} </span>
                        {formatAnalyzedAt(analyzedAt)}
                    </time>
                )}
            </div>
            <p
                data-conclusion-headline
                className="mt-1 flex h-7 items-center text-lg font-semibold"
            >
                {headline}
            </p>
            <dl className="mt-3 flex flex-col gap-1.5 border-t border-secondary-700 pt-3 text-sm">
                <div className="flex h-6 items-center justify-between gap-2">
                    <dt className="min-w-0 truncate text-secondary-400">
                        {t('resistance')}
                    </dt>
                    <dd className="flex shrink-0 items-center gap-2 whitespace-nowrap">
                        <RowValue
                            {...rowProps}
                            kind="resistance"
                            value={model?.resistance ?? NONE}
                        />
                    </dd>
                </div>
                <div className="flex h-6 items-center justify-between gap-2">
                    <dt className="min-w-0 truncate text-secondary-400">
                        {t('support')}
                    </dt>
                    <dd className="flex shrink-0 items-center gap-2 whitespace-nowrap">
                        <RowValue
                            {...rowProps}
                            kind="support"
                            value={model?.support ?? NONE}
                        />
                    </dd>
                </div>
                <div className="flex h-6 items-center justify-between gap-2">
                    <dt className="flex min-w-0 items-center text-secondary-400">
                        {/* 좁은 폭(패널 최소 240px)에서 줄어드는 것은 라벨뿐이다. ⓘ 버튼은
                            `shrink-0`이라 가격·배지 밑으로 들어가지 않고 항상 눌린다. 라벨은 줄임표로
                            잘리며, 최악(원화 가격 + 이탈 배지)에서도 두세 글자는 남는다. */}
                        <span className="min-w-0 truncate">
                            {t('invalidation')}
                        </span>
                        <InfoTooltip
                            label={t('invalidationHelpLabel')}
                            className="shrink-0"
                        >
                            <p className="text-secondary-300">
                                {t('invalidationHelp')}
                            </p>
                            {voidDescription !== undefined && (
                                <p className="mt-1 text-secondary-300">
                                    {voidDescription}
                                </p>
                            )}
                        </InfoTooltip>
                    </dt>
                    <dd className="flex shrink-0 items-center gap-2 whitespace-nowrap">
                        <RowValue
                            {...rowProps}
                            kind="invalidation"
                            value={model?.invalidation ?? NONE}
                            voidLabel={voidLabel}
                            voidDescription={voidDescription}
                        />
                    </dd>
                </div>
            </dl>
            <p className="mt-3 min-h-8 text-xs leading-4 text-secondary-400">
                {t('caveat')}
            </p>
        </section>
    );
}

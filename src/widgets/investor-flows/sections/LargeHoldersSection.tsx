/**
 * 5% 이상 대량보유(13D·13G) 공시 섹션.
 */
import { useTranslations } from 'next-intl';
import type {
    InvestorFlowsWindow,
    LargeHolderFiling,
} from '@y0ngha/siglens-core';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { cn } from '@/shared/lib/cn';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { FlowTooltip } from '../investorFlowsTooltips';
import { formatInteger } from '../utils/flowFormat';
import { buildLargeHolderRows, largeHolderKey } from '../utils/largeHolders';
import { LargeHolderCard } from '../ui/large-holders/LargeHolderCard';

const HEADING_ID = 'flows-large-holders-heading';

interface LargeHoldersSectionProps {
    /** `null` = 13D/13G 조회 실패(없음 `[]`과 다르다). */
    readonly filings: readonly LargeHolderFiling[] | null;
    /** 점수(대량보유 축)를 매긴 창 — core `freshness.largeHolderWindow`. 목록에는 그보다 오래된 공시도 있어 창을 밝힌다. */
    readonly scoringWindow?: InvestorFlowsWindow;
    /** 조회 실패가 FMP 일시 오류였다(`snapshot.degraded`) — "일시적으로 불러오지 못했어요"라고 말한다. */
    readonly temporarilyUnavailable?: boolean;
}

/** 조회 실패(일시 오류 포함) → 공시 없음 → 카드 목록 순으로 첫 해당 분기만 그린다. */
function LargeHoldersBody({
    filings,
    temporarilyUnavailable,
}: {
    readonly filings: readonly LargeHolderFiling[] | null;
    readonly temporarilyUnavailable: boolean;
}) {
    const t = useTranslations('widgets.investor-flows');
    if (filings === null) {
        return (
            <p className="text-sm text-secondary-300">
                {temporarilyUnavailable
                    ? t('largeHolders.temporarilyUnavailable')
                    : t('largeHolders.unavailable')}
            </p>
        );
    }
    const rows = buildLargeHolderRows(filings);
    if (rows.length === 0) {
        return (
            <p className="text-sm text-secondary-300">
                {t('largeHolders.noData')}
            </p>
        );
    }
    return (
        <ul className="grid gap-2 md:grid-cols-2">
            {rows.map(filing => (
                <LargeHolderCard key={largeHolderKey(filing)} filing={filing} />
            ))}
        </ul>
    );
}

/**
 * 5% 이상 대량보유(13D·13G) 최근 공시 목록. 13D(행동주의·경영 참여 가능)와 13G(단순 투자)를 배지 글자로
 * 구분한다. 조회가 실패했으면(`null`) "불러오지 못했어요"(FMP 일시 오류면 "일시적으로")라고, 공시가 없으면 "데이터 없음"이라고
 * 갈라 말한다. 점수는 최근 창(`scoringWindow`)의 공시로만 매기지만 목록은 더 오래된 공시도 보여 주므로 그 창을 밝힌다.
 * 카드 목록 하나로 모든 폭을 처리한다(가로 스크롤 표 없음).
 */
export function LargeHoldersSection({
    filings,
    scoringWindow,
    temporarilyUnavailable = false,
}: LargeHoldersSectionProps) {
    const t = useTranslations('widgets.investor-flows');
    const locale = useResolvedLocale();
    return (
        <section
            aria-labelledby={HEADING_ID}
            className={cn(SURFACE_CARD, 'space-y-4 p-6')}
        >
            <div>
                <h2 id={HEADING_ID} className={HEADING_SECTION}>
                    {t('largeHolders.title')}
                    <FlowTooltip term="largeHolder13dg" />
                </h2>
                <p className="mt-1 text-xs text-secondary-400">
                    {t('largeHolders.subtitle')}
                </p>
                {scoringWindow !== undefined &&
                    scoringWindow.from !== null &&
                    scoringWindow.to !== null && (
                        <p className="mt-1 text-xs text-secondary-400">
                            {t('largeHolders.window', {
                                days: formatInteger(scoringWindow.days, locale),
                                from: scoringWindow.from,
                                to: scoringWindow.to,
                            })}
                        </p>
                    )}
            </div>
            <LargeHoldersBody
                filings={filings}
                temporarilyUnavailable={temporarilyUnavailable}
            />
        </section>
    );
}

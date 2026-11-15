/**
 * 미래 방향 카드 — 애널리스트 추정치·목표 주가·등급 분포를 모으고, 보여 줄 것이 하나도 없으면
 * 빈 카드를 그린다.
 */
import { useTranslations } from 'next-intl';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import type { AnalystTargetsSummary } from '@/entities/analyst-views/model';
import type { GradesConsensusSource } from '@/shared/api/fmp/gradesConsensusSource';
import type {
    FundamentalAnalystEstimateInput,
    FundamentalGradesConsensusInput,
    FundamentalPriceTargetConsensusInput,
    FundamentalPriceTargetSummaryInput,
} from '@y0ngha/siglens-core';
import { EmptySectionCard } from '@/shared/ui/EmptySectionCard';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { hasGrades } from '@/widgets/fundamental/utils/gradeBands';
import { EstimatesSection } from '@/widgets/fundamental/ui/future-direction/EstimatesSection';
import { PriceTargetSection } from '@/widgets/fundamental/ui/future-direction/PriceTargetSection';
import { RatingsSection } from '@/widgets/fundamental/ui/future-direction/RatingsSection';

const HEADING_ID = 'future-heading';
const HEADING_CLASS_NAME = cn('mb-4', HEADING_SECTION);

interface FutureDirectionCardProps {
    /** 표기 통화를 정하기 위해 필요하다 — 국내 종목은 원화다. */
    symbol: string;
    estimates: FundamentalAnalystEstimateInput | null;
    grades: FundamentalGradesConsensusInput | null;
    /** 분포의 출처. `'yahoo'`일 때만 "현재 애널리스트 N명 기준" 줄을 그린다(FMP 합계는 누적이라 인원 수가 아니다). */
    gradesSource: GradesConsensusSource | null;
    ptConsensus: FundamentalPriceTargetConsensusInput | null;
    ptSummary: FundamentalPriceTargetSummaryInput | null;
    /** Yahoo 집계 목표가 줄. 한국 종목·Yahoo 실패·데이터 없음이면 `null`. */
    analystTargets: AnalystTargetsSummary | null;
    /** Yahoo 평균이 화면의 FMP 컨센서스와 임계값 넘게 다른가. */
    targetSourcesDisagree: boolean;
}

/** 미래 방향 카드. 모든 입력이 비어 있거나 등급이 전부 0이면 빈 상태를 그린다. */
export function FutureDirectionCard({
    symbol,
    estimates,
    grades,
    gradesSource,
    ptConsensus,
    ptSummary,
    analystTargets,
    targetSourcesDisagree,
}: FutureDirectionCardProps) {
    const t = useTranslations('widgets.fundamental');
    const locale = useResolvedLocale();
    const hasPriceTarget =
        ptConsensus !== null || ptSummary !== null || analystTargets !== null;

    if (estimates === null && !hasGrades(grades) && !hasPriceTarget) {
        return (
            <EmptySectionCard
                headingId={HEADING_ID}
                title={t('FutureDirectionCard.c629ac')}
                headingClassName={HEADING_CLASS_NAME}
            />
        );
    }

    return (
        <section
            aria-labelledby={HEADING_ID}
            className={cn(SURFACE_CARD, 'p-6')}
        >
            <h2 id={HEADING_ID} className={HEADING_CLASS_NAME}>
                {t('FutureDirectionCard.2e31de')}
            </h2>

            {estimates !== null && (
                <EstimatesSection
                    estimates={estimates}
                    symbol={symbol}
                    locale={locale}
                />
            )}
            {hasPriceTarget && (
                <PriceTargetSection
                    consensus={ptConsensus}
                    summary={ptSummary}
                    analystTargets={analystTargets}
                    sourcesDisagree={targetSourcesDisagree}
                    symbol={symbol}
                    locale={locale}
                />
            )}
            {hasGrades(grades) && (
                <RatingsSection grades={grades} source={gradesSource} />
            )}
        </section>
    );
}

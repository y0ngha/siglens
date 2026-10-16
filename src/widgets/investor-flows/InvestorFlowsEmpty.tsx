import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';

const HEADING_ID = 'flows-empty-heading';

/**
 * 이 종목에는 수급 데이터가 전혀 없다(신규 상장·CUSIP 미매핑·소형주 등). 장애(degrade)가 아니라 정상 상태라
 * 색인·상태 코드는 그대로고, 화면은 "데이터 없음"을 명시해 빈 화면과 구분한다.
 */
export function InvestorFlowsEmpty({
    collecting = false,
    shortCollecting = false,
}: {
    /** 13F 초기 수집이 아직 안 끝났다 — 스냅샷이 없는 것이 "데이터 없음"이 아니라 "아직 못 모음"일 수 있다. */
    readonly collecting?: boolean;
    /** FINRA가 켜져 있고 공매도 첫 수집도 아직이다 — 본문이 공매도도 함께 말한다. 13F가 수집 중일 때만 의미가 있다. */
    readonly shortCollecting?: boolean;
}) {
    const t = useTranslations('widgets.investor-flows');
    return (
        <section
            aria-labelledby={HEADING_ID}
            className={cn(SURFACE_CARD, 'p-6')}
        >
            <h2 id={HEADING_ID} className={cn('mb-2', HEADING_SECTION)}>
                {collecting ? t('collecting.empty.title') : t('empty.title')}
            </h2>
            <p className="text-sm text-secondary-300">
                {collecting
                    ? shortCollecting
                        ? t('collecting.empty.body')
                        : t('collecting.empty.bodyInstitutionalOnly')
                    : t('empty.body')}
            </p>
        </section>
    );
}

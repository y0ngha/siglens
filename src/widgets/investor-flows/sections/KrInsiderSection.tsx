/**
 * 한국 임원·주요주주 소유 보고 섹션(DART `elestock`).
 */
import { useTranslations } from 'next-intl';
import type { KrInsiderReport } from '@y0ngha/siglens-core';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { cn } from '@/shared/lib/cn';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { FlowTooltip } from '../investorFlowsTooltips';
import { formatInteger } from '../utils/flowFormat';
import { newestKrRows } from '../utils/krDisclosures';
import { InsiderReportRecords } from '../ui/kr/InsiderReportRecords';
import { OmittedNote } from '../ui/notes/OmittedNote';
import { CollectingNotice } from './CollectingNotice';

const HEADING_ID = 'flows-kr-insiders-heading';

interface KrInsiderSectionProps {
    readonly reports: readonly KrInsiderReport[];
    /** DART 초기 수집이 끝나지 않았고 이 종목 공시가 비어 있다. */
    readonly collecting: boolean;
}

/** 수집 중 → 보고 없음 → 목록 순으로 첫 해당 분기만 그린다. */
function InsiderBody({ reports, collecting }: KrInsiderSectionProps) {
    const t = useTranslations('widgets.investor-flows');
    const locale = useResolvedLocale();
    if (collecting) return <CollectingNotice variant="dart" />;
    const { rows, omittedCount } = newestKrRows(reports);
    if (rows.length === 0) {
        return (
            <p className="text-sm text-secondary-300">
                {t('kr.insiders.none')}
            </p>
        );
    }
    return (
        <>
            <InsiderReportRecords rows={rows} />
            {omittedCount > 0 && (
                <OmittedNote>
                    {t('kr.omitted', {
                        count: formatInteger(omittedCount, locale),
                    })}
                </OmittedNote>
            )}
        </>
    );
}

/**
 * 임원·주요주주 소유 보고(DART `elestock`) — 접수일, 보고자·직위, 등기 여부, 주요주주 여부, 소유 주식과 증감, 소유비율과 증감(%p),
 * DART 원문 링크. 보고서에는 증감의 원인(장내 매매·증여·상속·행사)이 없어서 캡션이 그 점을 밝힌다. 좁은 화면은 카드, 넓은 화면은 표다.
 */
export function KrInsiderSection(props: KrInsiderSectionProps) {
    const t = useTranslations('widgets.investor-flows');
    return (
        <section
            aria-labelledby={HEADING_ID}
            data-testid="flows-kr-insiders"
            className={cn(SURFACE_CARD, 'p-6')}
        >
            <h2 id={HEADING_ID} className={cn('mb-1', HEADING_SECTION)}>
                {t('kr.insiders.title')}
                <FlowTooltip term="krInsider" />
            </h2>
            <p className="mb-4 text-xs leading-relaxed text-secondary-400">
                {t('kr.insiders.caption')}
            </p>
            <InsiderBody {...props} />
        </section>
    );
}

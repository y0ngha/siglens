/**
 * 한국 대량보유 보고 섹션(DART `majorstock`).
 */
import { useTranslations } from 'next-intl';
import type { KrMajorHolderReport } from '@y0ngha/siglens-core';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { cn } from '@/shared/lib/cn';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { FlowTooltip } from '../investorFlowsTooltips';
import { formatInteger } from '../utils/flowFormat';
import { buildMajorHolderRows } from '../utils/krMajorHolders';
import { MajorHolderRecords } from '../ui/kr/MajorHolderRecords';
import { OmittedNote } from '../ui/notes/OmittedNote';
import { CollectingNotice } from './CollectingNotice';

const HEADING_ID = 'flows-kr-major-holders-heading';

interface KrMajorHoldersSectionProps {
    readonly reports: readonly KrMajorHolderReport[];
    /** DART 초기 수집이 끝나지 않았고 이 종목 공시가 비어 있다. */
    readonly collecting: boolean;
}

/** 수집 중 → 보고 없음 → 목록 순으로 첫 해당 분기만 그린다. */
function MajorHoldersBody({ reports, collecting }: KrMajorHoldersSectionProps) {
    const t = useTranslations('widgets.investor-flows');
    const locale = useResolvedLocale();
    if (collecting) return <CollectingNotice variant="dart" />;
    const { rows, omittedCount } = buildMajorHolderRows(reports);
    if (rows.length === 0) {
        return (
            <p className="text-sm text-secondary-300">
                {t('kr.majorHolders.none')}
            </p>
        );
    }
    return (
        <>
            <MajorHolderRecords rows={rows} />
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
 * 대량보유 보고(5% 이상, DART `majorstock`) — 접수일, 보고자, 보고 구분(일반·약식), 보유비율과 증감(%p), 보유 주식 증감, 사유,
 * DART 원문 링크. 좁은 화면은 카드, 넓은 화면은 표다(미국 Form 144 표와 같은 구성). 보고 구분은 서식 차이일 뿐 보유 목적을
 * 말하지 않는다는 점을 캡션·풀이로 밝힌다(core도 형식으로 강도를 정하지 않는다).
 */
export function KrMajorHoldersSection(props: KrMajorHoldersSectionProps) {
    const t = useTranslations('widgets.investor-flows');
    return (
        <section
            aria-labelledby={HEADING_ID}
            data-testid="flows-kr-major-holders"
            className={cn(SURFACE_CARD, 'p-6')}
        >
            <h2 id={HEADING_ID} className={cn('mb-1', HEADING_SECTION)}>
                {t('kr.majorHolders.title')}
                <FlowTooltip term="krMajorHolder" />
            </h2>
            <p className="mb-4 text-xs leading-relaxed text-secondary-400">
                {t('kr.majorHolders.caption')}
            </p>
            <MajorHoldersBody {...props} />
        </section>
    );
}

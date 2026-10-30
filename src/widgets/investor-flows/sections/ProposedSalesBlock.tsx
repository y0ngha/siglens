/**
 * 매도 예정 신고(Form 144) 블록 — 수집 중·조회 불가·없음·목록 중 하나를 그린다.
 */
import { useTranslations } from 'next-intl';
import type { ProposedSale } from '@y0ngha/siglens-core';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { cn } from '@/shared/lib/cn';
import { HEADING_SUBSECTION } from '@/shared/lib/typographyStyles';
import { FlowTooltip } from '../investorFlowsTooltips';
import { formatInteger } from '../utils/flowFormat';
import { buildProposedSaleRows } from '../utils/secFilings';
import { ProposedSaleRecords } from '../ui/form144/ProposedSaleRecords';
import { OmittedNote } from '../ui/notes/OmittedNote';
import { CollectingNotice } from './CollectingNotice';

interface ProposedSalesBlockProps {
    /** `undefined` = 이 원천이 스냅샷에 없다(조회 실패). */
    readonly sales: readonly ProposedSale[] | undefined;
    /** 공시 수집이 최근까지 따라잡지 못했다(구간이 비어 있을 때만 참). */
    readonly collecting: boolean;
}

/** 수집 중 → 조회 불가 → 신고 없음 → 목록 순으로 첫 해당 분기만 그린다. */
function ProposedSalesBody({ sales, collecting }: ProposedSalesBlockProps) {
    const t = useTranslations('widgets.investor-flows');
    const locale = useResolvedLocale();
    if (collecting) return <CollectingNotice variant="filings" />;
    if (sales === undefined) {
        return (
            <p className="text-sm text-secondary-300">
                {t('form144.unavailable')}
            </p>
        );
    }
    const { rows, omittedCount } = buildProposedSaleRows(sales);
    if (rows.length === 0) {
        return (
            <p className="text-sm text-secondary-300">{t('form144.none')}</p>
        );
    }
    return (
        <>
            <ProposedSaleRecords sales={rows} />
            {omittedCount > 0 && (
                <OmittedNote>
                    {t('form144.omitted', {
                        count: formatInteger(omittedCount, locale),
                    })}
                </OmittedNote>
            )}
        </>
    );
}

/**
 * 매도 예정 신고(Form 144) — 계열인(임원·이사·대주주)이 주식을 팔기 전에 내는 신고. 신고일, 신고자·관계, 예정 수량·금액,
 * 예정일, 10b5-1 계획 배지, SEC 원문 링크. 신고는 "팔 수 있다"는 예고일 뿐 실제 매도는 Form 4로 따로 나온다는 점을 밝힌다.
 * 좁은 화면은 카드, 넓은 화면은 표다.
 */
export function ProposedSalesBlock(props: ProposedSalesBlockProps) {
    const t = useTranslations('widgets.investor-flows');
    return (
        <div data-testid="flows-form144">
            <h3 className={cn('mb-1', HEADING_SUBSECTION)}>
                {t('form144.title')}
                <FlowTooltip term="form144" />
            </h3>
            <p className="mb-3 text-xs text-secondary-400">
                {t('form144.caption')}
            </p>
            <ProposedSalesBody {...props} />
        </div>
    );
}

/**
 * 대량보유 보고 구분 배지(일반·약식).
 */
import { useTranslations } from 'next-intl';
import type { KrMajorHolderReportForm } from '@y0ngha/siglens-core';

/** 보고 구분은 서식 차이일 뿐 보유 목적을 말하지 않는다. */
export function FormBadge({
    form,
}: {
    readonly form: KrMajorHolderReportForm;
}) {
    const t = useTranslations('widgets.investor-flows');
    // 리터럴 번역 호출로 만들어 두고 고른다(추출기가 키를 볼 수 있게).
    const labels: Record<KrMajorHolderReportForm, string> = {
        detailed: t('kr.majorHolders.formDetailed'),
        abbreviated: t('kr.majorHolders.formAbbreviated'),
    };
    return (
        <span className="inline-flex items-center rounded bg-secondary-700 px-1.5 py-0.5 text-xs font-medium whitespace-nowrap text-secondary-200">
            {labels[form]}
        </span>
    );
}

/**
 * 보유 기관의 변동 상태 배지(신규·증가·감소·청산·유지) — 색 + 기호 + 글자.
 */
import { useTranslations } from 'next-intl';
import type { InstitutionalHolderChangeKind } from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';
import { STATUS_CLASS, STATUS_MARK } from '../../utils/holderStatus';

/** 보유 기관 변동 상태 배지. */
export function StatusBadge({
    change,
}: {
    readonly change: InstitutionalHolderChangeKind;
}) {
    const tStatus = useTranslations('widgets.investor-flows.status');
    const labels: Record<InstitutionalHolderChangeKind, string> = {
        new: tStatus('new'),
        increased: tStatus('increased'),
        decreased: tStatus('decreased'),
        exited: tStatus('exited'),
        unchanged: tStatus('unchanged'),
    };
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium',
                STATUS_CLASS[change]
            )}
        >
            <span aria-hidden="true">{STATUS_MARK[change]}</span>
            {labels[change]}
        </span>
    );
}

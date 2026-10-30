'use client';

import { useTranslations } from 'next-intl';
import { symbolLabel } from '@/shared/lib/symbolLabel';
import { trimTrailingZeros } from '@/shared/lib/trimTrailingZeros';
import type {
    PortfolioHoldingView,
    RawHoldingInput,
    SavePortfolioResult,
} from '@/entities/portfolio/model';
import { useHoldingRowFocus } from '../hooks/useHoldingRowFocus';
import { ACTION_BUTTON, DANGER_BUTTON, ROW_CHROME } from '../lib/holdingStyles';
import { HoldingForm } from './HoldingForm';

interface HoldingRowProps {
    holding: PortfolioHoldingView;
    isEditing: boolean;
    isConfirmingDelete: boolean;
    /** 이 행의 삭제 요청이 진행 중인지. 다른 행의 삭제는 이 행을 잠그지 않는다. */
    isDeleting: boolean;
    deleteError: string | null;
    onStartEdit: (symbol: string) => void;
    onCancelEdit: (symbol: string) => void;
    onSaveEdit: (
        symbol: string,
        input: RawHoldingInput
    ) => Promise<SavePortfolioResult>;
    onRequestDelete: (symbol: string) => void;
    onCancelDelete: (symbol: string) => void;
    onConfirmDelete: (symbol: string) => void;
}

/**
 * `PortfolioSection` 목록의 한 행. 표시 모드(수정·삭제 버튼), 인라인 삭제 확인, 인라인 편집 폼을
 * 오가며, 모드가 바뀔 때 포커스를 새 컨트롤로 넘긴다(`useHoldingRowFocus`).
 */
export function HoldingRow({
    holding,
    isEditing,
    isConfirmingDelete,
    isDeleting,
    deleteError,
    onStartEdit,
    onCancelEdit,
    onSaveEdit,
    onRequestDelete,
    onCancelDelete,
    onConfirmDelete,
}: HoldingRowProps) {
    const t = useTranslations('features.portfolio-management');
    const { editButtonRef, deleteButtonRef, confirmDeleteButtonRef } =
        useHoldingRowFocus({ isEditing, isConfirmingDelete });
    const { symbol } = holding;

    if (isEditing) {
        return (
            <li className={ROW_CHROME}>
                <HoldingForm
                    initial={holding}
                    onSubmit={input => onSaveEdit(symbol, input)}
                    onCancel={() => onCancelEdit(symbol)}
                    autoFocusFirstField
                />
            </li>
        );
    }

    return (
        <li className={ROW_CHROME}>
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <div className="truncate font-semibold text-secondary-100">
                        {symbolLabel(symbol, holding.companyName)}
                    </div>
                    <div className="mt-0.5 text-sm text-secondary-400 tabular-nums">
                        {t('PortfolioSection.91d7d2', {
                            v0: trimTrailingZeros(holding.quantity),
                            v1: trimTrailingZeros(holding.averagePrice),
                        })}
                    </div>
                </div>

                {/* 두 묶음에 key를 줘 모드 전환을 재마운트로 만든다. 없으면 React가 같은 자리의 버튼
                    노드를 재사용해 포커스가 우연히 엉뚱한 버튼에 남고, 포커스 이동이 훅이 아니라
                    자식 순서에 달린다. */}
                {isConfirmingDelete ? (
                    <div
                        key="confirm"
                        className="flex shrink-0 items-center gap-2"
                    >
                        <span className="text-xs text-secondary-400">
                            {t('PortfolioSection.ac4dd7')}
                        </span>
                        {/* 누른 채 진행 중이 되는 버튼이라 disabled 대신 aria-disabled다(REACT.md#AX-3) —
                            disabled면 실패했을 때 포커스가 body에 남는다. */}
                        <button
                            ref={confirmDeleteButtonRef}
                            type="button"
                            onClick={() => {
                                if (!isDeleting) onConfirmDelete(symbol);
                            }}
                            aria-disabled={isDeleting || undefined}
                            aria-busy={isDeleting}
                            className={DANGER_BUTTON}
                        >
                            {isDeleting
                                ? t('PortfolioSection.283e16')
                                : t('PortfolioSection.eca4ac')}
                        </button>
                        <button
                            type="button"
                            onClick={() => onCancelDelete(symbol)}
                            disabled={isDeleting}
                            className={ACTION_BUTTON}
                        >
                            {t('PortfolioSection.19b2d1')}
                        </button>
                    </div>
                ) : (
                    <div
                        key="actions"
                        className="flex shrink-0 items-center gap-2"
                    >
                        <button
                            ref={editButtonRef}
                            type="button"
                            onClick={() => onStartEdit(symbol)}
                            aria-label={t('PortfolioSection.editHolding', {
                                v0: symbol,
                            })}
                            className={ACTION_BUTTON}
                        >
                            {t('PortfolioSection.e1407b')}
                        </button>
                        <button
                            ref={deleteButtonRef}
                            type="button"
                            onClick={() => onRequestDelete(symbol)}
                            aria-label={t('PortfolioSection.deleteHolding', {
                                v0: symbol,
                            })}
                            className={DANGER_BUTTON}
                        >
                            {t('PortfolioSection.fc81e2')}
                        </button>
                    </div>
                )}
            </div>
            <div role="alert" className="min-h-5 text-sm">
                {deleteError && (
                    <span className="text-ui-danger-text">{deleteError}</span>
                )}
            </div>
        </li>
    );
}

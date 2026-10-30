'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';
import {
    HEADING_SECTION,
    HEADING_SUBSECTION,
} from '@/shared/lib/typographyStyles';
import { usePortfolioSection } from '../hooks/usePortfolioSection';
import { ACTION_BUTTON } from '../lib/holdingStyles';
import { HoldingForm } from './HoldingForm';
import { HoldingRow } from './HoldingRow';
import { HoldingsSkeleton } from './HoldingsSkeleton';

const EMPTY_PANEL =
    'rounded-lg border border-dashed border-secondary-700 px-4 py-6 text-center text-sm text-secondary-400';

interface PortfolioSectionProps {
    /**
     * 추가 폼의 시작 심볼. `/portfolio`가 `/[symbol]/position`의 CTA에서 넘어온
     * `?symbol=` 쿼리를 그대로 넘긴다.
     */
    defaultSymbol?: string;
    /**
     * 저장·삭제 성공 직후 호출된다. `/portfolio`는 같은 보유종목을 서버에서 읽어
     * 위치 카드를 그리므로, 여기서 `router.refresh()`를 걸어 카드를 다시 맞춘다.
     */
    onHoldingsChange?: () => void;
}

/** Section for managing the member's portfolio holdings: list + inline edit + inline delete confirm + add form. */
export function PortfolioSection({
    defaultSymbol,
    onHoldingsChange,
}: PortfolioSectionProps = {}) {
    const t = useTranslations('features.portfolio-management');
    const {
        holdings,
        listView,
        refetch,
        headingRef,
        statusMessage,
        editingSymbol,
        confirmingDeleteSymbol,
        deletingSymbol,
        deleteError,
        startEdit,
        cancelEdit,
        saveEdit,
        requestDelete,
        cancelDelete,
        confirmDelete,
        addHolding,
    } = usePortfolioSection({ onHoldingsChange });
    const isListSettled = listView === 'empty' || listView === 'list';

    return (
        <div className="space-y-4">
            <div>
                <h2
                    ref={headingRef}
                    tabIndex={-1}
                    className={cn(
                        HEADING_SECTION,
                        'rounded focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none'
                    )}
                >
                    {t('PortfolioSection.cae421')}
                </h2>
                <p className="mt-1 text-sm text-secondary-400">
                    {t('PortfolioSection.060e90')}
                </p>
            </div>

            <div role="status" aria-live="polite" className="min-h-5 text-sm">
                {statusMessage && (
                    <span className="text-ui-success-text">
                        {statusMessage}
                    </span>
                )}
            </div>

            {listView === 'loading' && <HoldingsSkeleton />}

            {listView === 'error' && (
                <div role="alert" className={EMPTY_PANEL}>
                    <p>{t('PortfolioSection.4e29b2')}</p>
                    <button
                        type="button"
                        onClick={refetch}
                        className={cn(ACTION_BUTTON, 'mt-3')}
                    >
                        {t('PortfolioSection.0c767c')}
                    </button>
                </div>
            )}

            {listView === 'empty' && (
                <p className={EMPTY_PANEL}>{t('PortfolioSection.20b566')}</p>
            )}

            {listView === 'list' && (
                <ul className="space-y-2">
                    {holdings.map(holding => (
                        <HoldingRow
                            key={holding.symbol}
                            holding={holding}
                            isEditing={editingSymbol === holding.symbol}
                            isConfirmingDelete={
                                confirmingDeleteSymbol === holding.symbol
                            }
                            isDeleting={deletingSymbol === holding.symbol}
                            deleteError={
                                deleteError?.symbol === holding.symbol
                                    ? deleteError.message
                                    : null
                            }
                            onStartEdit={startEdit}
                            onCancelEdit={cancelEdit}
                            onSaveEdit={saveEdit}
                            onRequestDelete={requestDelete}
                            onCancelDelete={cancelDelete}
                            onConfirmDelete={confirmDelete}
                        />
                    ))}
                </ul>
            )}

            {isListSettled && (
                <div className="space-y-2 border-t border-secondary-700 pt-4">
                    <h3 className={HEADING_SUBSECTION}>
                        {t('PortfolioSection.0a4e7f')}
                    </h3>
                    <HoldingForm
                        defaultSymbol={defaultSymbol}
                        onSubmit={addHolding}
                    />
                </div>
            )}
        </div>
    );
}

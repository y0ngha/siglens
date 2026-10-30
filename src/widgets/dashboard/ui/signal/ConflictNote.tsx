/**
 * 상충 신호 종목의 상승·하락 건수 안내.
 */
import { useTranslations } from 'next-intl';
import type { ConflictInfo } from '@y0ngha/siglens-core';

interface ConflictNoteProps {
    conflict: ConflictInfo;
}

/** "상승 N건 / 하락 M건 감지". */
export function ConflictNote({ conflict }: ConflictNoteProps) {
    const t = useTranslations('widgets.dashboard');
    return (
        <p className="mt-1 text-xs text-secondary-500">
            {t('SignalStockCard.fe2ec0', {
                v0: conflict.bullishCount,
                v1: conflict.bearishCount,
            })}
        </p>
    );
}

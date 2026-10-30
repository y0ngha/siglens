/**
 * 보유 기관의 변화 문구 — 변화 주식 수와 변화율.
 */
import { useTranslations } from 'next-intl';
import type { InstitutionalHolderChange } from '@y0ngha/siglens-core';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import {
    formatSignedCompact,
    formatSignedPercent,
} from '../../utils/flowFormat';
import {
    holderChangePercent,
    holderChangeShares,
} from '../../utils/institutional';

/** 변화 주식 수 + 변화율(직전 보유가 없으면 율은 생략). 변화가 없으면 "변동 없음"이다. */
export function HolderChangeText({
    holder,
}: {
    readonly holder: InstitutionalHolderChange;
}) {
    const t = useTranslations('widgets.investor-flows');
    const locale = useResolvedLocale();
    if (holder.change === 'unchanged') return <>{t('holders.noChange')}</>;
    const pct = holderChangePercent(holder);
    return (
        <>
            {formatSignedCompact(holderChangeShares(holder), locale)}
            {pct !== null && (
                <span className="text-secondary-400">
                    {' '}
                    ({formatSignedPercent(pct, locale)})
                </span>
            )}
        </>
    );
}

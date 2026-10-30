/** Asset-owner badge for a trades-table row. */
import { useTranslations } from 'next-intl';
import type { CongressOwner } from '@y0ngha/siglens-core';
import { OWNER_LABEL } from '../../utils/tradeLabels';

interface OwnerBadgeProps {
    owner: CongressOwner;
}

/** Renders nothing for an undisclosed owner; the sentinel is checked before translating (see `SideBadge`). */
export function OwnerBadge({ owner }: OwnerBadgeProps) {
    const tLabel = useTranslations('shared.enumLabel');
    const ownerKey = OWNER_LABEL[owner];
    if (!ownerKey) return null;
    return (
        <span className="rounded bg-secondary-700 px-1.5 py-0.5 text-xs text-secondary-300">
            {tLabel(ownerKey)}
        </span>
    );
}

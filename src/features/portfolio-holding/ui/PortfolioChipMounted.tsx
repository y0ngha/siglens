'use client';

import { useCurrentUser } from '@/entities/auth';
import { PortfolioChip } from './PortfolioChip';

interface PortfolioChipMountedProps {
    symbol: string;
}

/**
 * Presence-gates the holding chip on an authenticated member. `useCurrentUser`
 * resolves to `undefined` while the login check is in flight and `null` for a
 * guest — both hide the chip; only a present user (a resolved, non-null
 * record) sees it. This mirrors PortfolioSection being an account-page (member
 * only) surface — holdings are a member-only feature.
 */
export function PortfolioChipMounted({ symbol }: PortfolioChipMountedProps) {
    const { data } = useCurrentUser();
    if (!data) return null;
    return <PortfolioChip symbol={symbol} />;
}

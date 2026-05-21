import type { OptionsChain, OptionsSnapshot } from '@y0ngha/siglens-core';
import type { OptionsExpirationSelector } from '@/domain/options/types';

/**
 * Pick the chain to display for a given selector value.
 *
 * The options page shares one selection axis across three rendering
 * surfaces (metrics row, OI chart, chain table). Each surface used to
 * carry its own copy of this lookup; centralizing here keeps the rule
 * — `"all"` falls back to the nearest expiration, otherwise prefer an
 * exact match (with nearest as the safety net) — in one place.
 *
 * Returns `null` when the snapshot has no chains at all (caller renders
 * an empty-state).
 */
export function pickActiveChain(
    snapshot: OptionsSnapshot,
    expirationDate: OptionsExpirationSelector
): OptionsChain | null {
    const chains = snapshot.chains;
    if (chains.length === 0) return null;
    const nearestChain = chains[0];
    if (expirationDate === 'all') return nearestChain;
    return (
        chains.find(c => c.expirationDate === expirationDate) ?? nearestChain
    );
}

import type { OptionsExpirationSelector } from '@/shared/lib/types';

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
 *
 * 체인 타입에 대해 제네릭이다 — 서버의 전체 `OptionsSnapshot`과 클라이언트로 투영된
 * `ClientOptionsSnapshot`이 같은 규칙을 쓴다.
 */
export function pickActiveChain<C extends { expirationDate: string }>(
    snapshot: { chains: ReadonlyArray<C> },
    expirationDate: OptionsExpirationSelector
): C | null {
    const chains = snapshot.chains;
    if (chains.length === 0) return null;
    const nearestChain = chains[0];
    if (expirationDate === 'all') return nearestChain;
    return (
        chains.find(c => c.expirationDate === expirationDate) ?? nearestChain
    );
}

import 'server-only';
import type { Tier } from '@y0ngha/siglens-core';
import { resolveTierOnly } from '@/shared/lib/byokGate';

/** Pilot: the model is fixed (free class) so only the tier is needed for quotas. P3 swaps in `resolveTierAndByok`. */
export function resolveAgentTier(userId: string): Promise<Tier> {
    return resolveTierOnly(userId);
}

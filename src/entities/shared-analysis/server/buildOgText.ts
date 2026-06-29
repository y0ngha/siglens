import type { SharedAnalysisSnapshot } from '../types';
import { SHARE_KIND_OG_BUILDERS, type OgText } from './kindServerRegistry';

export type { OgText };

/**
 * kind별 방향성+요약 텍스트. 스펙 §6-1 필드 매핑.
 *
 * Thin dispatcher over `SHARE_KIND_OG_BUILDERS` — the per-kind logic lives in
 * `kindServerRegistry.ts` which enforces compile-time exhaustiveness via
 * `satisfies Record<ShareableKind, ...>`.
 */
export function buildOgText(snapshot: SharedAnalysisSnapshot): OgText {
    const r = snapshot.result as unknown as Record<string, unknown>;
    const builder = SHARE_KIND_OG_BUILDERS[snapshot.kind];
    return builder(r, snapshot.symbol);
}

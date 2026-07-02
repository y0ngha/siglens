import { SHAREABLE_KIND_VALUES } from '@/shared/db/constants';
import type { SharedAnalysisSnapshot } from '../types';

function isShareableKind(v: unknown): v is SharedAnalysisSnapshot['kind'] {
    return (
        typeof v === 'string' &&
        // const array widened to readonly string[] so .includes() accepts a plain string argument
        (SHAREABLE_KIND_VALUES as readonly string[]).includes(v)
    );
}

/**
 * jsonb로 저장된 스냅샷을 검증하고 타입을 좁힌다. 형태 불일치면 null.
 *
 * Trust boundary: result-interior validation (e.g. that result.trend matches kind
 * 'chart') is intentionally delegated to the error boundary in app/share/error.tsx.
 * Snapshots are server-written from inputs already validated by isValidShareInput,
 * so per-kind structural checks here would be redundant defence-in-depth with no
 * practical benefit given the controlled write path.
 *
 * `chartBars` is optional and chart-specific; it passes through transparently
 * because the read path trusts server-written snapshots and the error boundary
 * handles any malformed structure at render time.
 */
export function parseSnapshot(raw: unknown): SharedAnalysisSnapshot | null {
    if (typeof raw !== 'object' || raw === null) return null;
    // guarded by the typeof + null check just above; safe to treat as a plain object map
    const obj = raw as Record<string, unknown>;
    if (!isShareableKind(obj.kind)) return null;
    if (typeof obj.symbol !== 'string') return null;
    if (typeof obj.context !== 'object' || obj.context === null) return null;
    if (typeof obj.result !== 'object' || obj.result === null) return null;
    // Only the top-level shape (kind, symbol, context, result presence) is
    // validated here. Per-kind result-interior validation (e.g. that
    // result.trend matches kind 'chart'), chartBars interior structure, and
    // snapshot schema version drift are intentionally delegated to the error
    // boundary in app/share/error.tsx.
    //
    // Rationale: snapshots are server-written from inputs already checked by
    // isValidShareInput, so deeper structural checks here would be redundant.
    // Version drift (future schema changes) is also handled by the error
    // boundary — if a stale snapshot shape causes a render error, the boundary
    // shows a graceful fallback rather than a hard crash.
    //
    // chartBars (optional Bar[]) passes through transparently — it is either
    // absent (non-chart or pre-bars snapshots) or an array validated at write
    // time by isValidBar inside isValidShareInput.
    return obj as unknown as SharedAnalysisSnapshot;
}

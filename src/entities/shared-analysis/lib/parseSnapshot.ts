import { SHAREABLE_KIND_VALUES } from '@/shared/db/constants';
import type { SharedAnalysisSnapshot } from '../types';

function isShareableKind(v: unknown): v is SharedAnalysisSnapshot['kind'] {
    return (
        typeof v === 'string' &&
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
    const obj = raw as Record<string, unknown>;
    if (!isShareableKind(obj.kind)) return null;
    if (typeof obj.symbol !== 'string') return null;
    if (typeof obj.context !== 'object' || obj.context === null) return null;
    if (typeof obj.result !== 'object' || obj.result === null) return null;
    // Safe: all structural invariants (kind, symbol, context, result) have been
    // verified above by the guard checks; the cast narrows the runtime-validated
    // object to the typed snapshot without further re-validation.
    // chartBars (optional Bar[]) passes through transparently — it is either absent
    // (old snapshots without bars) or an array validated at write time.
    return obj as unknown as SharedAnalysisSnapshot;
}

import { SHAREABLE_KIND_VALUES } from '@/shared/db/constants';
import type { SharedAnalysisSnapshot } from '../types';

function isShareableKind(v: unknown): v is SharedAnalysisSnapshot['kind'] {
    return (
        typeof v === 'string' &&
        (SHAREABLE_KIND_VALUES as readonly string[]).includes(v)
    );
}

/** jsonb로 저장된 스냅샷을 검증하고 타입을 좁힌다. 형태 불일치면 null. */
export function parseSnapshot(raw: unknown): SharedAnalysisSnapshot | null {
    if (typeof raw !== 'object' || raw === null) return null;
    const obj = raw as Record<string, unknown>;
    if (!isShareableKind(obj.kind)) return null;
    if (typeof obj.symbol !== 'string') return null;
    if (typeof obj.context !== 'object' || obj.context === null) return null;
    if (typeof obj.result !== 'object' || obj.result === null) return null;
    return obj as unknown as SharedAnalysisSnapshot;
}

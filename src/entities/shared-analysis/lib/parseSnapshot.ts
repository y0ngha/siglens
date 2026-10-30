import { SHAREABLE_KIND_VALUES } from '@/shared/db/constants';
import type { SharedAnalysisSnapshot } from '../types';

function isShareableKind(v: unknown): v is SharedAnalysisSnapshot['kind'] {
    return (
        typeof v === 'string' &&
        // readonly 튜플을 string[]으로 넓혀야 임의 string을 includes에 넘길 수 있다
        (SHAREABLE_KIND_VALUES as readonly string[]).includes(v)
    );
}

function isObjectValue(v: unknown): v is object {
    return typeof v === 'object' && v !== null;
}

function isSnapshotShape(raw: unknown): raw is SharedAnalysisSnapshot {
    return (
        isObjectValue(raw) &&
        'kind' in raw &&
        isShareableKind(raw.kind) &&
        'symbol' in raw &&
        typeof raw.symbol === 'string' &&
        'context' in raw &&
        isObjectValue(raw.context) &&
        'result' in raw &&
        isObjectValue(raw.result)
    );
}

/**
 * jsonb로 저장된 스냅샷을 검증하고 타입을 좁힌다. 형태 불일치면 null.
 * `getSharedAnalysisAction`이 읽기 경로에서 쓴다.
 *
 * 최상위 형태(kind, symbol, context, result 존재)만 확인한다. kind별 result 내부,
 * `chartBars` 내부, 스냅샷 스키마 버전 드리프트는 의도적으로 `app/share/error.tsx`
 * 에러 경계에 맡긴다: 스냅샷은 `isValidShareInput`을 통과한 입력으로 서버가 쓴 값이라
 * 여기서 더 깊게 검사해도 중복 방어일 뿐이고, 렌더 오류는 경계가 폴백 화면으로 받는다.
 * `chartBars`(선택)는 쓰기 시점에 `isValidShareInput`이 검증했으므로 그대로 통과한다.
 */
export function parseSnapshot(raw: unknown): SharedAnalysisSnapshot | null {
    return isSnapshotShape(raw) ? raw : null;
}

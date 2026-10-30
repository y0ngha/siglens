/**
 * 오류 코드 표의 행. 오류 카탈로그(`API_ERROR_DOCS`, OpenAPI 문서와 같은 소스)를 화면 행 모양으로 바꾼다 —
 * UI 파일이 entity `lib/`을 직접 읽지 않도록 이 모듈이 그 사이를 잇는다.
 */

import { API_ERROR_DOCS } from '@/entities/siglens-api-key/lib/apiErrorCatalog';
import type { InfoRow } from '../types';

/**
 * 상태 코드 순으로, 같은 상태 안에서는 카탈로그 순서 그대로 정렬한 행. 카탈로그가 `streamed`로 표시한 코드
 * (`run_fresh_analysis`가 스트림 안에서 낼 수 있는 것)에만 `streamedNote`를 보충 문장으로 붙인다.
 */
export function buildErrorRows(streamedNote: string): readonly InfoRow[] {
    return API_ERROR_DOCS.toSorted((a, b) => a.status - b.status).map(doc => ({
        term: `${doc.status} ${doc.code}`,
        body: doc.summary,
        ...(doc.streamed === true ? { note: streamedNote } : {}),
    }));
}

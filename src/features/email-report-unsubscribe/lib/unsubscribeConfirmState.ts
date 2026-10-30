import type {
    UnsubscribeEmailReportInput,
    UnsubscribeEmailReportResult,
} from '@/entities/email-report/model';

/**
 * 수신거부 확인 화면의 순수 상태 도출 — 링크 쿼리 해석과 오류 문구 선택.
 * 쿼리 키(`u`, `sig`)는 메일 링크 빌더(`entities/email-report/lib/reportLinks.ts`)와 맞춘다.
 */

/** 쿼리 읽기에 필요한 `URLSearchParams`의 최소 표면. `ReadonlyURLSearchParams`도 받는다. */
type SearchParamsReader = Pick<URLSearchParams, 'get'>;

/** 링크의 회원 id·서명. 하나라도 비면 잘못된 링크로 보고 `null`을 돌려준다. */
export function readUnsubscribeInput(
    params: SearchParamsReader
): UnsubscribeEmailReportInput | null {
    const userId = params.get('u') ?? '';
    const signature = params.get('sig') ?? '';
    if (userId.length === 0 || signature.length === 0) return null;
    return { userId, signature };
}

/**
 * 보일 오류 문구. 서버가 돌려준 오류 결과는 그 문구를, 요청 자체가 실패(네트워크 등)하면
 * `fallback`을, 오류가 없으면 `null`.
 */
export function resolveUnsubscribeErrorMessage(
    result: UnsubscribeEmailReportResult | undefined,
    requestFailed: boolean,
    fallback: string
): string | null {
    if (result?.status === 'error') return result.message;
    if (requestFailed) return fallback;
    return null;
}

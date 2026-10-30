/** 응답 `meta`에 실리는, 분석 도구만 쓰는 필드. `source`는 공유 캐시 적중(`cache`)인지 새로 만들었는지(`fresh`). */
export interface PublicToolMeta {
    source?: 'cache' | 'fresh';
    model?: string;
}

/** 도구 실행의 최종 결과 — 성공 데이터 또는 HTTP로 매핑할 실패. */
export type PublicToolOutcome =
    | { ok: true; data: unknown; truncated: boolean; meta?: PublicToolMeta }
    | {
          ok: false;
          status: number;
          code: string;
          message: string;
          details?: unknown;
          /** 429의 `Retry-After`·한도 헤더처럼 오류 응답에 실을 헤더. */
          headers?: Record<string, string>;
      };

/**
 * 사전 검사(인증·한도·모델·키·캐시 미스)를 모두 통과한 **긴 생성**. 라우트가 이 결과를 받으면 200 + 공백
 * heartbeat 스트림으로 응답하고, `completion`이 끝나면 최종 JSON을 쓴다. 이 시점 이후의 실패는 상태 코드를
 * 바꿀 수 없어 200 본문의 `{ error }`로 나간다.
 */
export interface PublicToolStream {
    streaming: true;
    completion: Promise<PublicToolOutcome>;
    /** 스트림 시작 시점에 이미 아는 응답 헤더(소비한 `ai` 버킷의 `X-RateLimit-AI-*`). */
    headers?: Record<string, string>;
}

/** 실행기가 돌려주는 값 — 즉시 결과이거나 긴 생성 스트림. */
export type PublicToolResult = PublicToolOutcome | PublicToolStream;

/** 긴 생성 스트림인지 가르는 타입 가드. */
export function isPublicToolStream(
    result: PublicToolResult
): result is PublicToolStream {
    return 'streaming' in result;
}

/** `truncateToolResult`가 크기 상한에 걸렸을 때 만드는 `{ truncated: true, preview }` 봉투인지. */
export function isTruncatedEnvelope(value: unknown): boolean {
    if (typeof value !== 'object' || value === null || Array.isArray(value))
        return false;
    return (
        'truncated' in value &&
        value.truncated === true &&
        'preview' in value &&
        typeof value.preview === 'string'
    );
}

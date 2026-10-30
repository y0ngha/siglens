import type { NormalizedUsage } from '../lib/usage';

/** `[Usage]` 한 줄에 실리는 필드. 키·프롬프트·사용자 식별자는 의도적으로 없다. */
export interface UsageLogFields extends NormalizedUsage {
    /**
     * 호출을 만든 곳. `callAiProviderRouter`로 보낸 호출은 `'chat'`, 어댑터를 직접 부르는
     * 호출자는 자기 라벨(예: `'translate'`)을 쓴다. core는 분석 경로에서
     * `'<SYMBOL>:<jobType>'`을 써서 세 표면이 한 쿼리에서 구분된다.
     */
    jobId: string;
    model: string;
    latencyMs: number;
}

/**
 * 정규화된 `[Usage]` 텔레메트리를 순수 JSON 한 줄로 낸다. 마커는 앞 문자열 인자가 아니라
 * `tag` 필드에 실어, CloudWatch JSON 메트릭 필터(`{ $.tag = "[Usage]" && $.jobId = "agent" }`)가
 * `outputTokens`를 바로 뽑게 한다. 로그 줄에 `[Usage]` 문자열이 그대로 있으므로 기존
 * `like /\[Usage\]/` Logs Insights 쿼리는 이 형식과 core의 2-인자
 * `console.info('[Usage]', json)` 분석 경로 형식을 모두 계속 잡는다.
 */
export function logUsage(fields: UsageLogFields): void {
    console.info(JSON.stringify({ tag: '[Usage]', ...fields }));
}

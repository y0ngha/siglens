import type { ModelId } from '@y0ngha/siglens-core';

/**
 * 제공사가 지원을 종료했거나 core 로스터에서 빠진 모델 → 그 후속 모델.
 *
 * 저장된 모델 선택(브라우저 localStorage의 분석 모델, `users.api_default_model`)이 퇴역 ID를
 * 가리킬 때 어디서나 같은 후속 모델로 옮기도록 매핑을 한 곳에 둔다. 순수 데이터라 서버·브라우저
 * 어디서나 import할 수 있다(`server-only`·I/O 없음).
 *
 * 키는 레지스트리에서 빠진 값이라 `ModelId`로 표현할 수 없어 리터럴이다. 이 목록은 "지금 고를 수 있는
 * 모델"이 아니라 "예전에 저장됐을 수 있는 문자열"이므로, 레지스트리가 바뀌어도 키를 따라 바꾸면 안
 * 된다 — 바꾸는 순간 저장값이 겨냥하던 사용자를 놓친다. 값은 반드시 활성 모델이어야 한다(테스트가 확인).
 *
 * `gemini-3.7-flash`는 2026-10 Google이 지원을 종료하고 `gemini-3.8-flash`로 리다이렉트한다(가격 동일).
 * 그냥 두면 allowlist 검증에서 탈락해 기본 모델(DeepSeek)로 떨어지므로, 사용자가 고른 계열을 유지하도록
 * 후속 모델로 옮긴다.
 */
export const RETIRED_MODEL_SUCCESSORS: ReadonlyMap<string, ModelId> = new Map([
    ['gemini-3.7-flash', 'gemini-3.8-flash'],
    // 2026-10 모델 로스터 교체 — 같은 등급(free/member)의 후속 모델로 옮긴다.
    ['claude-haiku-4-5', 'claude-haiku-5-5'],
    ['claude-sonnet-5', 'claude-sonnet-5-5'],
    ['gpt-5.6-luna', 'gpt-6-luna'],
    ['gpt-5.6-terra', 'gpt-6-sol'],
    // 2026-11 로스터 교체 — 같은 계열·같은 추론 하한의 후속 모델(byok)로 옮긴다.
    ['claude-fable-5-1', 'claude-fable-5-2'],
    ['gpt-6.1-sol', 'gpt-6.2-sol'],
    ['gpt-6-astra', 'gpt-6.2-astra'],
]);

/**
 * 퇴역 모델 ID면 후속 모델 ID를, 아니면(활성 모델이든 모르는 값이든) 입력을 그대로 돌려준다.
 * 유효성 판정은 하지 않는다 — 호출부가 결과를 로스터로 다시 검증한다.
 */
export function resolveRetiredModelId(id: string): string {
    return RETIRED_MODEL_SUCCESSORS.get(id) ?? id;
}

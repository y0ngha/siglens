/**
 * Ask-AI FAB이 `ai.siglens.io` 입력창에 미리 채울 질문을 고르는 순수 헬퍼.
 */

/**
 * 프리필 질문의 출처 — 둘 중 하나만 준다.
 *  - `name`: 종목 표시명. 종목 페이지의 "지금 어떤 상황인지" 질문에 끼워 넣는다.
 *  - `question`: 완성된 질문 문장. 호출부가 이미 로케일에 맞게 만든 것을 그대로 쓴다
 *    (차트 가이드 항목: "가이드: {제목}. …").
 */
export type AskAiFabSource =
    | { name: string; question?: never }
    | { question: string; name?: never };

/**
 * 출처에서 프리필 질문 문장을 만든다. `question`이 있으면 그대로, 없으면 `name`을
 * `formatNameQuestion`(번역 문구)에 끼운다.
 *
 * 문구 생성은 콜백으로 받아 `name` 변형일 때만 부른다 — `question` 변형에서
 * 번역기를 `name: undefined`로 호출하지 않는다.
 */
export function resolveAskAiPrefill(
    source: AskAiFabSource,
    formatNameQuestion: (name: string) => string
): string {
    // 구조 분해하면 두 변형의 상관이 끊겨 `name`이 `string | undefined`로 넓어진다.
    // `source` 째로 `question` 유무를 갈라 TS가 else 가지의 `name: string`을 알게 한다.
    if (source.question !== undefined) return source.question;
    return formatNameQuestion(source.name);
}

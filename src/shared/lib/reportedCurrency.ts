/**
 * 공시자가 재무제표를 표기하는 통화의 ISO 코드로 정규화한다. 공백만 있거나 비어 있으면
 * `null` — 알 수 없는 통화를 잘못된 코드로 단정하면 core가 금액 옆에 오답 통화를 붙이므로,
 * 모르는 채로 두어 금액에 라벨을 아예 안 붙이는 쪽을 택한다.
 *
 * ADR(TSM 등)은 상장 통화(USD)가 아니라 본국 통화로 보고하므로, 상장 통화를 대신
 * 넣으면 금액이 수십 배 틀린다 — 반드시 공급자가 준 보고 통화 원본을 정규화해서 쓴다.
 */
export function normalizeReportedCurrency(
    value: string | null | undefined
): string | null {
    return value?.trim() || null;
}

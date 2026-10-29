/**
 * 상세 분석 스위치의 조작 모드 판정. 클릭·접근성 이름·스타일이 모두 이 한 값으로 갈린다.
 */

/**
 * - `disabled`: 고른 모델이 추론을 지원하지 않는다. 클릭해도 아무 일도 없다.
 * - `locked`: 비회원. 클릭하면 토글 대신 회원가입 넛지를 연다.
 * - `interactive`: 회원. 클릭하면 값을 뒤집는다.
 */
export type ReasoningSwitchMode = 'disabled' | 'locked' | 'interactive';

interface ReasoningSwitchModeInput {
    /** 회원이라 기능을 쓸 수 있는지. */
    canUse: boolean;
    /** 조작 자체가 무의미한지(추론 미지원 모델 등). */
    disabled: boolean;
}

/**
 * `disabled`가 `locked`보다 우선한다 — 가입해도 열리지 않는 모델에서 가입 넛지를
 * 띄우거나 "가입하면 사용할 수 있다"고 읽어 주면 거짓 약속이 된다.
 */
export function getReasoningSwitchMode({
    canUse,
    disabled,
}: ReasoningSwitchModeInput): ReasoningSwitchMode {
    if (disabled) return 'disabled';
    if (!canUse) return 'locked';
    return 'interactive';
}

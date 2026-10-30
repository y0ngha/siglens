/**
 * 데스크톱 자동완성(편집 가능한 combobox)의 키 규칙. WAI-ARIA APG의 "Combobox with
 * Listbox Popup" 패턴을 따른다 — 포커스는 늘 입력에 있고, 활성 옵션은
 * `aria-activedescendant`로만 가리킨다.
 */

/** 활성 옵션을 한 칸씩 옮기는 키. */
export type OptionStepKey = 'ArrowDown' | 'ArrowUp';

const OPTION_STEP: Record<
    OptionStepKey,
    (current: number, count: number) => number
> = {
    // 마지막 옵션에서 멈춘다(순환하지 않는다).
    ArrowDown: (current, count) => Math.min(current + 1, count - 1),
    // 첫 옵션 위는 -1(입력으로 돌아온 상태)이다.
    ArrowUp: current => Math.max(current - 1, -1),
};

/** `key`가 활성 옵션을 옮기는 키인지. */
export function isOptionStepKey(key: string): key is OptionStepKey {
    return Object.hasOwn(OPTION_STEP, key);
}

/**
 * 다음 활성 옵션 인덱스. -1은 "활성 옵션 없음"이다. 옵션이 없으면 늘 -1이다.
 */
export function stepOptionIndex(
    key: OptionStepKey,
    current: number,
    count: number
): number {
    return OPTION_STEP[key](current, count);
}

/**
 * 입력 안에서 캐럿을 옮기는 키. 편집 가능한 combobox에서 이 키는 활성 옵션을 해제하고
 * 입력 편집으로 돌아간다(APG) — 기본 동작(캐럿 이동)은 막지 않는다. 해제하지 않으면
 * 캐럿을 옮긴 뒤의 Enter가 화면에서 잊힌 옵션으로 이동한다.
 */
const CARET_KEYS: ReadonlySet<string> = new Set(['Home', 'End']);

/** `key`가 활성 옵션을 해제하고 캐럿을 옮기는 키인지. */
export function isCaretKey(key: string): boolean {
    return CARET_KEYS.has(key);
}

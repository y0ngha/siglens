/**
 * 클립보드가 막혔을 때 보이는 직접 복사 입력의 선택 헬퍼.
 * 입력 전체가 선택돼 있어야 Ctrl+C 한 번으로 링크를 옮길 수 있다.
 */

import type { MouseEvent } from 'react';

/**
 * 마운트된 입력으로 포커스를 옮기고 전체를 선택한다.
 *
 * 모듈 수준 함수라 ref 콜백으로 넘겨도 참조가 바뀌지 않아 마운트 때 한 번만 돈다.
 * 복사 실패가 화면에만 보이면 키보드·스크린리더 사용자는 실패를 알 수 없다 —
 * 포커스가 입력으로 오면 입력 이름과 링크가 함께 읽힌다.
 */
export function focusAndSelectInput(input: HTMLInputElement | null): void {
    if (!input) return;
    input.focus();
    input.select();
}

/** 입력을 클릭하면 전체를 다시 선택한다(커서만 찍혀 일부만 복사되는 일을 막는다). */
export function selectInputOnClick(event: MouseEvent<HTMLInputElement>): void {
    event.currentTarget.select();
}

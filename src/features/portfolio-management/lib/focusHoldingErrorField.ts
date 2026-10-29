import type { HoldingErrorField } from './holdingErrorField';

/** 오류 칸 포커스의 대상. 종목 칸은 모드마다 안의 컨트롤이 달라 컨테이너를 받는다. */
export interface HoldingErrorFocusTargets {
    symbolField: HTMLElement | null;
    quantity: HTMLInputElement | null;
    averagePrice: HTMLInputElement | null;
}

/**
 * 서버가 지목한 오류 칸으로 포커스를 옮긴다. 종목 칸은 추가 모드에서 자동완성 입력이거나 칩의
 * "변경" 버튼이라 컨테이너 안의 첫 컨트롤을 찾는다. 편집 모드의 읽기 전용 종목 칸처럼 컨트롤이
 * 없거나 전용 칸이 없는 오류(`null`)면 포커스를 그대로 둔다.
 */
export function focusHoldingErrorField(
    field: HoldingErrorField,
    targets: HoldingErrorFocusTargets
): void {
    if (field === 'quantity') {
        targets.quantity?.focus();
        return;
    }
    if (field === 'averagePrice') {
        targets.averagePrice?.focus();
        return;
    }
    if (field === 'symbol') {
        targets.symbolField
            ?.querySelector<HTMLElement>('input, button')
            ?.focus();
    }
}

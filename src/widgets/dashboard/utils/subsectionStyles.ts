/**
 * 신호 소절(확정·조짐·혼재)의 변형별 스타일 표.
 */

/** 소절 변형 — 확정 신호, 조짐(예상) 신호, 방향이 엇갈린 종목. */
export type SignalSubsectionVariant = 'confirmed' | 'expected' | 'mixed';

/** 소절 상단 경계선. 조짐은 점선으로 "아직 확정이 아니다"를 드러낸다. */
export const VARIANT_BORDER: Record<SignalSubsectionVariant, string> = {
    confirmed: 'border-t-2 border-secondary-600',
    mixed: 'border-t-2 border-secondary-500',
    expected: 'border-t border-dashed border-secondary-700',
};

/** 소절 제목의 굵기·불투명도. */
export const VARIANT_LABEL: Record<SignalSubsectionVariant, string> = {
    confirmed: 'opacity-100 font-semibold',
    mixed: 'opacity-100 font-semibold',
    expected: 'opacity-70 font-medium',
};

/**
 * 개수에 걸 불투명도. 제목과 **같은 값**이어야 한다.
 *
 * `expected`는 제목만 약화되고 개수가 그대로면, 개수가 크기와 대비 모두 제목을 앞선다.
 * 소절 전체를 함께 약화시켜야 "아직 확정 신호가 아니다"라는 뜻이 일관되게 읽힌다.
 *
 * `VARIANT_LABEL`을 그대로 쓰지 않는 이유는 거기 붙은 `font-semibold`·`font-medium`이
 * 숫자 두께까지 바꾸기 때문이다. 불투명도만 가져온다. 개수 색이 `secondary-300`이 아니라
 * `secondary-200`인 것도 이 때문이다 — 300을 0.7로 흐리면 라이트 테마에서 AA(4.5)를
 * 깬다. 200에서 출발하면 흐린 뒤에도 통과하면서 제목보다 어둡다.
 */
export const VARIANT_COUNT_DIM: Record<SignalSubsectionVariant, string> = {
    confirmed: 'opacity-100',
    mixed: 'opacity-100',
    expected: 'opacity-70',
};

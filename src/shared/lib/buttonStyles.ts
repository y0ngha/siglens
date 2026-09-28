import { cn } from '@/shared/lib/cn';

/**
 * 버튼 **톤**만 담은 클래스 상수. 높이·폭·패딩·글자 크기는 자리마다 달라서 호출부가
 * `cn(BUTTON_PRIMARY, 'h-10 px-4 text-sm')`처럼 덧붙인다. `<button>`과 `Link` 양쪽에
 * 같은 값을 쓰려고 컴포넌트가 아니라 문자열이다(DESIGN.md "반복되는 클래스 조합은 상수로").
 *
 * 복제본들이 갈라져 있던 지점은 DESIGN.md 쪽으로 맞췄다 — 채움 hover는 대비가 올라가는
 * `-700`(`-500`은 흰 글자 대비를 3.68:1로 떨어뜨린다), 포커스 링은 `ring-2`,
 * 아웃라인 경계는 3:1을 넘는 `border-control`/`ui-danger`(알파 틴트 금지).
 */
const BUTTON_BASE =
    'inline-flex touch-manipulation items-center justify-center gap-2 rounded-lg transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed motion-reduce:transition-none';

/** 주 액션 채움 버튼. 한 화면에 하나. */
export const BUTTON_PRIMARY = cn(
    BUTTON_BASE,
    'bg-primary-600 font-semibold text-white hover:bg-primary-700 focus-visible:ring-primary-500 active:bg-primary-800 disabled:bg-secondary-700 disabled:text-secondary-500'
);

/** 되돌릴 수 없는 액션(계정 삭제)의 채움 버튼. */
export const BUTTON_DANGER = cn(
    BUTTON_BASE,
    'bg-ui-danger-fill font-semibold text-white hover:bg-ui-danger-fill-hover focus-visible:ring-ui-danger active:bg-ui-danger-fill-active disabled:bg-secondary-700 disabled:text-secondary-500'
);

/** 보조 액션. 경계가 유일한 식별 수단이라 컨트롤 경계 토큰을 쓴다. */
export const BUTTON_OUTLINE = cn(
    BUTTON_BASE,
    'border border-border-control font-medium text-secondary-200 hover:bg-secondary-800 focus-visible:ring-primary-500 disabled:text-secondary-500'
);

/** 삭제 같은 파괴적 보조 액션. */
export const BUTTON_OUTLINE_DANGER = cn(
    BUTTON_BASE,
    'border border-ui-danger font-medium text-ui-danger-text hover:bg-ui-danger/10 focus-visible:ring-ui-danger disabled:border-border-control disabled:text-secondary-500'
);

/** 취소·닫기처럼 채움도 경계도 없는 텍스트 버튼. */
export const BUTTON_GHOST = cn(
    BUTTON_BASE,
    'text-secondary-400 hover:text-secondary-200 focus-visible:ring-primary-500'
);

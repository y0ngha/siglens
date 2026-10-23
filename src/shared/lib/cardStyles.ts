import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';

/**
 * 호버로 들리는 표면 카드의 전환 목록.
 *
 * `transition-*` 유틸리티는 `.surface-raised`의 전환 목록(면 색 변수 포함)을 통째로
 * 덮는다. 그래서 들림(translate·scale)을 더하는 카드는 면 색 변수까지 여기 한 곳에 적고
 * 공유한다 — 사본이 갈라지면 한쪽 카드만 호버 면 색이 끊겨 바뀐다.
 */
export const SURFACE_LIFT_TRANSITION =
    'transition-[translate,scale,box-shadow,--surface-raised-top,--surface-raised-bottom]';

// 링크 카드(IndexCard, SignalStockCard, 가이드·교차 링크 카드)의 면 + hover/focus/motion-reduce.
// 호버는 경계선 대신 면이 한 단계 밝아지는 `surface-raised-hover`다. 면 색 변수는 상속되지
// 않아 호버가 면과 **같은 요소**에 있어야 하므로, 면(`SURFACE_CARD`)까지 이 상수에 묶는다 —
// 래퍼에 호버만 붙이고 안쪽에 면을 두는 조합이 생길 수 없다.
export const CARD_LINK_CLASSES = cn(
    SURFACE_CARD,
    'surface-raised-hover block origin-center touch-manipulation',
    SURFACE_LIFT_TRANSITION,
    'duration-150 hover:-translate-y-px',
    'focus-visible:ring-primary-500 focus-visible:ring-2 focus-visible:outline-none',
    'motion-reduce:transition-none motion-reduce:hover:translate-none'
);

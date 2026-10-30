/**
 * 골격 막대 공통 클래스. 모든 블록 leaf가 같은 면·맥박을 쓰도록 한곳에 둔다.
 */

/** 맥박하는 회색 막대 — 움직임 줄이기 설정에서는 멈춘다. */
export const SKELETON_BAR =
    'animate-pulse rounded bg-secondary-700 motion-reduce:animate-none';

/** 카드·패널처럼 큰 덩어리의 반경. 실제 카드(`SURFACE_CARD`)와 같은 단계다. */
export const SKELETON_BLOCK_RADIUS = 'rounded-lg';

/** 문단 줄 폭 — 줄마다 번갈아 써서 글 덩어리처럼 보이게 한다. */
export const SKELETON_LINE_WIDTHS = [
    'w-full',
    'w-11/12',
    'w-4/5',
    'w-2/3',
] as const;

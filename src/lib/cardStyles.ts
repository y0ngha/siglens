// Link로 감싸진 카드(IndexCard, SignalStockCard)에서 공통으로 쓰는 hover/focus/motion-reduce 스타일.
// 카드 고유 배경/테두리 class는 내부 inner div가 담당하므로 이 상수는 외곽 Link 전용이다.
export const CARD_LINK_CLASSES =
    'block origin-center touch-manipulation rounded-lg ' +
    'transition-[background-color,border-color,transform,box-shadow] duration-150 ' +
    'hover:bg-secondary-800/70 hover:border-secondary-600 hover:-translate-y-px ' +
    'hover:shadow-primary-950/40 hover:shadow-lg ' +
    'focus-visible:ring-primary-500 focus-visible:ring-2 focus-visible:outline-none ' +
    'motion-reduce:transition-none motion-reduce:hover:transform-none';

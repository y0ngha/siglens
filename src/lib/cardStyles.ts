import { cn } from '@/lib/cn';

// hover/focus/motion-reduce 스타일 — Link로 감싸진 카드(IndexCard, SignalStockCard) 공용.
// 카드 고유 배경/테두리는 각 컴포넌트가 직접 지정한다 (IndexCard: inner div, SignalStockCard: 외곽 Link에 함께).
export const CARD_LINK_CLASSES = cn(
    'block origin-center touch-manipulation rounded-lg',
    'transition-[background-color,border-color,transform,box-shadow] duration-150',
    'hover:bg-secondary-800/70 hover:border-secondary-600 hover:-translate-y-px',
    'hover:shadow-primary-950/40 hover:shadow-lg',
    'focus-visible:ring-primary-500 focus-visible:ring-2 focus-visible:outline-none',
    'motion-reduce:transition-none motion-reduce:hover:transform-none'
);

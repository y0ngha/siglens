/** 공유 시트(데스크톱 팝오버) 행들이 함께 쓰는 클래스 상수. */

import { cn } from '@/shared/lib/cn';

/** 링크 복사 버튼과 X 공유 링크가 같은 행 모양을 쓴다 — 한쪽만 바뀌면 목록이 어긋난다. */
export const SHARE_SHEET_ROW = cn(
    'flex w-full touch-manipulation items-center gap-3 rounded px-3 py-2 text-sm text-secondary-200 transition-colors',
    'hover:bg-secondary-800 focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:outline-none'
);

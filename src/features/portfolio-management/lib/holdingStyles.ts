import { cn } from '@/shared/lib/cn';
import {
    BUTTON_GHOST,
    BUTTON_OUTLINE,
    BUTTON_OUTLINE_DANGER,
    BUTTON_PRIMARY,
} from '@/shared/lib/buttonStyles';

/** 보유종목 행과 로딩 스켈레톤이 함께 쓰는 카드 틀 — 스켈레톤이 실제 행 모양을 따라가게 한다. */
export const ROW_CHROME =
    'ring-secondary-700 bg-secondary-900/60 rounded-lg p-4 ring-1';

/** 행의 수정·취소, 목록 오류의 다시 시도 버튼. */
export const ACTION_BUTTON = cn(BUTTON_OUTLINE, 'px-3 py-1.5 text-xs');

/**
 * 행의 삭제·삭제 확정 버튼. 삭제 확정은 진행 중에 포커스를 쥔 채 `aria-disabled`가 되므로
 * `disabled:` 톤과 같은 값을 `aria-disabled:`에도 준다.
 */
export const DANGER_BUTTON = cn(
    BUTTON_OUTLINE_DANGER,
    'px-3 py-1.5 text-xs aria-disabled:cursor-not-allowed aria-disabled:border-border-control aria-disabled:text-secondary-500'
);

/** `HoldingForm` 각 칸의 보이는 라벨(종목·수량·평단). */
export const FIELD_LABEL = 'text-secondary-400 mb-1 block text-xs font-medium';

/** 수량·평단 입력칸과 편집 모드의 읽기 전용 종목 칸이 함께 쓰는 틀. */
export const FIELD_INPUT =
    'bg-secondary-950 border-border-control text-secondary-100 placeholder-secondary-400 focus:border-primary-500 focus:ring-primary-500/40 h-10 w-full touch-manipulation rounded-lg border px-3 text-sm tabular-nums transition-colors outline-none focus:ring-2';

/** 서버가 그 칸을 오류로 지목했을 때 덧씌우는 경계·포커스 링. */
export const FIELD_INPUT_ERROR =
    'border-ui-danger focus:border-ui-danger focus:ring-ui-danger/40';

/** 추가 모드에서 고른 종목을 보여 주는 칩. */
export const SYMBOL_CHIP =
    'border-secondary-700 bg-secondary-950 flex h-10 items-center justify-between gap-2 rounded-lg border px-3';

/**
 * 폼 제출 버튼. 진행 중에도 포커스를 쥐도록 `aria-disabled`로 막으므로 `disabled:` 톤과 같은
 * 값을 `aria-disabled:`에도 준다.
 */
export const SAVE_BUTTON = cn(
    BUTTON_PRIMARY,
    'h-10 shrink-0 px-4 text-sm aria-disabled:cursor-not-allowed aria-disabled:bg-secondary-700 aria-disabled:text-secondary-500'
);

/** `HoldingForm`의 취소 버튼 — 편집 행·관심종목 전환 폼을 닫는 보조 액션이라 채움 없는 톤이다. */
export const CANCEL_BUTTON = cn(BUTTON_GHOST, 'h-10 shrink-0 px-2 text-sm');

/** ShareTriggerDialog·SharePreparingModal이 같은 틀을 쓴다 — 한쪽만 바뀌면 두 모달이 갈라진다. */
export const SHARE_MODAL_PANEL =
    'max-w-sm border border-secondary-700 bg-secondary-800 shadow-2xl';

export const SHARE_MODAL_ACTION_SIZE = 'h-9 px-4 text-sm';

/**
 * `BUTTON_OUTLINE`의 hover 면은 `secondary-800`인데 이 모달 패널이 바로 그 색이라
 * hover가 보이지 않는다. 한 단계 위 면으로 올린다.
 */
export const SHARE_MODAL_OUTLINE_HOVER = 'hover:bg-secondary-700';

/** 44px 타깃을 유지하면서 음수 여백으로 제목 줄 높이는 그대로 둔다(IosInstallModal과 같은 값). */
export const SHARE_MODAL_CLOSE_BUTTON =
    '-my-2.5 -mr-2.5 flex size-11 touch-manipulation items-center justify-center rounded-lg text-secondary-400 transition-colors hover:text-secondary-200 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';

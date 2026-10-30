'use client';

/** 공유 모달 하단의 세로 버튼 쌍 — 주 액션(채움)과 보조 액션(아웃라인). */

import { BUTTON_OUTLINE, BUTTON_PRIMARY } from '@/shared/lib/buttonStyles';
import { cn } from '@/shared/lib/cn';
import {
    SHARE_MODAL_ACTION_SIZE,
    SHARE_MODAL_OUTLINE_HOVER,
} from '../../utils/modalStyles';

/** 버튼 하나의 문구와 동작. */
interface ShareModalAction {
    label: string;
    onClick: () => void;
}

interface ShareModalActionsProps {
    primary: ShareModalAction;
    secondary: ShareModalAction;
}

const PRIMARY_CLASS = cn(BUTTON_PRIMARY, SHARE_MODAL_ACTION_SIZE);
const SECONDARY_CLASS = cn(
    BUTTON_OUTLINE,
    SHARE_MODAL_ACTION_SIZE,
    SHARE_MODAL_OUTLINE_HOVER
);

/** 주 액션을 위, 보조 액션을 아래에 둔 전폭 버튼 쌍. */
export function ShareModalActions({
    primary,
    secondary,
}: ShareModalActionsProps) {
    return (
        <div className="flex w-full flex-col gap-2">
            <button
                type="button"
                onClick={primary.onClick}
                className={PRIMARY_CLASS}
            >
                {primary.label}
            </button>
            <button
                type="button"
                onClick={secondary.onClick}
                className={SECONDARY_CLASS}
            >
                {secondary.label}
            </button>
        </div>
    );
}

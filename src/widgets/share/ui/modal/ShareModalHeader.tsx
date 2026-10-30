'use client';

/** 공유 모달 공통 머리줄 — 패널 이름이 되는 제목과 닫기 버튼. */

import { CloseIcon } from '@/shared/ui/StrokeIcons';
import { SHARE_MODAL_CLOSE_BUTTON } from '../../utils/modalStyles';

interface ShareModalHeaderProps {
    /** `ModalShell`의 `aria-labelledby`가 가리키는 제목 id. */
    titleId: string;
    title: string;
    /** 아이콘만 있는 닫기 버튼의 접근 이름. */
    closeLabel: string;
    onClose: () => void;
}

/** 제목과 44px 닫기 버튼을 한 줄에 둔 모달 머리줄. */
export function ShareModalHeader({
    titleId,
    title,
    closeLabel,
    onClose,
}: ShareModalHeaderProps) {
    return (
        <div className="flex items-center justify-between border-b border-secondary-700 px-5 py-4">
            <h2
                id={titleId}
                className="text-sm font-semibold text-secondary-100"
            >
                {title}
            </h2>
            <button
                type="button"
                onClick={onClose}
                aria-label={closeLabel}
                className={SHARE_MODAL_CLOSE_BUTTON}
            >
                <CloseIcon />
            </button>
        </div>
    );
}

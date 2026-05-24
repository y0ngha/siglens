'use client';

import { startTransition, useCallback, useEffect, useState } from 'react';

const TOOLTIP_SHOWN_KEY = 'siglens:chat-tooltip-shown';

interface UseChatButtonStateReturn {
    isOpen: boolean;
    showTooltip: boolean;
    handleClose: () => void;
    handleButtonClick: () => void;
    dismissTooltip: () => void;
}

// 채팅 버튼 open 토글 + 분석 완료 시 1회성 툴팁 표시(localStorage 게이트).
export function useChatButtonState(
    isAnalysisReady: boolean
): UseChatButtonStateReturn {
    const [isOpen, setIsOpen] = useState(false);
    const [showTooltip, setShowTooltip] = useState(false);

    const handleClose = useCallback(() => setIsOpen(false), []);

    const dismissTooltip = useCallback(() => {
        setShowTooltip(false);
        try {
            localStorage.setItem(TOOLTIP_SHOWN_KEY, '1');
        } catch {
            // quota 등 예외는 무시한다 (툴팁 재등장 정도의 UX 저하만 발생)
        }
    }, []);

    const handleButtonClick = useCallback(() => {
        if (showTooltip) dismissTooltip();
        setIsOpen(prev => !prev);
    }, [showTooltip, dismissTooltip]);

    useEffect(() => {
        if (!isAnalysisReady) return;

        try {
            if (!localStorage.getItem(TOOLTIP_SHOWN_KEY)) {
                startTransition(() => setShowTooltip(true));
            }
        } catch {
            // ignore
        }
    }, [isAnalysisReady]);

    return {
        isOpen,
        showTooltip,
        handleClose,
        handleButtonClick,
        dismissTooltip,
    };
}

'use client';

/**
 * 공지 다이얼로그의 바닥 — "다시 보지 않기"와 "닫기" 버튼.
 */
import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';
import { BUTTON_GHOST, BUTTON_OUTLINE } from '@/shared/lib/buttonStyles';

/** NoticeDialogFooter의 props. */
export interface NoticeDialogFooterProps {
    /** 영구 숨김(localStorage) 후 닫기. */
    onDontShowAgain: () => void;
    /** 이번 세션에서만 닫기. */
    onClose: () => void;
}

/**
 * 두 버튼을 오른쪽 정렬로 그린다. 본문 스크롤 영역 밖(형제)이라 긴 본문에도 화면에 남는다.
 */
export function NoticeDialogFooter({
    onDontShowAgain,
    onClose,
}: NoticeDialogFooterProps) {
    const t = useTranslations('widgets.notice-popup');
    return (
        <div className="mt-5 flex shrink-0 items-center justify-end gap-3">
            <button
                type="button"
                onClick={onDontShowAgain}
                className={cn(BUTTON_GHOST, 'text-sm')}
            >
                {t('NoticePopup.e83def')}
            </button>
            <button
                type="button"
                onClick={onClose}
                className={cn(BUTTON_OUTLINE, 'px-4 py-2 text-sm')}
            >
                {t('NoticePopup.94b7db')}
            </button>
        </div>
    );
}

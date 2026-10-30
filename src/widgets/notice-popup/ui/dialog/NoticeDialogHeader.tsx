'use client';

/**
 * 공지 다이얼로그의 머리 — 제목과 X(닫기) 버튼.
 */
import { useTranslations } from 'next-intl';
import { CloseIcon } from '@/shared/ui/StrokeIcons';

/** NoticeDialogHeader의 props. */
export interface NoticeDialogHeaderProps {
    /** 다이얼로그 `aria-labelledby`가 가리키는 제목 요소 id. */
    titleId: string;
    title: string;
    onClose: () => void;
}

/** 제목(다이얼로그 이름)과 44px 닫기 버튼을 한 줄에 그린다. */
export function NoticeDialogHeader({
    titleId,
    title,
    onClose,
}: NoticeDialogHeaderProps) {
    const t = useTranslations('widgets.notice-popup');
    return (
        <div className="mb-3 flex shrink-0 items-start justify-between gap-3">
            <h2 id={titleId} className="text-base font-bold text-secondary-100">
                {title}
            </h2>
            <button
                type="button"
                onClick={onClose}
                aria-label={t('NoticePopup.a5ce49')}
                // 44px 타깃을 유지하면서 음수 여백으로 제목 줄 높이는 그대로 둔다.
                className="-my-2.5 -mr-2.5 flex size-11 shrink-0 items-center justify-center rounded-lg text-secondary-500 transition-colors hover:text-secondary-300 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
            >
                <CloseIcon className="size-5" />
            </button>
        </div>
    );
}

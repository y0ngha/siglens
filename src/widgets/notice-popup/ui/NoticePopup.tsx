'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { MarkdownText } from '@/shared/ui/MarkdownText';
import { useEscapeKey } from '@/shared/hooks/useEscapeKey';
import { useFocusTrap } from '@/shared/hooks/useFocusTrap';
import { formatNoticeDate } from '@/entities/notice';
import { toSafeHttpUrl } from '@/shared/lib/safeUrl';
import { useNoticePopup } from '../hooks/useNoticePopup';

const MODAL_TITLE_ID = 'notice-modal-title';

/**
 * 사이트 공지 팝업. 데이터/큐 로직은 useNoticePopup 훅에 위임하고, 이 컴포넌트는
 * 모달 렌더링과 포커스/키보드 접근성만 담당한다.
 * - X / 배경 클릭 / Esc = 임시 닫기(다음 방문 시 재노출)
 * - "다시 보지 않기" = localStorage에 ID 영구 저장
 */
export function NoticePopup() {
    const pathname = usePathname();
    const dialogRef = useRef<HTMLDivElement>(null);
    const { queue, advance, dontShowAgain } = useNoticePopup(pathname);

    useEscapeKey(advance, queue.length > 0);
    useFocusTrap(dialogRef, queue.length > 0);
    useEffect(() => {
        if (queue.length > 0) dialogRef.current?.focus();
    }, [queue]);

    const current = queue[0] ?? null;
    if (current === null) return null;

    const safeLinkUrl = toSafeHttpUrl(current.linkUrl);

    return (
        <div
            role="presentation"
            data-testid="notice-modal-backdrop"
            className="bg-secondary-950/80 fixed inset-0 z-9999 flex items-center justify-center px-4 backdrop-blur-sm"
            onClick={advance}
        >
            <div
                ref={dialogRef}
                tabIndex={-1}
                data-testid="notice-modal-content"
                role="dialog"
                aria-modal="true"
                aria-labelledby={MODAL_TITLE_ID}
                className="border-secondary-700 bg-secondary-800 w-full max-w-md rounded-2xl border p-5"
                onClick={e => e.stopPropagation()}
            >
                <div className="mb-3 flex items-start justify-between gap-3">
                    <h2
                        id={MODAL_TITLE_ID}
                        className="text-secondary-100 text-base font-bold"
                    >
                        {current.title}
                    </h2>
                    <button
                        onClick={advance}
                        aria-label="팝업 닫기"
                        className="text-secondary-500 hover:text-secondary-300 focus-visible:ring-primary-500 shrink-0 text-xl leading-none transition-colors focus-visible:ring-1 focus-visible:outline-none"
                    >
                        ✕
                    </button>
                </div>
                <p className="text-secondary-500 mb-3 text-xs">
                    {formatNoticeDate(current.createdAt)}
                </p>
                <MarkdownText className="text-secondary-300 text-sm">
                    {current.body}
                </MarkdownText>
                {safeLinkUrl !== null && (
                    <a
                        href={safeLinkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-primary-600 hover:bg-primary-500 focus-visible:ring-primary-500 focus-visible:ring-offset-secondary-800 mt-4 inline-block rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors focus-visible:ring-1 focus-visible:ring-offset-2 focus-visible:outline-none"
                    >
                        {current.linkLabel ?? safeLinkUrl}
                    </a>
                )}
                <div className="mt-5 flex items-center justify-end gap-3">
                    <button
                        onClick={dontShowAgain}
                        className="text-secondary-400 hover:text-secondary-200 focus-visible:ring-primary-500 text-sm transition-colors focus-visible:ring-1 focus-visible:outline-none"
                    >
                        다시 보지 않기
                    </button>
                    <button
                        onClick={advance}
                        className="border-secondary-600 text-secondary-200 hover:bg-secondary-700 focus-visible:ring-primary-500 rounded-lg border px-4 py-2 text-sm transition-colors focus-visible:ring-1 focus-visible:outline-none"
                    >
                        닫기
                    </button>
                </div>
            </div>
        </div>
    );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { MarkdownText } from '@/shared/ui/MarkdownText';
import { useEscapeKey } from '@/shared/hooks/useEscapeKey';
import { useFocusTrap } from '@/shared/hooks/useFocusTrap';
import { getActiveNoticesAction } from '@/entities/notice/actions';
import {
    matchPath,
    loadDismissedNoticeIds,
    dismissNotice,
    type NoticeRecord,
} from '@/entities/notice';

const MODAL_TITLE_ID = 'notice-modal-title';

/** createdAt을 'YYYY.MM.DD 작성' 형태로 포맷한다(로컬 타임존). */
function formatNoticeDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}.${month}.${day} 작성`;
}

/** http(s) URL만 허용한다. javascript:/data: 등 위험 스킴은 링크를 렌더하지 않아 방어한다. */
function toSafeHttpUrl(url: string | null): string | null {
    if (url === null) return null;
    return /^https?:\/\//i.test(url) ? url : null;
}

/**
 * 사이트 공지 팝업. 마운트 시 및 경로(pathname) 변경 시 활성 공지를 fetch해
 * 현재 경로 매칭 + dismiss 필터를 적용하고, 남은 공지를 우선순위 순으로 하나씩
 * 모달로 띄운다. (경로 변경 시 큐는 새로 구성된다.)
 * - X / 배경 클릭 / Esc = 임시 닫기(다음 방문 시 재노출)
 * - "다시 보지 않기" = localStorage에 ID 영구 저장
 */
export function NoticePopup() {
    const pathname = usePathname();
    const [queue, setQueue] = useState<NoticeRecord[]>([]);
    const dialogRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let cancelled = false;
        getActiveNoticesAction()
            .then(notices => {
                if (cancelled) return;
                const dismissed = loadDismissedNoticeIds();
                setQueue(
                    notices.filter(
                        n =>
                            matchPath(n.pathPattern, pathname) &&
                            !dismissed.includes(n.id)
                    )
                );
            })
            .catch(() => {
                // 공지 fetch 실패는 무시(부가 기능)
            });
        return () => {
            cancelled = true;
        };
    }, [pathname]);

    const current = queue[0] ?? null;
    const isOpen = current !== null;
    const safeLinkUrl = toSafeHttpUrl(current?.linkUrl ?? null);

    const advance = () => setQueue(prev => prev.slice(1));
    const handleDontShowAgain = () => {
        if (current !== null) dismissNotice(current.id);
        advance();
    };

    useEscapeKey(advance, isOpen);
    useFocusTrap(dialogRef, isOpen);
    useEffect(() => {
        if (isOpen) dialogRef.current?.focus();
    }, [isOpen, current?.id]);

    if (current === null) return null;

    return (
        <div
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
                        className="bg-primary-600 hover:bg-primary-500 mt-4 inline-block rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors"
                    >
                        {current.linkLabel ?? safeLinkUrl}
                    </a>
                )}
                <div className="mt-5 flex items-center justify-end gap-3">
                    <button
                        onClick={handleDontShowAgain}
                        className="text-secondary-400 hover:text-secondary-200 text-sm transition-colors"
                    >
                        다시 보지 않기
                    </button>
                    <button
                        onClick={advance}
                        className="border-secondary-600 text-secondary-200 hover:bg-secondary-700 rounded-lg border px-4 py-2 text-sm transition-colors"
                    >
                        닫기
                    </button>
                </div>
            </div>
        </div>
    );
}

'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useAppPathname } from '@/shared/i18n/useAppPathname';
import { useEscapeKey } from '@/shared/hooks/useEscapeKey';
import { useFocusTrap } from '@/shared/hooks/useFocusTrap';
import { formatNoticeDate } from '@/entities/notice';
import { toSafeHttpUrl } from '@/shared/lib/safeUrl';
import { useNoticePopup } from '../hooks/useNoticePopup';

const MODAL_TITLE_ID = 'notice-modal-title';

/**
 * 마크다운 렌더러를 **띄울 공지가 실제로 있을 때만** 내려받는다.
 *
 * 이 팝업은 루트 레이아웃에서 항상 마운트되는데(`NoticePopupLoader`), `react-markdown`
 * + `remark-gfm` + `rehype-slug` 체인이 정적 import로 묶여 있어서 **공지가 하나도 없는
 * 페이지에서도** 그 청크가 초기 로드에 딸려 왔다(실측: 홈이 markdown 청크 113KB /
 * 전송 34KB를 받고 그중 26KB가 unused).
 *
 * 본문(`current`)이 없으면 이 컴포넌트는 그 위에서 `null`을 반환하므로, 아래 렌더에
 * 도달했다는 것 자체가 "보여줄 공지가 있다"는 뜻이다 — 그 시점에만 청크를 가져온다.
 *
 * `loading`을 주지 않는다 = 이 `dynamic()`이 **Suspense 경계를 만들지 않는다**
 * (`hasSuspenseBoundary = !opts.ssr || !!opts.loading`). 따라서 청크를 기다리는 동안
 * 멈추는 것은 본문만이 아니라 팝업 전체이고, 대기 지점은 `NoticePopupLoader`가
 * `{ssr:false}`로 만든 바깥 경계(fallback `null`)다. 모달은 페이지 흐름 밖이라
 * 레이아웃을 밀지 않고, 원래도 비동기로 뜨는 화면이라 이 편이 단순하다 —
 * 형제인 `FloatingChatButton`은 반대로 `loading`을 줘서 자체 경계를 갖는다.
 */
const MarkdownText = dynamic(() =>
    import('@/shared/ui/MarkdownText').then(m => m.MarkdownText)
);

/**
 * 사이트 공지 팝업. 데이터/큐 로직은 useNoticePopup 훅에 위임하고, 이 컴포넌트는
 * 모달 렌더링과 포커스/키보드 접근성만 담당한다.
 * - X / 배경 클릭 / Esc = 임시 닫기(다음 방문 시 재노출)
 * - "다시 보지 않기" = localStorage에 ID 영구 저장
 */
export function NoticePopup() {
    const t = useTranslations('widgets.notice-popup');
    const tMisc = useTranslations('shared.ui.misc');
    const dialogRef = useRef<HTMLDivElement>(null);
    // `notices.path_pattern`은 운영자가 넣는 접두사 없는 경로(`/market`, `/symbol/*`)다.
    // 접두사가 붙은 경로로 매칭하면 비-ko 사용자에게 **경로 지정 공지가 전부 사라진다**
    // (전역 공지만 남는다).
    const pathname = useAppPathname();
    const { queue, advance, dontShowAgain } = useNoticePopup(pathname);

    useEscapeKey(advance, queue.length > 0);
    useFocusTrap(dialogRef, queue.length > 0);

    const current = queue[0] ?? null;

    useEffect(() => {
        if (queue.length > 0) dialogRef.current?.focus();
    }, [queue]);

    if (current === null) return null;

    const safeLinkUrl = toSafeHttpUrl(current.linkUrl);

    return (
        <div
            role="presentation"
            data-testid="notice-modal-backdrop"
            className="fixed inset-0 z-9999 flex items-center justify-center bg-secondary-950/80 px-4 backdrop-blur-sm"
            // 배경 클릭 닫기는 편의 기능(닫기 경로는 Escape + 닫기 버튼). target 비교로
            // 처리해 내부 컨테이너에 stopPropagation 핸들러를 달지 않는다 — role="dialog"에
            // 마우스 핸들러를 붙이면 a11y 린트가 "비인터랙티브 요소 인터랙션"으로 잡는다.
            onClick={e => {
                if (e.target === e.currentTarget) advance();
            }}
        >
            <div
                ref={dialogRef}
                tabIndex={-1}
                data-testid="notice-modal-content"
                role="dialog"
                aria-modal="true"
                aria-labelledby={MODAL_TITLE_ID}
                className="flex max-h-[85dvh] w-full max-w-md flex-col rounded-2xl border border-secondary-700 bg-secondary-800 p-5"
            >
                <div className="mb-3 flex shrink-0 items-start justify-between gap-3">
                    <h2
                        id={MODAL_TITLE_ID}
                        className="text-base font-bold text-secondary-100"
                    >
                        {current.title}
                    </h2>
                    <button
                        onClick={advance}
                        aria-label={t('NoticePopup.a5ce49')}
                        className="shrink-0 text-xl leading-none text-secondary-500 transition-colors hover:text-secondary-300 focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:outline-none"
                    >
                        ✕
                    </button>
                </div>
                {/* 긴 마크다운이 푸터(버튼)를 화면 밖으로 밀지 않도록 본문만 스크롤시킨다.
                    min-h-0은 flex 자식이 기본 min-height:auto여서, 없으면 overflow가 동작하지
                    않아(자식이 콘텐츠 높이만큼 늘어남) 반드시 필요하다.
                    tabIndex/role/aria-label은 키보드 접근성용: 본문에 포커스 가능한 자손(링크)이
                    없으면 키보드 사용자가 스크롤 영역에 진입할 수 없어 방향키/PageUp·Down으로
                    긴 본문을 스크롤할 수 없다(WCAG 2.1.1). 컨테이너를 포커스 가능하게 만든다. */}
                <div
                    tabIndex={0}
                    role="region"
                    aria-label={t('NoticePopup.ca2829')}
                    data-testid="notice-body-scroller"
                    className="-mr-2 min-h-0 flex-1 overflow-y-auto rounded pr-2 focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:outline-none"
                >
                    <p className="mb-3 text-xs text-secondary-500">
                        {(() => {
                            const parts = formatNoticeDate(current.createdAt);
                            return parts === null
                                ? ''
                                : tMisc('noticeWrittenOn', {
                                      v0: parts.year,
                                      v1: parts.month,
                                      v2: parts.day,
                                  });
                        })()}
                    </p>
                    <MarkdownText className="text-sm text-secondary-300">
                        {current.body}
                    </MarkdownText>
                    {safeLinkUrl !== null && (
                        <a
                            href={safeLinkUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-4 inline-block rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-500 focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-secondary-800 focus-visible:outline-none"
                        >
                            {current.linkLabel ?? safeLinkUrl}
                        </a>
                    )}
                </div>
                <div className="mt-5 flex shrink-0 items-center justify-end gap-3">
                    <button
                        onClick={dontShowAgain}
                        className="text-sm text-secondary-400 transition-colors hover:text-secondary-200 focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:outline-none"
                    >
                        {t('NoticePopup.e83def')}
                    </button>
                    <button
                        onClick={advance}
                        className="rounded-lg border border-secondary-600 px-4 py-2 text-sm text-secondary-200 transition-colors hover:bg-secondary-700 focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:outline-none"
                    >
                        {t('NoticePopup.94b7db')}
                    </button>
                </div>
            </div>
        </div>
    );
}

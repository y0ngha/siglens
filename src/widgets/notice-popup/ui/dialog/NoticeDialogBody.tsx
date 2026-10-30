'use client';

/**
 * 공지 다이얼로그의 스크롤 본문 — 작성일, 마크다운 본문, 선택적 외부 링크.
 */
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import type { NoticeRecord } from '@/entities/notice/model/types';
import { cn } from '@/shared/lib/cn';
import { BUTTON_PRIMARY } from '@/shared/lib/buttonStyles';
import { useNoticeWrittenOnLabel } from '../../hooks/useNoticeWrittenOnLabel';
import { resolveNoticeLink } from '../../utils/resolveNoticeLink';

/**
 * 마크다운 렌더러를 **띄울 공지가 실제로 있을 때만** 내려받는다.
 *
 * 공지 팝업은 루트 레이아웃에서 항상 마운트되는데(`NoticePopupLoader`), `react-markdown`
 * + `remark-gfm` + `rehype-slug` 체인을 정적 import로 묶으면 **공지가 하나도 없는
 * 페이지에서도** 그 청크가 초기 로드에 딸려 온다(`NoticePopup.lazy.test.tsx`가 고정).
 *
 * 이 본문은 보여줄 공지가 있을 때만 렌더되므로(`NoticePopup`이 그 위에서 `null`을
 * 반환한다), 여기 도달했다는 것 자체가 "보여줄 공지가 있다"는 뜻이다 — 그 시점에만
 * 청크를 가져온다.
 *
 * `loading`을 주지 않는다 = 이 `dynamic()`이 **Suspense 경계를 만들지 않는다**
 * (`hasSuspenseBoundary = !opts.ssr || !!opts.loading`). 따라서 청크를 기다리는 동안
 * 멈추는 것은 본문만이 아니라 팝업 전체이고, 대기 지점은 `NoticePopupLoader`가
 * `{ssr:false}`로 만든 바깥 경계(fallback `null`)다. 모달은 페이지 흐름 밖이라
 * 레이아웃을 밀지 않고, 원래도 비동기로 뜨는 화면이라 이 편이 단순하다.
 */
const MarkdownText = dynamic(() =>
    import('@/shared/ui/MarkdownText').then(m => m.MarkdownText)
);

/** NoticeDialogBody의 props — 표시에 쓰는 공지 필드만 받는다. */
export interface NoticeDialogBodyProps {
    notice: Pick<NoticeRecord, 'body' | 'createdAt' | 'linkUrl' | 'linkLabel'>;
}

/**
 * 긴 마크다운이 푸터(버튼)를 화면 밖으로 밀지 않도록 본문만 스크롤시킨다.
 * `min-h-0`은 flex 자식이 기본 `min-height:auto`여서, 없으면 overflow가 동작하지
 * 않아(자식이 콘텐츠 높이만큼 늘어남) 반드시 필요하다.
 *
 * `tabIndex`/`role`/`aria-label`은 키보드 접근성용: 본문에 포커스 가능한 자손(링크)이
 * 없으면 키보드 사용자가 스크롤 영역에 진입할 수 없어 방향키/PageUp·Down으로 긴 본문을
 * 스크롤할 수 없다(WCAG 2.1.1). 컨테이너를 포커스 가능하게 만든다.
 */
export function NoticeDialogBody({ notice }: NoticeDialogBodyProps) {
    const t = useTranslations('widgets.notice-popup');
    const writtenOnLabel = useNoticeWrittenOnLabel(notice.createdAt);
    const link = resolveNoticeLink(notice.linkUrl, notice.linkLabel);
    return (
        <div
            tabIndex={0}
            role="region"
            aria-label={t('NoticePopup.ca2829')}
            data-testid="notice-body-scroller"
            className="-mr-2 min-h-0 flex-1 overflow-y-auto rounded pr-2 focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:outline-none"
        >
            <p className="mb-3 text-xs text-secondary-500">{writtenOnLabel}</p>
            <MarkdownText className="text-sm text-secondary-300">
                {notice.body}
            </MarkdownText>
            {link !== null && (
                <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(BUTTON_PRIMARY, 'mt-4 px-4 py-2 text-sm')}
                >
                    {link.label}
                </a>
            )}
        </div>
    );
}

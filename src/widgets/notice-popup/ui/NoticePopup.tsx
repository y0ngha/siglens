'use client';

/**
 * 사이트 공지 팝업 — 공지 큐의 첫 공지를 모달(모바일은 바텀시트)로 띄운다.
 */
import { useRef } from 'react';
import { useAppPathname } from '@/shared/i18n/useAppPathname';
import { cn } from '@/shared/lib/cn';
import { SURFACE_FLOATING } from '@/shared/lib/surfaceStyles';
import { useNoticeDialogFocus } from '../hooks/useNoticeDialogFocus';
import { useNoticePopup } from '../hooks/useNoticePopup';
import { NoticeDialogBody } from './dialog/NoticeDialogBody';
import { NoticeDialogFooter } from './dialog/NoticeDialogFooter';
import { NoticeDialogHeader } from './dialog/NoticeDialogHeader';

const MODAL_TITLE_ID = 'notice-modal-title';

/**
 * 사이트 공지 팝업. 데이터/큐 로직은 `useNoticePopup`, 키보드·포커스는
 * `useNoticeDialogFocus`에 위임하고, 이 컴포넌트는 모달 껍데기와 조립만 담당한다.
 * - X / 배경 클릭 / Esc / "닫기" = 임시 닫기(다음 방문 시 재노출)
 * - "다시 보지 않기" = localStorage에 ID 영구 저장
 */
export function NoticePopup() {
    const dialogRef = useRef<HTMLDivElement>(null);
    // `notices.path_pattern`은 운영자가 넣는 접두사 없는 경로(`/market`, `/symbol/*`)다.
    // 접두사가 붙은 경로로 매칭하면 비-ko 사용자에게 **경로 지정 공지가 전부 사라진다**
    // (전역 공지만 남는다).
    const pathname = useAppPathname();
    const { queue, advance, dontShowAgain } = useNoticePopup(pathname);

    const current = queue[0] ?? null;
    // 열림 여부와 포커스 이동 기준이 지금 보이는 공지(`current`)라 그 파생 직후에 둔다.
    useNoticeDialogFocus(dialogRef, current?.id ?? null, advance);

    if (current === null) return null;

    return (
        <div
            role="presentation"
            data-testid="notice-modal-backdrop"
            // 모바일(<640px)은 전체 화면을 덮지 않는다 — 검색 유입의 첫 화면을
            // 가리는 오버레이가 구글의 모바일 인터스티셜 판정 대상이다. 화면 아래에
            // 붙는 시트라 뒤 콘텐츠가 보인다. 데스크톱은 중앙 오버레이(딤 + blur는
            // sm 이상에서만).
            className="fixed inset-x-0 bottom-0 z-9999 sm:inset-0 sm:flex sm:items-center sm:justify-center sm:bg-secondary-950/80 sm:px-4 sm:backdrop-blur-sm"
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
                // 바텀시트 토큰은 `MobileAnalysisSheet`과 맞춘다(상단 라운드,
                // secondary-700 보더, safe-area 여백). sm 이상에서 중앙 카드로 돌아간다.
                // 페이지의 카드를 덮는 다이얼로그라 경계선을 유지하는 `SURFACE_FLOATING`이다.
                // 표면이 모든 모서리를 lg로 둥글리므로, 모바일 바텀시트는
                // 하단만 명시적으로 되돌린다(`rounded-b-none`) — sm 이상에서
                // `sm:rounded-b-lg`로 다시 카드 모양을 완성한다.
                className={cn(
                    SURFACE_FLOATING,
                    'flex max-h-[85dvh] w-full flex-col rounded-b-none p-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] sm:max-w-md sm:rounded-b-lg sm:pb-5'
                )}
            >
                <NoticeDialogHeader
                    titleId={MODAL_TITLE_ID}
                    title={current.title}
                    onClose={advance}
                />
                <NoticeDialogBody notice={current} />
                <NoticeDialogFooter
                    onDontShowAgain={dontShowAgain}
                    onClose={advance}
                />
            </div>
        </div>
    );
}

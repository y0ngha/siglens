'use client';

/**
 * 공지 다이얼로그의 키보드·포커스 배선 — Escape 닫기, 포커스 트랩(닫힐 때 원래 위치로
 * 복원), 새 공지가 뜰 때 다이얼로그로 포커스 이동.
 */
import { type RefObject, useEffect } from 'react';
import { useEscapeKey } from '@/shared/hooks/useEscapeKey';
import { useFocusTrap } from '@/shared/hooks/useFocusTrap';

/**
 * `currentNoticeId`가 `null`이 아니면 다이얼로그가 열린 것으로 본다.
 *
 * 다이얼로그 포커스는 **보이는 공지가 바뀔 때만** 옮긴다(공지 ID 기준). 큐 배열의 참조는
 * 경로가 바뀌기만 해도 새로 만들어지는데, 그걸 기준으로 삼으면 같은 공지가 그대로 떠
 * 있는데도 포커스를 다시 빼앗는다 — 모바일 바텀시트는 뒤 페이지를 가리지 않아 그 페이지의
 * 링크로 이동한 직후가 바로 그 경우다. 다음 공지로 넘어갈 때는 다이얼로그에 포커스를 줘
 * 스크린 리더가 새 제목(`aria-labelledby`)을 읽게 한다.
 *
 * 트랩이 열릴 때의 포커스 위치를 먼저 잡아 두도록 트랩을 포커스 effect보다 앞에 둔다
 * (같은 커밋의 effect는 선언 순서대로 돈다).
 */
export function useNoticeDialogFocus(
    dialogRef: RefObject<HTMLElement | null>,
    currentNoticeId: string | null,
    onClose: () => void
): void {
    const isOpen = currentNoticeId !== null;

    useEscapeKey(onClose, isOpen);
    useFocusTrap(dialogRef, isOpen);

    useEffect(() => {
        if (currentNoticeId !== null) dialogRef.current?.focus();
    }, [currentNoticeId, dialogRef]);
}

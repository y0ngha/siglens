'use client';

/** 데스크톱 공유 팝오버 — 링크 복사와 X 공유를 담은 비모달 패널. */

import type { RefObject } from 'react';
import { useShareSheet } from '../hooks/useShareSheet';
import { ShareSheetCopyAction } from './sheet/ShareSheetCopyAction';
import { ShareSheetXLink } from './sheet/ShareSheetXLink';

interface ShareSheetProps {
    shareUrl: string;
    /** X에 게시될 본문. 스크린리더용 설명으로도 읽힌다. */
    tweetText: string;
    /** 패널의 접근 이름. */
    title: string;
    /** 시트를 연 트리거 버튼. 트리거 클릭은 바깥 클릭으로 치지 않는다. */
    anchorRef: RefObject<HTMLElement | null>;
    onClose: () => void;
}

/**
 * 공유 버튼 옆에 앵커되는 공유 시트. 열림 여부는 부모가 갖고, 마운트 = 열림이다.
 *
 * 포커스 트랩을 걸지 않는 것은 의도다. 트리거 옆 인라인 팝오버라 Tab으로 자유롭게
 * 빠져나갈 수 있어야 하고, 닫기는 Esc·바깥 클릭·트리거 재클릭으로 한다. 진짜 모달인
 * ShareTriggerDialog·SharePreparingModal과 달리 `ModalShell`을 쓰지 않는다.
 */
export function ShareSheet({
    shareUrl,
    tweetText,
    title,
    anchorRef,
    onClose,
}: ShareSheetProps) {
    const { panelRef, firstItemRef, copied, copyFailed, tweetUrl, handleCopy } =
        useShareSheet({ shareUrl, tweetText, anchorRef, onClose });

    return (
        <div
            ref={panelRef}
            className="absolute right-0 z-50 mt-2 w-72 rounded-lg border border-secondary-700 bg-secondary-900 p-2 shadow-2xl"
            // 트리거 옆에 앵커된 비모달 팝오버다. 네이티브 <dialog>로 바꾸면 위치·포커스·닫기 동작이 달라진다.
            // react-doctor-disable-next-line react-doctor/prefer-html-dialog
            role="dialog"
            aria-label={title}
        >
            <ShareSheetCopyAction
                buttonRef={firstItemRef}
                shareUrl={shareUrl}
                copied={copied}
                copyFailed={copyFailed}
                onCopy={handleCopy}
            />
            <ShareSheetXLink href={tweetUrl} />
            <p className="sr-only">{tweetText}</p>
        </div>
    );
}

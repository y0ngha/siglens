'use client';

/**
 * 공유 시트(비모달 팝오버)의 상호작용 — 열릴 때 첫 행 포커스, Esc·바깥 클릭 닫기,
 * 링크 복사와 복사 실패 폴백 상태.
 */

import { type RefObject, useEffect, useRef, useState } from 'react';
import { useCopyToClipboard } from '@/shared/hooks/useCopyToClipboard';
import { useEscapeKey } from '@/shared/hooks/useEscapeKey';
import { useOnClickOutside } from '@/shared/hooks/useOnClickOutside';
import { buildTweetIntentUrl } from '@/shared/lib/share';

/** `useShareSheet` 입력. */
export interface UseShareSheetOptions {
    shareUrl: string;
    tweetText: string;
    /** 시트를 연 트리거. 바깥 클릭 판정에서 빼서 트리거가 직접 열고 닫게 한다. */
    anchorRef: RefObject<HTMLElement | null>;
    onClose: () => void;
}

/** `useShareSheet`가 시트 UI에 넘기는 상태·ref·핸들러. */
export interface UseShareSheetResult {
    /** 시트 패널. 바깥 클릭 판정의 기준이다. */
    panelRef: RefObject<HTMLDivElement | null>;
    /** 열릴 때 포커스를 받는 첫 행(링크 복사 버튼). */
    firstItemRef: RefObject<HTMLButtonElement | null>;
    /** 마지막 복사가 성공했고 안내 시간이 아직 남았다. */
    copied: boolean;
    /** 마지막 복사가 실패했다. 다음 복사 시도 전까지 직접 복사 입력을 보인다. */
    copyFailed: boolean;
    /** X 게시 화면 주소. */
    tweetUrl: string;
    /** 공유 링크를 클립보드에 복사한다. */
    handleCopy: () => Promise<void>;
}

/** 공유 시트의 포커스·닫기·복사 동작을 묶는다. */
export function useShareSheet({
    shareUrl,
    tweetText,
    anchorRef,
    onClose,
}: UseShareSheetOptions): UseShareSheetResult {
    const [copyFailed, setCopyFailed] = useState(false);

    const panelRef = useRef<HTMLDivElement>(null);
    const firstItemRef = useRef<HTMLButtonElement>(null);

    const { copied, copy } = useCopyToClipboard();
    useEscapeKey(onClose, true);
    // 트리거는 바깥으로 치지 않는다. 바깥 클릭으로 먼저 닫히면 이어지는 같은 클릭이
    // 공유를 처음부터 다시 돌려 같은 분석의 스냅샷이 하나 더 만들어지고 시트가 다시 열린다.
    useOnClickOutside([panelRef, anchorRef], onClose, { enabled: true });

    const tweetUrl = buildTweetIntentUrl({ text: tweetText, shareUrl });

    async function handleCopy(): Promise<void> {
        setCopyFailed(false);
        // 실패 폴백(선택 가능한 입력)은 훅의 `failed`와 달리 시간이 지나도 사라지지 않는다.
        const ok = await copy(shareUrl);
        if (!ok) setCopyFailed(true);
    }

    // 키보드 사용자가 시트를 열자마자 첫 동작에 닿게 한다.
    useEffect(() => {
        firstItemRef.current?.focus();
    }, []);

    return { panelRef, firstItemRef, copied, copyFailed, tweetUrl, handleCopy };
}

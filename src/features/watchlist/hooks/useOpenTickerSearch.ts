'use client';

import { use, useCallback } from 'react';
import { BELOW_LG_MEDIA_QUERY } from '@/shared/config/viewport';
import {
    HEADER_SEARCH_INPUT_ID,
    SearchOverlayTriggerContext,
} from '@/shared/model/SearchOverlayTriggerContext';

/**
 * 페이지 안의 "종목 검색" 버튼이 부르는 함수. 헤더와 같은 경계(`lg`)로 나눈다 — 그 아래는
 * 헤더에 입력이 없고 아이콘 트리거만 있으므로 전체화면 오버레이를 열고, 그 이상은 헤더의
 * 인라인 검색 입력에 포커스를 보낸다. 오버레이 프로바이더가 없는 트리(테스트 등)에서는 입력
 * 포커스만 시도한다.
 */
export function useOpenTickerSearch(): () => void {
    const overlay = use(SearchOverlayTriggerContext);
    return useCallback(() => {
        if (overlay && window.matchMedia(BELOW_LG_MEDIA_QUERY).matches) {
            overlay.open();
            return;
        }
        document.getElementById(HEADER_SEARCH_INPUT_ID)?.focus();
    }, [overlay]);
}

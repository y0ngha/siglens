'use client';

/**
 * AI 분석 위젯이 생성까지 요청해도 되는지와, 그 권한을 여는 동작 — 화면에 보이는 위젯은 회원 설정
 * (`useAiAutoRunAllowed`)을 따르고, SSR 스냅샷 프로즈 때문에 숨겨 둔(`hidden`) 위젯은 공유 흐름이
 * 명시적으로 요청했을 때만 생성한다.
 */
import { useState } from 'react';
import { useAiAutoRunAllowed } from './useAiAutoRunAllowed';

interface AiRunPermission {
    /** 생성까지 요청해도 되는가 — 거짓이면 캐시만 읽고, 미스면 `awaiting_interaction`. */
    allowed: boolean;
    /** 권한을 연다 — 대기 중인 쿼리가 다시 불려 생성한다(`useRefetchWhenAllowed`). */
    start: () => void;
}

/**
 * 숨긴 위젯은 공유 데이터 등록 때문에 마운트만 유지할 뿐 아무도 보지 않는다 — 자동 실행 설정대로 두면
 * 캐시 미스마다 보이지 않는 유료 생성을 돌린다. 그래서 숨긴 동안은 공유 버튼이 `start`를 부를 때만 연다.
 */
export function useAiRunPermission(
    symbol: string,
    hidden: boolean
): AiRunPermission {
    const { allowed: autoRunAllowed, grant } = useAiAutoRunAllowed(symbol);
    const [shareRequested, setShareRequested] = useState(false);
    return hidden
        ? { allowed: shareRequested, start: () => setShareRequested(true) }
        : { allowed: autoRunAllowed, start: grant };
}

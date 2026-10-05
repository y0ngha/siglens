'use client';

import { isCuratedSymbol } from '@/entities/symbol-indexability/lib/isCuratedSymbol';
import { useHumanInteracted } from '@/shared/hooks/useHumanInteracted';
import { markHumanInteracted } from '@/shared/lib/humanInteractionStore';
import { useSymbolModel } from '../model/SymbolModelContext';

export interface AiAutoRunGate {
    /**
     * AI 분석을 생성까지 자동으로 요청해도 되는지. `false`면 호출부는 캐시만
     * 조회(`cacheOnly`)하고, 미스면 "AI 분석 시작" 대기 상태로 둔다.
     */
    allowed: boolean;
    /** "AI 분석 시작" 버튼 — 입력을 즉시 인정해 대기 중인 분석을 시작시킨다. */
    grant: () => void;
}

/**
 * 큐레이션 밖(noindex) 종목에서 AI 분석 생성을 첫 신뢰 입력 뒤로 미루는 게이트.
 *
 * 허용 조건(하나라도 참이면 지금과 똑같이 자동 생성):
 * - 큐레이션 종목(`isCuratedSymbol`) — 색인되는 페이지라 크롤러가 렌더한 DOM이
 *   곧 검색 본문이다. 여기는 절대 막지 않는다.
 * - 로그인 회원(tier 확정 후 `free`가 아님).
 * - 이 탭에서 신뢰 입력이 있었음(`useHumanInteracted`).
 *
 * 서버는 User-Agent를 보지 않는다 — 이 게이트는 모든 방문자에게 같다.
 * 배경과 실측은 spec `2026-10-04-longtail-ai-interaction-gate-design.md`.
 */
export function useAiAutoRunAllowed(symbol: string): AiAutoRunGate {
    const { tier, isTierHydrated } = useSymbolModel();
    const interacted = useHumanInteracted();
    const allowed =
        isCuratedSymbol(symbol) ||
        (isTierHydrated && tier !== 'free') ||
        interacted;
    return { allowed, grant: markHumanInteracted };
}
